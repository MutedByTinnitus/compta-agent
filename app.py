"""
Agent Comptable IA - v5.0 SECURE
Traitement automatique de tickets de frais -> ecritures comptables Sage
Multi-provider : Claude -> OpenAI -> Ollama (fallback)
Securite : Auth, CSRF, Zero Data Retention, Anti-injection, Headers
"""

from dotenv import load_dotenv
load_dotenv()

import os
import io
import json
import base64
import re
import time
import email
import imaplib
import smtplib
import threading
import secrets
import hashlib
import hmac
import logging
from logging.handlers import RotatingFileHandler
from functools import wraps
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import requests
from flask import (
    Flask, request, jsonify, render_template, send_file,
    session, redirect, url_for, abort, make_response,
    after_this_request
)
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import red, black
from reportlab.lib.pagesizes import A4

app = Flask(__name__)


# ===================================================================
# LOGGING STRUCTURE
# ===================================================================

Path('logs').mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('enop')

handler = RotatingFileHandler('logs/enop.log', maxBytes=5*1024*1024, backupCount=3)
handler.setFormatter(logging.Formatter(
    '{"time": "%(asctime)s", "level": "%(levelname)s", "msg": "%(message)s"}'
))
logger.addHandler(handler)


# ===================================================================
# CONFIGURATION
# ===================================================================

# --- Securite ---
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FORCE_HTTPS', 'false').lower() == 'true'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=2)

# --- Identifiants login (via env, JAMAIS en dur) ---
APP_USERNAME = os.environ.get('APP_USERNAME', 'admin')
APP_PASSWORD_HASH = os.environ.get('APP_PASSWORD_HASH', '')
APP_PASSWORD_PLAIN = os.environ.get('APP_PASSWORD', 'changeme')

# --- API Keys ---
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
GOOGLE_DOCAI_PROJECT_ID = os.environ.get('GOOGLE_DOCAI_PROJECT_ID', '')
GOOGLE_DOCAI_PROCESSOR_ID = os.environ.get('GOOGLE_DOCAI_PROCESSOR_ID', '')

# --- Retry & Rate Limiting ---
MAX_RETRIES = 2
RETRY_BASE_DELAY = 1
RATE_LIMIT_DELAY = 0.5
RATE_LIMIT_429_WAIT = 15

# --- Brute-force protection ---
LOGIN_ATTEMPTS_FILE = Path('login_attempts.json')
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 minutes

# --- Rate limiting /api/process ---
PROCESS_RATE_LIMIT = {}

# --- Webhook ---
WEBHOOK_TOKEN = os.environ.get('WEBHOOK_TOKEN', '')

# --- Dossiers ---
OUTPUT_FOLDER = Path('outputs')
OUTPUT_FOLDER.mkdir(exist_ok=True)
CACHE_FOLDER = Path('cache')
CACHE_FOLDER.mkdir(exist_ok=True)
CACHE_ENABLED = os.environ.get('CACHE_ENABLED', 'true').lower() == 'true'

# --- Auto-delete : supprimer les fichiers de plus de X minutes ---
FILE_RETENTION_MINUTES = int(os.environ.get('FILE_RETENTION_MINUTES', '10'))

# --- Email (optionnel) ---
EMAIL_ADDRESS = os.environ.get('EMAIL_ADDRESS', '')
EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')
IMAP_SERVER = 'imap.gmail.com'
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 465
CHECK_INTERVAL = 30

# --- Prompt comptable (externalise) ---
SYSTEM_PROMPT = Path('prompts/comptable.md').read_text(encoding='utf-8')


# ===================================================================
# SECURITE : HELPERS
# ===================================================================

def hash_password(password):
    """Hash un mot de passe avec SHA-256 + salt"""
    salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{h}"


def verify_password(password, stored_hash):
    """Verifie un mot de passe contre son hash"""
    if ':' not in stored_hash:
        return False
    salt, h = stored_hash.split(':', 1)
    return hmac.compare_digest(
        hashlib.sha256(f"{salt}{password}".encode()).hexdigest(),
        h
    )


def check_password(password):
    """Verifie le mot de passe (hash ou plain selon config)"""
    if APP_PASSWORD_HASH:
        return verify_password(password, APP_PASSWORD_HASH)
    return hmac.compare_digest(password, APP_PASSWORD_PLAIN)


def load_attempts():
    """Charge les tentatives de login depuis le fichier JSON"""
    if LOGIN_ATTEMPTS_FILE.exists():
        try:
            data = json.loads(LOGIN_ATTEMPTS_FILE.read_text(encoding='utf-8'))
            for ip, val in data.items():
                if val[1]:
                    data[ip][1] = datetime.fromisoformat(val[1])
            return data
        except Exception:
            return {}
    return {}


def save_attempts(attempts):
    """Sauvegarde les tentatives de login dans le fichier JSON"""
    data = {}
    for ip, val in attempts.items():
        data[ip] = [val[0], val[1].isoformat() if val[1] else None]
    LOGIN_ATTEMPTS_FILE.write_text(json.dumps(data, indent=2), encoding='utf-8')


def is_locked_out(ip):
    """Verifie si une IP est bloquee pour trop de tentatives"""
    attempts = load_attempts()
    if ip in attempts:
        count, lockout_time = attempts[ip]
        if lockout_time and datetime.now() < lockout_time:
            return True
        if lockout_time and datetime.now() >= lockout_time:
            del attempts[ip]
            save_attempts(attempts)
            return False
    return False


def record_failed_attempt(ip):
    """Enregistre une tentative de login echouee"""
    attempts = load_attempts()
    if ip not in attempts:
        attempts[ip] = [0, None]
    attempts[ip][0] += 1
    if attempts[ip][0] >= MAX_LOGIN_ATTEMPTS:
        attempts[ip][1] = datetime.now() + timedelta(seconds=LOCKOUT_DURATION)
    save_attempts(attempts)


def clear_attempts(ip):
    """Reset les tentatives apres un login reussi"""
    attempts = load_attempts()
    if ip in attempts:
        del attempts[ip]
        save_attempts(attempts)


def login_required(f):
    """Decorateur pour proteger les routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('authenticated'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Non authentifie'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def generate_csrf_token():
    """Genere un token CSRF"""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def validate_csrf(token):
    """Valide le token CSRF"""
    return hmac.compare_digest(
        token or '',
        session.get('csrf_token', '')
    )


def sanitize_filename(filename):
    """Nettoie un nom de fichier contre les injections path traversal"""
    filename = os.path.basename(filename)
    filename = re.sub(r'[^\w\s\-\.]', '', filename)
    filename = filename.strip('. ')
    if not filename:
        filename = 'document.pdf'
    return filename


def cleanup_old_files():
    """Supprime les fichiers de sortie de plus de FILE_RETENTION_MINUTES"""
    try:
        cutoff = datetime.now() - timedelta(minutes=FILE_RETENTION_MINUTES)
        for f in OUTPUT_FOLDER.iterdir():
            if f.is_file():
                mtime = datetime.fromtimestamp(f.stat().st_mtime)
                if mtime < cutoff:
                    f.unlink()
                    logger.info(f"[Cleanup] Supprime {f.name}")
    except Exception as e:
        logger.error(f"[Cleanup] Erreur: {e}")


def schedule_cleanup():
    """Lance le nettoyage automatique toutes les 5 minutes"""
    while True:
        time.sleep(300)
        cleanup_old_files()


# ===================================================================
# SECURITE : MIDDLEWARE
# ===================================================================

@app.before_request
def security_checks():
    """Verifications de securite avant chaque requete"""
    # CSRF sur les POST (sauf login et webhook)
    if request.method == 'POST' and request.path not in ('/login', '/api/webhook'):
        if session.get('authenticated'):
            token = (request.form.get('csrf_token') or
                     request.headers.get('X-CSRF-Token') or
                     '')
            if not validate_csrf(token):
                abort(403)


@app.after_request
def security_headers(response):
    """Headers de securite sur toutes les reponses"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'"
    )
    # Pas de cache sur les fichiers sensibles
    if request.path.startswith('/api/download'):
        response.headers['Cache-Control'] = 'no-store'
    return response


# ===================================================================
# UTILITAIRES PDF
# ===================================================================


def _annotate_docai_text(doc, raw_text):
    """Annote le texte DocAI avec des marqueurs de confiance par token.
    [?] = confiance 0.70-0.89 (lecture incertaine)
    [??] = confiance < 0.70 (lecture très incertaine)
    Les tokens sans marqueur ont une confiance >= 0.90."""
    if not raw_text:
        return raw_text

    # Collecter tous les tokens avec leur confiance et position dans le texte
    low_confidence_spans = []  # (start, end, marker)

    for page in doc.get('pages', []):
        for token in page.get('tokens', []):
            conf = token.get('layout', {}).get('confidence', 1.0)
            if conf is None:
                conf = 1.0
            if conf >= 0.90:
                continue

            marker = '[??]' if conf < 0.70 else '[?]'

            # Extraire la position du token dans le texte via textAnchor
            text_anchor = token.get('layout', {}).get('textAnchor', {})
            for seg in text_anchor.get('textSegments', []):
                start = int(seg.get('startIndex', 0))
                end = int(seg.get('endIndex', start))
                if end > start:
                    low_confidence_spans.append((start, end, marker))

    if not low_confidence_spans:
        return raw_text

    # Trier par position et construire le texte annoté
    low_confidence_spans.sort(key=lambda x: x[0])
    result = []
    prev_end = 0
    for start, end, marker in low_confidence_spans:
        if start < prev_end:
            continue  # overlap, skip
        result.append(raw_text[prev_end:start])
        result.append(raw_text[start:end] + marker)
        prev_end = end
    result.append(raw_text[prev_end:])

    annotated = ''.join(result)
    n_uncertain = sum(1 for _, _, m in low_confidence_spans if m == '[?]')
    n_very_uncertain = sum(1 for _, _, m in low_confidence_spans if m == '[??]')
    if n_uncertain or n_very_uncertain:
        logger.info(
            f"  [DocAI] Annotation confiance: {n_uncertain} tokens [?] (0.70-0.89), "
            f"{n_very_uncertain} tokens [??] (<0.70)"
        )
    return annotated


def call_google_docai(pdf_bytes):
    """Extraction de texte via Google Document AI REST API."""
    import google.oauth2.service_account
    import google.auth.transport.requests

    if not GOOGLE_DOCAI_PROJECT_ID or not GOOGLE_DOCAI_PROCESSOR_ID:
        raise Exception("Google DocAI: GOOGLE_DOCAI_PROJECT_ID ou GOOGLE_DOCAI_PROCESSOR_ID non configure")

    credentials_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', '')
    if not credentials_path or not os.path.exists(credentials_path):
        raise Exception("Google DocAI: fichier credentials introuvable")

    credentials = google.oauth2.service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    access_token = credentials.token

    pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')

    endpoint = (
        f"https://eu-documentai.googleapis.com/v1/projects/{GOOGLE_DOCAI_PROJECT_ID}"
        f"/locations/eu/processors/{GOOGLE_DOCAI_PROCESSOR_ID}:process"
    )

    response = requests.post(
        endpoint,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        },
        json={
            'rawDocument': {
                'content': pdf_b64,
                'mimeType': 'application/pdf'
            }
        },
        timeout=60
    )

    if response.status_code == 200:
        doc = response.json().get('document', {})
        raw_text = doc.get('text', '').strip()

        # Annoter le texte avec les scores de confiance des tokens
        # [?] = confiance 0.70-0.89 (incertain), [??] = confiance <0.70 (très incertain)
        try:
            annotated_text = _annotate_docai_text(doc, raw_text)
        except Exception as e:
            logger.warning(f"  [DocAI] Erreur annotation token confidence: {e}")
            annotated_text = raw_text

        return annotated_text

    raise Exception(f"Google DocAI HTTP {response.status_code} - {response.text[:300]}")


def split_pdf_pages(pdf_bytes, filename):
    """Decoupe un PDF en pages individuelles"""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)
        output = io.BytesIO()
        writer.write(output)
        output.seek(0)
        page_name = f"{Path(filename).stem}_page{i+1}.pdf"
        pages.append({
            'filename': page_name,
            'bytes': output.read(),
            'original_filename': filename
        })
    return pages


def stamp_pdf_with_s(pdf_bytes):
    """Ajoute un S rouge sur le PDF"""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    for page in reader.pages:
        packet = io.BytesIO()
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)
        c = canvas.Canvas(packet, pagesize=(w, h))
        c.setFont("Helvetica-Bold", 60)
        c.setFillColor(red)
        c.setFillAlpha(0.7)
        c.drawString(w - 70, h - 70, "S")
        c.save()
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output.read()


def merge_pdfs(pdf_list):
    """Fusionne plusieurs PDFs en un seul"""
    writer = PdfWriter()
    for pdf_bytes in pdf_list:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            writer.add_page(page)
    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output.read()


# ===================================================================
# PROVIDERS IA
# ===================================================================

def call_anthropic(user_content):
    """Appel Claude API"""
    if not ANTHROPIC_API_KEY:
        raise Exception("Anthropic: cle API non configuree")

    response = requests.post(
        'https://api.anthropic.com/v1/messages',
        headers={
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        json={
            'model': 'claude-sonnet-4-6',
            'max_tokens': 16000,
            'thinking': {'type': 'enabled', 'budget_tokens': 8000},
            'system': SYSTEM_PROMPT,
            'messages': [{'role': 'user', 'content': user_content}]
        },
        timeout=300
    )

    if response.status_code == 200:
        content_blocks = response.json()['content']
        for block in reversed(content_blocks):
            if block.get('type') == 'text':
                return block['text']
        raise Exception("Aucun bloc text dans la reponse Claude")

    error_msg = f"Anthropic HTTP {response.status_code}"
    try:
        error_body = response.json()
        error_detail = error_body.get('error', {}).get('message', '')
        if error_detail:
            error_msg += f" - {error_detail}"
        logger.error(f"Anthropic reponse complete: {error_body}")
    except Exception:
        logger.error(f"Anthropic reponse brute: {response.text[:500]}")
    raise Exception(error_msg)


def call_gemini(user_content):
    """Appel Gemini Flash API - texte uniquement, JSON structure force"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini: cle API non configuree")

    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={GEMINI_API_KEY}',
        headers={'Content-Type': 'application/json'},
        json={
            'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
            'contents': [{'parts': [{'text': user_content}]}],
        },
        timeout=45
    )

    if response.status_code == 200:
        # Avec thinking activé, la réponse peut contenir plusieurs parts :
        # une "thought" (signature interne) + la réponse text.
        # On ignore les thoughts et on prend la première part de type text.
        parts = response.json()['candidates'][0]['content']['parts']
        for part in parts:
            if part.get('thought'):
                continue
            if 'text' in part:
                return part['text']
        raise Exception("Gemini: aucune part text dans la réponse")
    raise Exception(f"Gemini HTTP {response.status_code} - {response.text[:200]}")


# ===================================================================
# MOTEUR D'ANALYSE AVEC RETRY + FALLBACK
# ===================================================================

def clean_json_response(text):
    """Nettoie et parse la reponse JSON"""
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text).strip()
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        text = json_match.group()
    return json.loads(text)

def fix_ticket_mixte_carburant(ticket, ocr_text):
    """Corrige un ticket carburant mixte (carburant + boutique) en isolant
    le montant carburant via les codes TVA TotalEnergies/ESSO (H=carburant, Q=boutique)."""
    logger.info(
        f"  [Fix mixte] Analyse ticket {ticket.get('fournisseur','?')} {ticket.get('date','?')} "
        f"ttc={ticket.get('montant_ttc')} — ocr_text[:200]={repr(ocr_text[:200])}"
    )

    if not ocr_text:
        return ticket

    has_h = bool(re.search(r'H\s*20[,.]?0*%?', ocr_text))
    has_q = bool(re.search(r'Q\s*20[,.]?0*%?', ocr_text))

    logger.info(f"  [Fix mixte] Pattern H trouvé: {has_h} / Pattern Q trouvé: {has_q}")

    if not (has_h and has_q):
        return ticket

    # Ticket mixte détecté : chercher la ligne H (carburant)
    # Format TotalEnergies : H 20,00% <HT> <TVA> <TTC>
    # Exemple : "H 20,00% 55,01 45,84 9,17" → HT=55,01  TVA=45,84  TTC=9,17 (NON)
    # Exemple réel : "H 20,00% 55,01 45,84 9,17" → groupe1=55,01 groupe2=45,84 groupe3=9,17
    match = re.search(
        r'H\s*20[,.]?0*%?\s+([\d]+[,.][\d]+)\s+([\d]+[,.][\d]+)\s+([\d]+[,.][\d]+)',
        ocr_text
    )
    if not match:
        match = re.search(
            r'H\s+20[,.]00%\s+([\d,\.]+)\s+([\d,\.]+)\s+([\d,\.]+)',
            ocr_text
        )

    if not match:
        ticket = dict(ticket)
        ticket['confidence'] = min(float(ticket.get('confidence', 1.0) or 1.0), 0.65)
        existing = ticket.get('raison_rejet', '') or ''
        note = "Ticket mixte détecté mais montant carburant non isolable - vérification manuelle requise"
        ticket['raison_rejet'] = (existing + " | " + note).strip(" |") if existing else note
        logger.warning(
            f"  [Fix mixte] {ticket.get('fournisseur','?')} {ticket.get('date','?')} : "
            f"ticket mixte carburant+boutique, ligne H non parsable"
        )
        return ticket

    # Logger les 3 valeurs capturées pour déterminer l'ordre réel (HT/TVA/TTC ou autre)
    g1 = match.group(1)
    g2 = match.group(2)
    g3 = match.group(3)
    logger.info(
        f"  [Fix mixte] Ligne H capturée — groupe1={g1} groupe2={g2} groupe3={g3} "
        f"(attendu selon TotalEnergies: HT / TVA / TTC)"
    )

    ancien_ttc = float(ticket.get('montant_ttc', 0) or 0)
    # Format TotalEnergies : H 20,00% <HT> <TVA> <TTC> → groupe3 = TTC
    nouveau_ht  = float(g1.replace(',', '.'))
    nouveau_tva = float(g2.replace(',', '.'))
    nouveau_ttc = float(g3.replace(',', '.'))

    ticket = dict(ticket)
    ticket['montant_ttc'] = nouveau_ttc
    ticket['montant_ht']  = nouveau_ht
    ticket['montant_tva'] = nouveau_tva
    # Remonter la confidence : la correction réussie valide le ticket
    ticket['confidence'] = max(0.88, float(ticket.get('confidence', 0.88) or 0.88))

    logger.warning(
        f"  [Fix mixte] {ticket.get('fournisseur','?')} {ticket.get('date','?')} : "
        f"ttc corrigé {ancien_ttc}€ → {nouveau_ttc}€ (carburant seul, boutique exclue) "
        f"→ confidence remontée à {ticket['confidence']}"
    )

    existing = ticket.get('raison_rejet', '') or ''
    note = (
        f"Ticket mixte carburant+boutique : seul le carburant "
        f"comptabilisé ({nouveau_ttc}€). Articles boutique exclus."
    )
    ticket['raison_rejet'] = (existing + " | " + note).strip(" |") if existing else note

    return ticket


def filter_tickets_fiables(tickets, ocr_text):
    """Filtre les tickets avant calcul comptable.
    Retourne (tickets_ok, tickets_rejetes).
    tickets_rejetes = liste de dicts ticket + 'raison_rejet'."""
    tickets_ok = []
    tickets_rejetes = []

    # Critere 5 : OCR insuffisant -> tous rejetés
    if len(ocr_text.strip()) < 50:
        for t in tickets:
            t_rej = dict(t)
            t_rej['raison_rejet'] = "Scan illisible (OCR insuffisant)"
            tickets_rejetes.append(t_rej)
        return tickets_ok, tickets_rejetes

    acceptes = []  # pour detection doublons

    for t in tickets:
        raison = None

        # Critere 1 : montant_ttc manquant
        ttc = float(t.get('montant_ttc', 0) or 0)
        if ttc == 0:
            raison = "Montant TTC illisible ou absent"

        # Critere 2 : date manquante ou mauvais format
        elif not re.match(r'^\d{2}/\d{2}/\d{4}$', str(t.get('date', ''))):
            raison = "Date manquante ou illisible"

        # Critere 2b : dépense personnelle non professionnelle
        if raison is None:
            fournisseur_lower = str(t.get('fournisseur', '')).lower()
            PERSO_EXACT = ['free mobile', 'fnac', 'amazon', 'mcdo', 'mcdonald', 'auchan.fr']
            PERSO_WORD = ['action']  # mot isolé (magasin Action)
            is_perso = False
            for kw in PERSO_EXACT:
                if kw in fournisseur_lower:
                    is_perso = True
                    break
            if not is_perso:
                # "free" seul (pas "free mobile" déjà géré) — éviter faux positifs
                if re.search(r'\bfree\b', fournisseur_lower):
                    is_perso = True
            if not is_perso:
                # "action" seul (magasin), pas "station" ou autre
                if re.search(r'\baction\b', fournisseur_lower):
                    is_perso = True
            if not is_perso:
                # "carrefour market" mais PAS "carrefour carburant"
                if 'carrefour' in fournisseur_lower and 'market' in fournisseur_lower:
                    is_perso = True
            if is_perso:
                raison = "Dépense personnelle"

        # Fix ticket mixte carburant+boutique (avant les filtres de confiance)
        if raison is None and str(t.get('type', '')).lower() == 'carburant':
            t = fix_ticket_mixte_carburant(t, ocr_text)
            ttc = float(t.get('montant_ttc', 0) or 0)  # rafraîchir ttc après correction

        # Critere 3b : cohérence métier HT + TVA ≈ TTC (±0.02€)
        if raison is None:
            ht = float(t.get('montant_ht', 0) or 0)
            tva = float(t.get('montant_tva', 0) or 0)
            if ht > 0 and tva > 0:
                ecart = abs((ht + tva) - ttc)
                if ecart > 0.02:
                    t = dict(t)
                    t['confidence'] = min(float(t.get('confidence', 1.0) or 1.0), 0.75)
                    logger.warning(
                        f"  [Filtre] {t.get('fournisseur','?')} : HT({ht})+TVA({tva})={round(ht+tva,2)} "
                        f"≠ TTC({ttc}) (écart {ecart:.2f}€) → confidence abaissée à {t['confidence']}"
                    )

        # Critere 3c : année de la date dans [2020, année courante + 1]
        if raison is None:
            date_str = str(t.get('date', ''))
            date_match = re.match(r'^\d{2}/\d{2}/(\d{4})$', date_str)
            if date_match:
                annee = int(date_match.group(1))
                annee_max = datetime.now().year + 1
                if annee < 2020 or annee > annee_max:
                    t = dict(t)
                    t['confidence'] = min(float(t.get('confidence', 1.0) or 1.0), 0.70)
                    logger.warning(
                        f"  [Filtre] {t.get('fournisseur','?')} : année {annee} hors plage "
                        f"[2020, {annee_max}] → confidence abaissée à {t['confidence']}"
                    )

        # Critere 3 : confidence faible (après ajustements 3b/3c)
        if raison is None:
            conf = float(t.get('confidence', 1.0) or 1.0)
            if conf <= 0.60:
                raison = f"Lecture incertaine (confidence {conf:.0%})"

        # Critere 4 : doublon (meme fournisseur + meme ttc + date a ±1 jour)
        if raison is None:
            fournisseur = str(t.get('fournisseur', '')).strip().lower()
            try:
                date_t = datetime.strptime(t['date'], '%d/%m/%Y')
            except (ValueError, KeyError):
                date_t = None

            for a in acceptes:
                fournisseur_a = str(a.get('fournisseur', '')).strip().lower()
                ttc_a = float(a.get('montant_ttc', 0) or 0)
                try:
                    date_a = datetime.strptime(a['date'], '%d/%m/%Y')
                except (ValueError, KeyError):
                    date_a = None

                if (fournisseur == fournisseur_a and abs(ttc - ttc_a) < 0.01
                        and date_t and date_a and abs((date_t - date_a).days) <= 1):
                    raison = "Doublon detecte"
                    break

        if raison:
            t_rej = dict(t)
            t_rej['raison_rejet'] = raison
            tickets_rejetes.append(t_rej)
            logger.info(f"  [Filtre] Ticket rejete ({raison}) : {t.get('fournisseur')} {t.get('montant_ttc')}")
        else:
            acceptes.append(t)
            tickets_ok.append(t)

    return tickets_ok, tickets_rejetes


def cross_validate_against_ocr(tickets, ocr_text):
    """Vérifie que chaque montant TTC est retrouvable dans le texte OCR brut.
    Si absent, abaisse la confidence à 0.70 et ajoute une raison_rejet."""
    if not ocr_text or len(ocr_text.strip()) < 50:
        return tickets

    def normalize_ocr(text):
        """Normalise le texte OCR pour la recherche de montants :
        - supprime les espaces parasites entre chiffres (ex: "1 31.55" → "131.55")
        - remplace les virgules entre chiffres par des points (ex: "131,55" → "131.55")
        """
        # Répéter 3x pour gérer les espaces multiples entre chiffres
        for _ in range(3):
            text = re.sub(r'(\d)\s+(\d)', r'\1\2', text)
        # Virgules entre chiffres → points
        text = re.sub(r'(\d),(\d)', r'\1.\2', text)
        return text

    def build_formats(amount):
        """Génère toutes les représentations normalisées d'un montant."""
        fmts = set()
        fmts.add(f"{amount:.2f}")                      # 131.55
        fmts.add(f"{amount:.1f}")                      # 131.5
        if amount == int(amount):
            fmts.add(str(int(amount)))                 # 131
        for f in list(fmts):
            fmts.add(f + "€")
            fmts.add(f + " €")
            fmts.add(f + " EUR")
        return fmts

    def find_in_ocr(amount, normalized_text, tol=0.10):
        """Cherche le montant dans le texte OCR normalisé.
        Tolérance ±0.10€ pour absorber les erreurs OCR résiduelles."""
        # Valeur exacte
        for fmt in build_formats(amount):
            if fmt in normalized_text:
                return True
        # Valeurs à ±tol
        for delta in [tol, -tol, tol/2, -tol/2]:
            candidate = round(amount + delta, 2)
            if candidate > 0:
                for fmt in build_formats(candidate):
                    if fmt in normalized_text:
                        return True
        return False

    # Normaliser le texte OCR une seule fois pour tous les tickets
    normalized_ocr = normalize_ocr(ocr_text)
    logger.info(f"  [OCR-XVal] texte normalisé[:100]={repr(normalized_ocr[:100])}")

    validated = []
    for t in tickets:
        t = dict(t)
        ttc = float(t.get('montant_ttc', 0) or 0)
        if ttc > 0 and not find_in_ocr(ttc, normalized_ocr):
            current_conf = float(t.get('confidence', 1.0) or 1.0)
            t['confidence'] = min(current_conf, 0.70)
            existing = t.get('raison_rejet', '') or ''
            note = "Montant non confirmé par OCR"
            t['raison_rejet'] = (existing + " | " + note).strip(" |") if existing else note
            logger.warning(
                f"  [OCR-XVal] {t.get('fournisseur','?')} TTC={ttc} : "
                f"montant absent du texte OCR normalisé → confidence abaissée à {t['confidence']}"
            )
        validated.append(t)
    return validated


def generate_ecritures_from_tickets(tickets, start_ref=1):
    """Moteur comptable Python pur. Equilibre garanti mathematiquement.
    L'IA extrait les donnees brutes, Python fait TOUS les calculs."""

    COMPTE_MAP = {
        'carburant': '62520000',
        'peage':     '62510000',
        'parking':   '62780000',
        'repas':     '62560000',
        'hotel':     '62560100',
        'train':     '62510000',
        'transport': '62510000',
        'fournitures': '60680000',
        'autre':     '60680000',
    }

    # 0 = non deductible, 0.80 = 80% deductible, 1.0 = 100% deductible
    TVA_RULES = {
        'carburant':   0.80,
        'peage':       1.00,
        'parking':     1.00,
        'fournitures': 1.00,
        'autre':       1.00,
        'train':       1.00,
        'transport':   1.00,
        'repas':       0,
        'hotel':       0,
    }

    ecritures = []
    alerts = []
    ref_num = start_ref

    for t in tickets:
        ref = f'T{ref_num}'
        ref_num += 1

        date = t.get('date', '')
        fournisseur = t.get('fournisseur', 'Inconnu')
        type_dep = t.get('type', 'autre').lower().strip()
        description = t.get('description', '')
        libelle = f"{fournisseur} - {description}" if description else fournisseur

        ttc = round(float(t.get('montant_ttc', 0) or 0), 2)
        tva = round(float(t.get('montant_tva', 0) or 0), 2)
        ht  = round(float(t.get('montant_ht',  0) or 0), 2)

        if ttc == 0:
            logger.warning(f"[Compta] {ref} {fournisseur}: montant_ttc=0, ticket ignore")
            ref_num -= 1
            continue

        # Recalcul si donnees partielles
        if ht == 0 and tva > 0:
            ht = round(ttc - tva, 2)
        elif tva == 0 and ht > 0:
            tva = round(ttc - ht, 2)

        compte = COMPTE_MAP.get(type_dep, '60680000')
        taux = TVA_RULES.get(type_dep, 0)

        def ligne(cpt, debit, credit):
            return {
                'date': date, 'reference': ref, 'journal': 'FCB',
                'compte': cpt, 'libelle': libelle,
                'debit': round(debit, 2), 'credit': round(credit, 2)
            }

        if taux == 0:
            # TVA non deductible : charge = TTC
            ecritures += [ligne(compte, ttc, 0), ligne('51200000', 0, ttc)]

        elif tva == 0:
            # Pas de TVA sur le ticket : charge = TTC sans ligne TVA
            ecritures += [ligne(compte, ttc, 0), ligne('51200000', 0, ttc)]

        elif taux < 1.0:
            # Carburant : TVA partiellement deductible (80%)
            tva_ded = round(tva * taux, 2)
            tva_non_ded = round(tva * (1 - taux), 2)
            charge = round(ht + tva_non_ded, 2)
            # Ajustement centimes pour garantir debit = ttc
            if round(charge + tva_ded, 2) != ttc:
                charge = round(ttc - tva_ded, 2)
            ecritures += [ligne(compte, charge, 0), ligne('44566000', tva_ded, 0), ligne('51200000', 0, ttc)]
            alerts.append(f"{ref} : Carburant TVA 80% appliquee (defaut tourisme) - verifier si vehicule utilitaire (100%)")

        else:
            # TVA 100% deductible
            ecritures += [ligne(compte, ht, 0), ligne('44566000', tva, 0), ligne('51200000', 0, ttc)]

        # Verification equilibre (ne devrait jamais echouer)
        lignes_ref = [e for e in ecritures if e['reference'] == ref]
        td = round(sum(e['debit'] for e in lignes_ref), 2)
        tc = round(sum(e['credit'] for e in lignes_ref), 2)
        if abs(td - tc) > 0.01:
            logger.error(f"[Compta] BUG EQUILIBRE {ref}: debit={td} credit={tc}")

    return ecritures, ref_num - start_ref, alerts


def majority_vote_tickets(runs, filename=""):
    """Vote champ par champ sur les tickets extraits par N runs Gemini.
    Gère les runs avec un nombre différent de tickets par exclusion du ticket extra.
    Retourne un dict JSON final avec tickets votés."""
    from collections import Counter

    if len(runs) == 1:
        return runs[0]

    def vote_field(values, numeric=False, tol=0.01):
        """Retourne (valeur_majoritaire, has_majority)."""
        if not values:
            return None, False
        if numeric:
            groups = []
            for v in values:
                merged = False
                for g in groups:
                    if abs(v - g[0]) <= tol:
                        g.append(v)
                        merged = True
                        break
                if not merged:
                    groups.append([v])
            groups.sort(key=len, reverse=True)
            if len(groups[0]) > len(values) / 2:
                return round(sum(groups[0]) / len(groups[0]), 2), True
            return values[0], False
        else:
            c = Counter(str(v) for v in values)
            best_val, best_count = c.most_common(1)[0]
            if best_count > len(values) / 2:
                return best_val, True
            return str(values[0]), False

    def ttc_present_in_others(ttc_val, other_runs, tol=0.01):
        """Vérifie si un montant TTC est présent (±tol) dans au moins un autre run."""
        for other_r in other_runs:
            for t in other_r.get('tickets', []):
                other_ttc = float(t.get('montant_ttc', 0) or 0)
                if abs(ttc_val - other_ttc) <= tol:
                    return True
        return False

    # Déterminer le nombre majoritaire de tickets
    nb_per_run = [len(r.get('tickets', [])) for r in runs]
    nb_majority = Counter(nb_per_run).most_common(1)[0][0]

    # Aligner les runs minoritaires : exclure les tickets "extra"
    aligned_runs = []
    for r in runs:
        tickets = list(r.get('tickets', []))
        if len(tickets) == nb_majority:
            aligned_runs.append(tickets)
            continue

        # Ce run a plus de tickets : identifier et exclure le(s) ticket(s) extra
        # Un ticket extra = son montant_ttc absent (±0.01€) de TOUS les autres runs
        other_runs = [other_r for other_r in runs if other_r is not r]
        filtered = [
            t for t in tickets
            if ttc_present_in_others(float(t.get('montant_ttc', 0) or 0), other_runs)
        ]
        if len(filtered) == nb_majority:
            excluded = [t for t in tickets if t not in filtered]
            for ex in excluded:
                logger.info(
                    f"  [Majority] Ticket extra exclu : {ex.get('fournisseur','?')} "
                    f"TTC={ex.get('montant_ttc')} date={ex.get('date')} "
                    f"(TTC absent dans les autres runs)"
                )
            logger.info(
                f"  [Majority] run aligné : {len(tickets)} → {len(filtered)} tickets"
            )
            aligned_runs.append(filtered)
        else:
            # Impossible d'aligner proprement : garder les nb_majority premiers
            logger.warning(
                f"  [Majority] impossible d'aligner run ({len(tickets)} tickets) → "
                f"troncature à {nb_majority}"
            )
            aligned_runs.append(tickets[:nb_majority])

    # Vote par position sur les runs alignés
    voted_tickets = []
    for idx in range(nb_majority):
        ticket_runs = [run[idx] for run in aligned_runs if idx < len(run)]
        if not ticket_runs:
            continue

        voted = {}

        # Champs texte (variations normales, pas d'impact sur confidence)
        for field in ('fournisseur', 'type', 'description', 'raison_rejet'):
            val, _ = vote_field([t.get(field, '') for t in ticket_runs], numeric=False)
            voted[field] = val

        # Date : vote strict — détermine la confidence
        voted['date'], date_majority = vote_field(
            [t.get('date', '') for t in ticket_runs], numeric=False
        )

        # Montant TTC : vote avec tolérance — détermine la confidence
        voted['montant_ttc'], ttc_majority = vote_field(
            [float(t.get('montant_ttc', 0) or 0) for t in ticket_runs], numeric=True
        )

        # Autres montants (variations normales)
        for field in ('montant_tva', 'montant_ht'):
            val, _ = vote_field(
                [float(t.get(field, 0) or 0) for t in ticket_runs], numeric=True
            )
            voted[field] = val

        # Confidence : run 1 par défaut, pénalité 0.6 UNIQUEMENT si montant_ttc diverge
        # (désaccord date seul ignoré : peut venir de tickets proches avec même montant)
        voted['confidence'] = float(ticket_runs[0].get('confidence', 1.0) or 1.0)
        if not ttc_majority:
            voted['confidence'] = min(voted['confidence'], 0.6)
            logger.warning(
                f"  [Majority] T{idx+1} ({voted.get('fournisseur','?')}) : "
                f"désaccord sur ttc → confidence abaissée à {voted['confidence']}"
            )
        elif not date_majority:
            logger.info(
                f"  [Majority] T{idx+1} ({voted.get('fournisseur','?')}) : "
                f"désaccord date uniquement (ttc unanime) → confidence inchangée"
            )

        voted_tickets.append(voted)

    # Inventaire : voter sur les champs
    inventaires = [r.get('inventaire', {}) for r in runs]
    voted_inventaire = {}
    for field in ('total_detectes', 'lisibles', 'partiels', 'illisibles'):
        vals = [inv.get(field, 0) for inv in inventaires if inv]
        if vals:
            voted_inventaire[field] = Counter(vals).most_common(1)[0][0]

    confs_globales = [float(r.get('confidence', 1.0) or 1.0) for r in runs]
    return {
        'exploitable': True,
        'inventaire': voted_inventaire,
        'tickets': voted_tickets,
        'confidence': round(sum(confs_globales) / len(confs_globales), 2)
    }


def analyze_ticket_with_retry(pdf_bytes, filename="ticket.pdf"):
    """Analyse : OCR -> texte -> LLM. Jamais de PDF base64."""

    # Cache SHA-256
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
    cache_file = CACHE_FOLDER / f"{pdf_hash}.json"
    if CACHE_ENABLED:
        if cache_file.exists():
            try:
                cached = json.loads(cache_file.read_text(encoding='utf-8'))
                logger.info(f"[Cache] {filename} - hit ({pdf_hash[:8]})")
                if cached.get('_ocr_text'):
                    return cached
                # Cache ancien sans _ocr_text : relancer l'OCR pour le récupérer
                logger.info(f"[Cache] {filename} - _ocr_text absent, relance OCR")
            except Exception:
                pass

    # OCR : toujours via Google DocAI (PyMuPDF supprimé — trop bruité sur les scans)
    text = ""
    if GOOGLE_DOCAI_PROJECT_ID and GOOGLE_DOCAI_PROCESSOR_ID:
        try:
            text = call_google_docai(pdf_bytes)
            text_hash = hashlib.sha256(text.encode()).hexdigest()[:8]
            logger.info(f"  [OCR] DocAI — {len(text)} chars, hash={text_hash}")
        except Exception as e:
            logger.error(f"  [OCR] DocAI erreur: {e}")

    if len(text.strip()) < 50:
        return {
            "exploitable": False,
            "raison_non_exploitable": "Ticket illisible meme apres OCR",
            "tickets": []
        }

    # TOUJOURS du texte au LLM, JAMAIS du base64
    cloud_content = f"Voici le texte extrait d'un ticket de frais :\n\n{text}"

    if not GEMINI_API_KEY:
        return {
            "exploitable": False,
            "raison_non_exploitable": "LLM indisponible - réessayer dans quelques minutes",
            "tickets": []
        }

    # Majority voting : 3 runs indépendants
    N_RUNS = 3
    runs = []  # liste de résultats JSON valides
    for run_idx in range(N_RUNS):
        try:
            logger.info(f"[Gemini] {filename} - run {run_idx+1}/{N_RUNS}")
            raw_response = call_gemini(cloud_content)
            run_result = clean_json_response(raw_response)
            if 'exploitable' not in run_result:
                raise ValueError("JSON sans champ 'exploitable'")
            runs.append(run_result)
            logger.info(f"[Gemini] run {run_idx+1} OK — {len(run_result.get('tickets', []))} ticket(s)")
        except Exception as e:
            logger.error(f"[Gemini] run {run_idx+1} echec: {e}")

    if not runs:
        logger.info(f"[Gemini] Echec total — 0 runs valides sur {N_RUNS}")
        return {
            "exploitable": False,
            "raison_non_exploitable": "LLM indisponible - réessayer dans quelques minutes",
            "tickets": []
        }

    # Vote sur le nombre de tickets
    nb_runs = [len(r.get('tickets', [])) for r in runs]
    logger.info(
        f"  [Majority] {filename} : "
        + ", ".join(f"run{i+1}={n}" for i, n in enumerate(nb_runs))
        + f" — {len(runs)}/{N_RUNS} runs valides"
    )

    from collections import Counter
    count_nb = Counter(nb_runs)
    nb_majority = count_nb.most_common(1)[0][0]
    if len(count_nb) > 1:
        logger.warning(
            f"  [Majority] Désaccord sur le nombre de tickets : {dict(count_nb)} → retenu {nb_majority}"
        )

    # Ne garder que les runs avec le nombre majoritaire
    runs_majority = [r for r in runs if len(r.get('tickets', [])) == nb_majority]

    result = majority_vote_tickets(runs_majority, filename)

    nb_final = len(result.get('tickets', []))
    logger.info(f"  [Majority] Final : {nb_final} ticket(s) après vote")
    for i, t in enumerate(result.get('tickets', [])):
        logger.info(
            f"  [T{i+1}] {t.get('fournisseur','?')} | "
            f"{t.get('date','?')} | "
            f"ttc={t.get('montant_ttc','?')} | "
            f"conf={t.get('confidence','?')}"
        )

    result['_ocr_text'] = text

    if CACHE_ENABLED:
        try:
            cache_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
            logger.info(f"[Cache] {filename} - sauvegarde ({pdf_hash[:8]})")
        except Exception:
            pass

    return result


# ===================================================================
# GENERATION EXCEL SAGE
# ===================================================================

def create_excel(all_ecritures, alerts=None, low_confidence_refs=None):
    """Cree le fichier Excel format Sage"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Ecritures comptables"

    header_font = Font(name='Calibri', bold=True, size=11, color='FFFFFF')
    header_fill = PatternFill(start_color='2C3E50', end_color='2C3E50', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center')
    border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    orange_fill = PatternFill(start_color='FFB347', end_color='FFB347', fill_type='solid')

    headers = ['Date', 'Reference', 'Journal', 'Compte', 'Libelle', 'Debit', 'Credit']
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = border

    row = 2
    total_debit = 0
    total_credit = 0

    for e in all_ecritures:
        debit = round(float(e.get('debit', 0) or 0), 2)
        credit = round(float(e.get('credit', 0) or 0), 2)
        total_debit += debit
        total_credit += credit

        is_low_confidence = (
            low_confidence_refs and e.get('reference', '') in low_confidence_refs
        )

        values = [
            e.get('date', ''),
            e.get('reference', ''),
            e.get('journal', 'FCB'),
            e.get('compte', ''),
            e.get('libelle', ''),
            debit,
            credit
        ]
        for col, val in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=val)
            cell.border = border
            if is_low_confidence:
                cell.fill = orange_fill
            if col in (6, 7):
                cell.number_format = '#,##0.00'
                cell.alignment = Alignment(horizontal='right')
        row += 1

    row += 1
    equilibre = abs(total_debit - total_credit) < 0.01
    ctrl_fill = PatternFill(
        start_color='27AE60' if equilibre else 'E74C3C',
        end_color='27AE60' if equilibre else 'E74C3C',
        fill_type='solid'
    )
    ctrl_font = Font(name='Calibri', bold=True, color='FFFFFF')

    ws.cell(row=row, column=4, value='CONTROLE').font = ctrl_font
    ws.cell(row=row, column=4).fill = ctrl_fill
    status = 'OK - Equilibre' if equilibre else 'ERREUR - Desequilibre'
    ws.cell(row=row, column=5, value=status).font = ctrl_font
    ws.cell(row=row, column=5).fill = ctrl_fill
    ws.cell(row=row, column=6, value=round(total_debit, 2)).font = ctrl_font
    ws.cell(row=row, column=6).fill = ctrl_fill
    ws.cell(row=row, column=6).number_format = '#,##0.00'
    ws.cell(row=row, column=7, value=round(total_credit, 2)).font = ctrl_font
    ws.cell(row=row, column=7).fill = ctrl_fill
    ws.cell(row=row, column=7).number_format = '#,##0.00'

    if alerts:
        row += 2
        alert_font = Font(name='Calibri', bold=True, color='E74C3C')
        ws.cell(row=row, column=1, value='ALERTES').font = alert_font
        for alert in alerts:
            row += 1
            ws.cell(row=row, column=1, value=alert)

    for col_letter, width in [('A', 14), ('B', 12), ('C', 10), ('D', 12), ('E', 45), ('F', 14), ('G', 14)]:
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.read()


# ===================================================================
# RAPPORT INEXPLOITABLES
# ===================================================================

def create_inexploitable_report(inexploitable_tickets):
    """Cree un PDF listant les tickets inexploitables avec conseils de correction"""

    CONSEILS = {
        'Scan illisible':     "Renvoyer ce ticket scanne a plat, fond blanc, sans froissures, resolution minimum 300 DPI",
        'Montant':            "Le montant TTC n'est pas visible. Verifier que le ticket n'est pas coupe ou decolore",
        'Date manquante':     "La date est absente ou illisible. Renvoyer le ticket complet",
        'Date manquante ou illisible': "La date est absente ou illisible. Renvoyer le ticket complet",
        'Lecture incertaine': "Ce ticket presente des zones illisibles. Renvoyer un scan plus net ou la version originale",
        'Doublon':            "Ce ticket semble deja present dans le lot. Verifier et renvoyer si c'est bien une depense distincte",
    }

    def get_conseil(raison):
        for key, conseil in CONSEILS.items():
            if key.lower() in raison.lower():
                return conseil
        return "Verifier ce justificatif et le renvoyer dans un prochain lot"

    # Calcul du montant total non comptabilise
    total_non_compta = sum(
        float(t.get('montant_ttc', 0) or 0)
        for t in inexploitable_tickets
        if isinstance(t, dict) and float(t.get('montant_ttc', 0) or 0) > 0
    )
    nb = len(inexploitable_tickets)

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    orange = (0.95, 0.5, 0.1)

    # En-tete
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(red)
    c.drawString(50, height - 55, "Justificatifs a corriger")
    c.setFont("Helvetica", 10)
    c.setFillColor(black)
    c.drawString(50, height - 75, f"Date de traitement : {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    # Resumé chiffré
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(red)
    c.drawString(50, height - 100, f"{nb} ticket(s) non comptabilise(s)")
    if total_non_compta > 0:
        c.drawString(50, height - 116, f"Montant total non comptabilise : {total_non_compta:.2f} EUR")
    c.setFillColor(black)
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 136, "Ces justificatifs n'ont pas pu etre integres. Voir les conseils ci-dessous.")

    y = height - 165

    for ticket in inexploitable_tickets:
        # Chaque ticket prend ~75px, verifier qu'il reste de la place
        if y < 100:
            c.showPage()
            y = height - 60

        # Ligne de separation
        c.setStrokeColorRGB(0.8, 0.8, 0.8)
        c.line(50, y + 5, width - 50, y + 5)
        y -= 5

        # Identite du ticket
        if isinstance(ticket, dict) and 'fournisseur' in ticket:
            fournisseur = ticket.get('fournisseur') or 'Inconnu'
            date_str = ticket.get('date') or 'Date manquante'
            ttc = float(ticket.get('montant_ttc', 0) or 0)
            montant_str = f" — {ttc:.2f} EUR" if ttc > 0 else ""
            identite = f"{fournisseur}  |  {date_str}{montant_str}"
            raison = ticket.get('raison_rejet', ticket.get('raison', ''))
        else:
            identite = str(ticket.get('filename', '?'))[:60] if isinstance(ticket, dict) else str(ticket)[:60]
            raison = ticket.get('raison', '') if isinstance(ticket, dict) else ''

        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(black)
        c.drawString(52, y, identite[:80])
        y -= 16

        # Raison en orange
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(*orange)
        c.drawString(52, y, f"Motif : {raison[:80]}")
        y -= 14

        # Conseil en gris
        conseil = get_conseil(raison)
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        # Couper le conseil en deux lignes si trop long
        if len(conseil) > 90:
            c.drawString(52, y, conseil[:90])
            y -= 12
            c.drawString(52, y, conseil[90:])
        else:
            c.drawString(52, y, conseil)
        y -= 20

    c.save()
    buffer.seek(0)
    return buffer.read()


# ===================================================================
# TRAITEMENT PRINCIPAL
# ===================================================================

def process_tickets(files_data):
    """Traite une liste de tickets"""
    all_ecritures = []
    exploited_pdfs = []
    inexploitable_tickets = []
    alerts = []
    low_confidence_refs = set()
    ticket_num = 1
    results_detail = []

    # Split uniquement les tres gros PDF (Claude Opus gere bien les documents multi-pages)
    split_files = []
    for file_info in files_data:
        try:
            reader = PdfReader(io.BytesIO(file_info['bytes']))
            if len(reader.pages) > 1:
                logger.info(f"Split {file_info['filename']} : {len(reader.pages)} pages")
                pages = split_pdf_pages(file_info['bytes'], file_info['filename'])
                split_files.extend(pages)
            else:
                split_files.append(file_info)
        except Exception as e:
            logger.error(f"Erreur split {file_info['filename']}: {e}")
            split_files.append(file_info)

    total_pages = len(split_files)
    logger.info(f"{'='*50}")
    logger.info(f"Traitement de {total_pages} page(s)")
    logger.info(f"{'='*50}")

    for idx, file_info in enumerate(split_files):
        filename = file_info['filename']
        pdf_bytes = file_info['bytes']

        logger.info(f"[{idx+1}/{total_pages}] {filename}")
        result = analyze_ticket_with_retry(pdf_bytes, filename)

        if result.get('exploitable'):
            tickets_bruts = result.get('tickets', [])

            if not tickets_bruts:
                raison = "Aucun ticket extrait par l'IA"
                inexploitable_tickets.append({'filename': filename, 'raison': raison})
                alerts.append(f"!! {filename} : {raison}")
                results_detail.append({'filename': filename, 'status': 'inexploitable', 'raison': raison})
            else:
                # Filtrage qualite avant calcul comptable
                # Utiliser le texte OCR deja extrait (DocAI), pas une nouvelle extraction
                ocr_text = result.get('_ocr_text', '')
                logger.info(f"  [Filtre] len(ocr_text)={len(ocr_text)} chars")
                # cross_validate_against_ocr désactivé : trop de faux positifs sur scans
                # La protection contre les hallucinations est assurée par le majority voting N=3
                tickets_ok, tickets_rejetes = filter_tickets_fiables(tickets_bruts, ocr_text)
                logger.info(f"  [Filtre] {len(tickets_ok)} ok, {len(tickets_rejetes)} rejetes sur {len(tickets_bruts)} extraits")

                # Vérification inventaire LLM vs tickets effectivement extraits
                inventaire = result.get('inventaire', {})
                total_detectes = inventaire.get('total_detectes', 0)
                nb_extraits = len(tickets_ok) + len(tickets_rejetes)
                if total_detectes > 0 and nb_extraits < total_detectes:
                    manquants = total_detectes - nb_extraits
                    alerts.append(
                        f"!! {filename} : {manquants} ticket(s) détecté(s) par le LLM "
                        f"mais non extrait(s) — vérifier le scan ({total_detectes} détectés, "
                        f"{nb_extraits} traités)"
                    )
                    logger.warning(
                        f"  [Inventaire] {total_detectes} détectés, "
                        f"{nb_extraits} traités — {manquants} manquant(s)"
                    )

                # Ajouter les tickets rejetés au rapport inexploitables
                for t_rej in tickets_rejetes:
                    raison_rej = t_rej.get('raison_rejet', 'Ticket rejete')
                    label = f"{t_rej.get('fournisseur', '?')} {t_rej.get('montant_ttc', 0)}€ ({filename})"
                    inexploitable_tickets.append({'filename': label, 'raison': raison_rej})
                    alerts.append(f"!! {label} : {raison_rej}")

                if not tickets_ok:
                    results_detail.append({'filename': filename, 'status': 'inexploitable', 'raison': 'Tous les tickets rejetes par le filtre qualite'})
                else:
                    # Génération des écritures par Python
                    ecritures, nb_tickets, compta_alerts = generate_ecritures_from_tickets(tickets_ok, start_ref=ticket_num)
                    alerts.extend(compta_alerts)
                    logger.info(f"  [Python] {len(ecritures)} ecritures generees pour {len(tickets_ok)} tickets")

                    # Vérification d'équilibre (filet de sécurité)
                    par_ref = defaultdict(list)
                    for e in ecritures:
                        par_ref[e['reference']].append(e)
                    for ref, groupe in par_ref.items():
                        total_d = round(sum(e['debit'] for e in groupe), 2)
                        total_c = round(sum(e['credit'] for e in groupe), 2)
                        if abs(total_d - total_c) > 0.01:
                            alerts.append(f"{ref} ({filename}) : Desequilibre residuel ({total_d:.2f} != {total_c:.2f})")

                    refs_list = ', '.join(f'T{ticket_num + i}' for i in range(nb_tickets))
                    all_ecritures.extend(ecritures)
                    # TODO: reactiver le tampon S en production
                    # stamped = stamp_pdf_with_s(pdf_bytes)
                    exploited_pdfs.append(pdf_bytes)
                    results_detail.append({
                        'filename': filename, 'status': 'exploitable',
                        'reference': refs_list, 'ecritures': ecritures
                    })
                    ticket_num += nb_tickets
        else:
            raison = result.get('raison_non_exploitable', 'Document inexploitable')
            inexploitable_tickets.append({'filename': filename, 'raison': raison})
            alerts.append(f"!! {filename} : {raison}")
            results_detail.append({
                'filename': filename, 'status': 'inexploitable', 'raison': raison
            })

        if idx < total_pages - 1:
            time.sleep(RATE_LIMIT_DELAY)

    # Generation fichiers (supprimes automatiquement apres FILE_RETENTION_MINUTES)
    output_files = {}
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    if all_ecritures:
        excel_bytes = create_excel(
            all_ecritures,
            alerts if alerts else None,
            low_confidence_refs=low_confidence_refs
        )
        excel_name = f'Sage_import_{timestamp}.xlsx'
        (OUTPUT_FOLDER / excel_name).write_bytes(excel_bytes)
        output_files['excel'] = {'name': excel_name, 'path': str(OUTPUT_FOLDER / excel_name)}

    if exploited_pdfs:
        merged = merge_pdfs(exploited_pdfs)
        stamped_name = f'Tickets_exploites_S_{timestamp}.pdf'
        (OUTPUT_FOLDER / stamped_name).write_bytes(merged)
        output_files['stamped_pdf'] = {'name': stamped_name, 'path': str(OUTPUT_FOLDER / stamped_name)}

    if inexploitable_tickets:
        report = create_inexploitable_report(inexploitable_tickets)
        report_name = f'Justificatifs_inexploites_{timestamp}.pdf'
        (OUTPUT_FOLDER / report_name).write_bytes(report)
        output_files['inexploitable_pdf'] = {'name': report_name, 'path': str(OUTPUT_FOLDER / report_name)}

    total_d = round(sum(e['debit'] for e in all_ecritures), 2)
    total_c = round(sum(e['credit'] for e in all_ecritures), 2)
    logger.info(f"{'='*50}")
    logger.info(f"RESULTAT : {len(exploited_pdfs)} exploites / {len(inexploitable_tickets)} inexploitables")
    logger.info(f"TOTAUX   : D={total_d} | C={total_c} | {'OK' if abs(total_d - total_c) < 0.01 else 'ERREUR'}")
    logger.info(f"{'='*50}")

    return {
        'output_files': output_files,
        'results_detail': results_detail,
        'summary': {
            'total': total_pages,
            'exploites': len(exploited_pdfs),
            'inexploites': len(inexploitable_tickets),
            'total_debit': total_d,
            'total_credit': total_c,
            'equilibre': abs(total_d - total_c) < 0.01
        }
    }


# ===================================================================
# EMAIL
# ===================================================================

def send_email_with_attachments(to_email, subject, body, attachments):
    msg = MIMEMultipart()
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    for att_filename, file_bytes in attachments:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(file_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{att_filename}"')
        msg.attach(part)
    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        server.send_message(msg)


def check_emails_once():
    """Une iteration de verification des emails"""
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
    mail.select('INBOX')
    _, messages = mail.search(None, 'UNSEEN')
    for num in messages[0].split():
        if not num:
            continue
        _, msg_data = mail.fetch(num, '(RFC822)')
        msg = email.message_from_bytes(msg_data[0][1])
        sender = email.utils.parseaddr(msg['From'])[1]
        subject = msg['Subject'] or 'Sans objet'
        files_data = []
        for part in msg.walk():
            if part.get_content_type() == 'application/pdf':
                att_filename = part.get_filename() or 'document.pdf'
                pdf_bytes = part.get_payload(decode=True)
                if pdf_bytes:
                    files_data.append({'filename': att_filename, 'bytes': pdf_bytes})
        if not files_data:
            continue
        logger.info(f"[EMAIL] Mail de {sender} - {len(files_data)} PDF(s)")
        results = process_tickets(files_data)
        attachments = []
        files = results['output_files']
        for key in ['excel', 'stamped_pdf', 'inexploitable_pdf']:
            if files.get(key):
                with open(files[key]['path'], 'rb') as f:
                    attachments.append((files[key]['name'], f.read()))
        s = results['summary']
        body = f"""Bonjour,

Traitement de vos {s['total']} justificatif(s) termine.

- {s['exploites']} exploite(s)
- {s['inexploites']} inexploitable(s)
- Debit : {s['total_debit']:.2f} EUR
- Credit : {s['total_credit']:.2f} EUR
- Equilibre : {'OK' if s['equilibre'] else 'ERREUR'}

Agent Comptable IA"""
        send_email_with_attachments(sender, f"Re: {subject}", body, attachments)
        logger.info(f"[EMAIL] Reponse envoyee a {sender}")
    mail.logout()


def check_emails():
    """Boucle watchdog pour la verification des emails"""
    while True:
        try:
            check_emails_once()
        except Exception as e:
            logger.error(f"[EMAIL] Crash recupere, redemarrage dans 60s: {e}")
            time.sleep(60)
            continue
        time.sleep(CHECK_INTERVAL)


# ===================================================================
# ROUTES
# ===================================================================

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        ip = request.remote_addr

        if is_locked_out(ip):
            error = "Trop de tentatives. Reessayez dans 5 minutes."
        else:
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '')

            if username == APP_USERNAME and check_password(password):
                session.permanent = True
                session['authenticated'] = True
                session['login_time'] = datetime.now().isoformat()
                session['csrf_token'] = secrets.token_hex(32)
                clear_attempts(ip)
                return redirect(url_for('index'))
            else:
                record_failed_attempt(ip)
                attempts = load_attempts()
                remaining = MAX_LOGIN_ATTEMPTS - attempts.get(ip, [0, None])[0]
                if remaining > 0:
                    error = f"Identifiants incorrects. {remaining} tentative(s) restante(s)."
                else:
                    error = "Compte bloque pour 5 minutes."

    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/')
@login_required
def index():
    return render_template('index.html', csrf_token=generate_csrf_token())


@app.route('/api/process', methods=['POST'])
@login_required
def api_process():
    # Rate limiting : max 10 appels par session par heure
    rate_key = f"{session.get('login_time', '')}_{request.remote_addr}"
    now = time.time()
    if rate_key not in PROCESS_RATE_LIMIT:
        PROCESS_RATE_LIMIT[rate_key] = []
    PROCESS_RATE_LIMIT[rate_key] = [t for t in PROCESS_RATE_LIMIT[rate_key] if now - t < 3600]
    if len(PROCESS_RATE_LIMIT[rate_key]) >= 10:
        return jsonify({'error': 'Trop de requetes, attendez avant de resoumettre'}), 429
    PROCESS_RATE_LIMIT[rate_key].append(now)

    if 'files' not in request.files:
        return jsonify({'error': 'Aucun fichier envoye'}), 400

    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'Aucun fichier selectionne'}), 400

    files_data = []
    for f in files:
        if f.filename and f.filename.lower().endswith('.pdf'):
            safe_name = sanitize_filename(f.filename)
            pdf_bytes = f.read()

            # Validation : verifier que c'est bien un PDF
            if not pdf_bytes[:5] == b'%PDF-':
                continue

            files_data.append({'filename': safe_name, 'bytes': pdf_bytes})

    if not files_data:
        return jsonify({'error': 'Aucun fichier PDF valide'}), 400

    try:
        results = process_tickets(files_data)

        # Nettoyage immediat des donnees en memoire
        for fd in files_data:
            fd['bytes'] = None
        files_data.clear()

        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/<filename>')
@login_required
def download_file(filename):
    # Anti path-traversal
    safe_name = sanitize_filename(filename)
    filepath = OUTPUT_FOLDER / safe_name

    if not filepath.exists():
        return jsonify({'error': 'Fichier non trouve'}), 404

    # Verifier que le fichier est bien dans OUTPUT_FOLDER
    try:
        filepath.resolve().relative_to(OUTPUT_FOLDER.resolve())
    except ValueError:
        abort(403)

    @after_this_request
    def remove_file(response):
        try:
            filepath.unlink()
            logger.info(f"[ZDR] Fichier supprime apres download: {safe_name}")
        except Exception:
            pass
        return response

    return send_file(filepath, as_attachment=True, download_name=safe_name)


@app.route('/api/status')
@login_required
def api_status():
    providers = {
        'gemini': bool(GEMINI_API_KEY),
        'anthropic': bool(ANTHROPIC_API_KEY),
        'docai': bool(GOOGLE_DOCAI_PROJECT_ID and GOOGLE_DOCAI_PROCESSOR_ID),
    }

    return jsonify({
        'providers': providers,
        'active_providers': sum(1 for v in providers.values() if v),
        'file_retention_minutes': FILE_RETENTION_MINUTES
    })


@app.route('/api/webhook', methods=['POST'])
def webhook():
    """Endpoint webhook pour OpenClaw"""
    # Auth par token Bearer (separe du systeme de session web)
    auth_header = request.headers.get('Authorization', '')
    webhook_token = os.environ.get('WEBHOOK_TOKEN', '')

    if not webhook_token or auth_header != f'Bearer {webhook_token}':
        return jsonify({'error': 'Non autorise'}), 401

    # Accepte JSON avec base64 des PDFs
    data = request.get_json()
    if not data or 'files' not in data:
        return jsonify({'error': 'Format invalide, attendu: {"files": [{"name": "...", "data": "base64..."}]}'}), 400

    files_data = []
    for f in data['files']:
        pdf_bytes = base64.b64decode(f['data'])
        if pdf_bytes[:5] != b'%PDF-':
            continue
        files_data.append({
            'filename': sanitize_filename(f.get('name', 'document.pdf')),
            'bytes': pdf_bytes
        })

    if not files_data:
        return jsonify({'error': 'Aucun PDF valide'}), 400

    results = process_tickets(files_data)

    # Retourne le summary + les fichiers en base64
    response_data = {'summary': results['summary'], 'files': {}}
    for key, file_info in results['output_files'].items():
        with open(file_info['path'], 'rb') as fh:
            response_data['files'][key] = {
                'name': file_info['name'],
                'data': base64.b64encode(fh.read()).decode()
            }

    return jsonify(response_data)


# ===================================================================
# DEMARRAGE
# ====================================================================

if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("  AGENT COMPTABLE IA v5.0 SECURE")
    logger.info("=" * 50)

    logger.info("Securite :")
    logger.info(f"  Login         : {APP_USERNAME} / {'hash' if APP_PASSWORD_HASH else 'plain'}")
    logger.info(f"  Session       : {app.config['PERMANENT_SESSION_LIFETIME']}")
    logger.info(f"  CSRF          : actif")
    logger.info(f"  Anti-bruteforce: {MAX_LOGIN_ATTEMPTS} tentatives, lockout {LOCKOUT_DURATION}s")
    logger.info(f"  Zero Data     : fichiers supprimes apres {FILE_RETENTION_MINUTES} min")
    logger.info(f"  Headers       : CSP, X-Frame-Options, nosniff, no-cache")

    logger.info("Providers :")
    docai_ok = bool(GOOGLE_DOCAI_PROJECT_ID and GOOGLE_DOCAI_PROCESSOR_ID)
    logger.info(f"  OCR Google DocAI : {'OK' if docai_ok else 'NON'}")
    logger.info(f"  LLM Gemini       : {'OK' if GEMINI_API_KEY else 'NON'}")
    logger.info(f"  LLM Claude       : {'OK' if ANTHROPIC_API_KEY else 'NON'}")

    logger.info(f"  Webhook : {'actif sur /api/webhook' if WEBHOOK_TOKEN else 'desactive (WEBHOOK_TOKEN non defini)'}")

    if EMAIL_ADDRESS and EMAIL_PASSWORD:
        email_thread = threading.Thread(target=check_emails, daemon=True)
        email_thread.start()
        logger.info(f"Email : {EMAIL_ADDRESS}")
    else:
        logger.info("Email : non configure")

    # Thread de nettoyage automatique
    cleanup_thread = threading.Thread(target=schedule_cleanup, daemon=True)
    cleanup_thread.start()

    logger.info(f"Interface : http://localhost:5000")
    logger.info("=" * 50)

    app.run(host='0.0.0.0', port=5000, debug=False)