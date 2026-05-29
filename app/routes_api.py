"""Routes API (/api/*).

Les fonctions métier OCR (process_tickets, save_job, create_excel, etc.)
sont importées depuis ocr_engine (= ex app.py monolithique).

Toutes les routes sont multi-tenant : scoping organization_id appliqué
au niveau des accès Run (cf decorators.org_run_required).
"""
import io
import json
import re
import time
import threading
import uuid as _uuid
import zipfile
from datetime import datetime
from pathlib import Path

from flask import (
    Blueprint, request, jsonify, send_file, abort, after_this_request,
    current_app,
)
from flask_login import login_required, current_user
from PyPDF2 import PdfReader

import ocr_engine
from ocr_engine import (
    sanitize_filename, process_tickets,
    save_job, load_job, update_job, cleanup_old_jobs,
    load_review_queue, load_auto_validated,
    update_ticket_in_queue, update_ticket_anywhere, _save_queue_data,
    generate_ecritures_from_tickets, create_excel,
    REVIEW_BASE, OUTPUT_FOLDER, MAX_PAGES_PER_BATCH,
    logger,
    COMPTES_CHARGES, COMPTES_TVA, COMPTES_FOURNISSEURS, COMPTES_TRESORERIE,
    attach_default_accounts,
)

from .extensions import db
from .models.run import Run
from .models.client import Client
from .models.dossier import Dossier
from .models.audit_log import AuditLog
from .auth.decorators import org_run_required, resolve_run_for_current_user


api_bp = Blueprint('api', __name__)


# Rate limit en mémoire par user_id
PROCESS_RATE_LIMIT = {}


def _log_audit(action, resource_type=None, resource_id=None, meta=None):
    db.session.add(AuditLog(
        organization_id=current_user.organization_id if current_user.is_authenticated else None,
        user_id=current_user.id if current_user.is_authenticated else None,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        ip_address=request.remote_addr,
        meta=meta or {},
    ))


# ─── /api/process ────────────────────────────────────────────────
@api_bp.route('/api/process', methods=['POST'])
@login_required
def api_process():
    user_id = str(current_user.id)
    now = time.time()
    PROCESS_RATE_LIMIT.setdefault(user_id, [])
    PROCESS_RATE_LIMIT[user_id] = [t for t in PROCESS_RATE_LIMIT[user_id] if now - t < 3600]
    if len(PROCESS_RATE_LIMIT[user_id]) >= 10:
        return jsonify({'error': 'Trop de requetes, attendez avant de resoumettre'}), 429
    PROCESS_RATE_LIMIT[user_id].append(now)

    if 'files' not in request.files:
        return jsonify({'error': 'Aucun fichier envoye'}), 400

    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'Aucun fichier selectionne'}), 400

    files_data = _extract_pdfs_from_uploads(files)
    if not files_data:
        return jsonify({'error': 'Aucun fichier PDF valide (PDF directs ou dans un ZIP)'}), 400

    # Limite de pages
    total_pages = _count_total_pages(files_data)
    if total_pages > MAX_PAGES_PER_BATCH:
        return jsonify({
            'error': (
                f"Trop de pages ({total_pages}). "
                f"Limite : {MAX_PAGES_PER_BATCH} pages par lot. "
                f"Divise ton upload en plusieurs fichiers."
            ),
            'pages_detectees': total_pages,
            'limite': MAX_PAGES_PER_BATCH,
        }), 413

    # Créer le job + la ligne Run en DB
    job_id = _uuid.uuid4().hex
    filenames = [fd['filename'] for fd in files_data]

    # Optionnel : client_id (form-data ou query string)
    client_id_raw = (request.form.get('client_id') or '').strip()
    client_id = None
    if client_id_raw and _is_uuid(client_id_raw):
        c = db.session.query(Client.id).filter(
            Client.id == client_id_raw,
            Client.organization_id == current_user.organization_id,
            Client.is_active.is_(True),
        ).first()
        if c:
            client_id = client_id_raw

    # Optionnel : dossier_id (doit appartenir au client choisi)
    dossier_id_raw = (request.form.get('dossier_id') or '').strip()
    dossier_id = None
    if dossier_id_raw and _is_uuid(dossier_id_raw):
        dq = db.session.query(Dossier.id).filter(
            Dossier.id == dossier_id_raw,
            Dossier.organization_id == current_user.organization_id,
            Dossier.is_active.is_(True),
        )
        if client_id:
            dq = dq.filter(Dossier.client_id == client_id)
        if dq.first():
            dossier_id = dossier_id_raw

    run = Run(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        client_id=client_id,
        dossier_id=dossier_id,
        legacy_job_id=job_id,
        filenames=filenames,
        status='pending',
    )
    db.session.add(run)
    db.session.flush()
    db_run_id = str(run.id)
    org_id = str(current_user.organization_id)
    _log_audit('run.create', resource_type='run', resource_id=db_run_id,
               meta={'filenames': filenames, 'pages': total_pages})
    db.session.commit()

    save_job(job_id, {
        'job_id': job_id,
        'status': 'pending',
        'progress': 0,
        'step': 'upload',
        'detail': 'En attente du worker',
        'filenames': filenames,
        'created_at': datetime.utcnow().isoformat(),
        'db_run_id': db_run_id,
        'organization_id': org_id,
    })

    flask_app = current_app._get_current_object()

    def _progress_cb(step, pct, detail=""):
        update_job(job_id, status='running', step=step, progress=pct, detail=detail)

    def _cancel_check():
        """Lu par le pipeline aux jalons pour s'arreter proprement.
        Retourne True si l'utilisateur a clique 'Annuler' (route /cancel)."""
        data = load_job(job_id)
        if not data:
            return False
        return bool(data.get('cancel_requested'))

    def _run_job_with_ctx(jid, fdata, _db_run_id):
        from ocr_engine import JobCancelled
        with flask_app.app_context():
            try:
                results = process_tickets(
                    fdata,
                    progress_cb=_progress_cb,
                    cancel_check=_cancel_check,
                )
                for fd in fdata:
                    fd['bytes'] = None
                fdata.clear()
                _persist_run_completion(_db_run_id, results)
                update_job(jid, status='done', progress=100, step='export',
                           detail='Termine', result=results)
            except JobCancelled:
                logger.info(f"[Job {jid}] annule par l'utilisateur")
                update_job(jid, status='cancelled', detail='Annule par l\'utilisateur')
                try:
                    r = db.session.get(Run, _db_run_id)
                    if r and r.status not in ('done', 'failed'):
                        r.status = 'cancelled'
                        db.session.commit()
                except Exception:
                    db.session.rollback()
            except Exception as e:
                logger.exception(f"[Job {jid}] echec : {e}")
                update_job(jid, status='failed', error=str(e))
                # Marquer le run en DB comme failed
                try:
                    r = db.session.get(Run, _db_run_id)
                    if r:
                        r.status = 'failed'
                        db.session.commit()
                except Exception:
                    db.session.rollback()

    threading.Thread(
        target=_run_job_with_ctx,
        args=(job_id, files_data, db_run_id),
        daemon=True,
    ).start()
    cleanup_old_jobs()

    return jsonify({
        'job_id': job_id,
        'run_id': db_run_id,
        'status': 'pending',
    }), 202


def _extract_pdfs_from_uploads(files):
    out = []
    for f in files:
        if not f.filename:
            continue
        fname_lower = f.filename.lower()
        raw_bytes = f.read()

        if fname_lower.endswith('.zip'):
            try:
                with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                    for member in zf.namelist():
                        if member.lower().endswith('.pdf') and not member.startswith('__MACOSX'):
                            pdf_bytes = zf.read(member)
                            if pdf_bytes[:5] != b'%PDF-':
                                continue
                            base_name = Path(member).name
                            safe_name = sanitize_filename(base_name)
                            out.append({'filename': safe_name, 'bytes': pdf_bytes})
                            logger.info(f"[ZIP] Extrait : {safe_name}")
            except zipfile.BadZipFile:
                logger.warning(f"[ZIP] Fichier ZIP invalide : {f.filename}")
                continue
        elif fname_lower.endswith('.pdf'):
            if raw_bytes[:5] != b'%PDF-':
                continue
            safe_name = sanitize_filename(f.filename)
            out.append({'filename': safe_name, 'bytes': raw_bytes})
    return out


def _count_total_pages(files_data):
    total = 0
    for fd in files_data:
        try:
            reader = PdfReader(io.BytesIO(fd['bytes']))
            total += len(reader.pages)
        except Exception:
            total += 1
    return total


def _persist_run_completion(db_run_id, results):
    """Mise à jour de la ligne Run en DB après pipeline OCR terminé."""
    run = db.session.get(Run, db_run_id)
    if not run:
        return
    run.status = 'done'
    run.completed_at = datetime.utcnow()

    legacy_run_id = results.get('run_id')
    if legacy_run_id:
        run.legacy_run_id = legacy_run_id

        # Snapshot des 3 queues
        queue_dir = REVIEW_BASE / legacy_run_id
        snapshot = {}
        for name in ('queue.json', 'auto_validated.json', 'rescan.json'):
            f = queue_dir / name
            if f.exists():
                try:
                    snapshot[name.replace('.json', '')] = json.loads(
                        f.read_text(encoding='utf-8')
                    )
                except Exception:
                    pass
        run.snapshot = snapshot

        good = snapshot.get('auto_validated', {}).get('tickets', []) or []
        doubtful = snapshot.get('queue', {}).get('tickets', []) or []
        rescan = snapshot.get('rescan', {}).get('tickets', []) or []
        run.tickets_good = len(good)
        run.tickets_doubtful = len(doubtful)
        run.tickets_unreadable = len(rescan)

        rescan_pdf = snapshot.get('rescan', {}).get('rescan_pdf')
        if rescan_pdf:
            run.rescan_pdf_path = rescan_pdf

    summary = results.get('summary', {})
    run.pages_total = summary.get('total', 0)

    output_files = results.get('output_files', {})
    if output_files.get('excel'):
        run.excel_path = output_files['excel'].get('name')

    cost = results.get('cost', {})
    if cost.get('total_eur') is not None:
        try:
            run.cost_eur = float(cost['total_eur'])
        except (ValueError, TypeError):
            pass
    run.cost_data = cost or {}

    db.session.commit()


# ─── /api/jobs/<job_id> ──────────────────────────────────────────
@api_bp.route('/api/jobs/<job_id>', methods=['GET'])
@login_required
def api_job_status(job_id):
    if not re.fullmatch(r'[a-f0-9]{32}', job_id or ''):
        return jsonify({'error': 'job_id invalide'}), 400
    data = load_job(job_id)
    if data is None:
        return jsonify({'error': 'Job introuvable'}), 404
    # Garde-fou multi-tenant : un job ne sort pas de son org
    job_org = data.get('organization_id')
    if job_org and job_org != str(current_user.organization_id):
        return jsonify({'error': 'Job introuvable'}), 404
    return jsonify(data)


@api_bp.route('/api/jobs/<job_id>/cancel', methods=['POST'])
@login_required
def api_job_cancel(job_id):
    """Demande l'annulation d'un job. Le worker vérifie ce flag aux jalons
    (avant chaque appel LLM, entre les pages) et s'arrête proprement."""
    if not re.fullmatch(r'[a-f0-9]{32}', job_id or ''):
        return jsonify({'error': 'job_id invalide'}), 400

    data = load_job(job_id)
    if data is None:
        return jsonify({'error': 'Job introuvable'}), 404

    # Multi-tenant : seul le propriétaire peut annuler
    job_org = data.get('organization_id')
    if job_org and job_org != str(current_user.organization_id):
        return jsonify({'error': 'Job introuvable'}), 404

    # Si déjà terminé, on ne fait rien
    if data.get('status') in ('done', 'failed', 'cancelled'):
        return jsonify({'ok': True, 'already': data.get('status')})

    # Marquer le job comme à annuler — le worker verra ça à son prochain check
    update_job(job_id, cancel_requested=True)

    # Marquer aussi le Run DB comme cancelled
    db_run_id = data.get('db_run_id')
    if db_run_id:
        try:
            r = db.session.get(Run, db_run_id)
            if r and r.status not in ('done', 'failed'):
                r.status = 'cancelled'
                _log_audit('run.cancel', resource_type='run', resource_id=str(r.id))
                db.session.commit()
        except Exception:
            db.session.rollback()

    return jsonify({'ok': True, 'cancel_requested': True}), 202


# ─── /api/runs et /api/runs/<id> ─────────────────────────────────
@api_bp.route('/api/runs', methods=['GET'])
@login_required
def list_runs():
    """Historique paginé des runs de l'organization courante."""
    try:
        page = max(1, int(request.args.get('page', 1)))
    except ValueError:
        page = 1
    try:
        per_page = min(50, max(1, int(request.args.get('per_page', 20))))
    except ValueError:
        per_page = 20

    query = db.session.query(Run).filter(
        Run.organization_id == current_user.organization_id
    )

    # Filtre client optionnel : ?client_id=<uuid> ou ?client_id=null pour "non classés"
    client_filter = request.args.get('client_id')
    if client_filter == 'null':
        query = query.filter(Run.client_id.is_(None))
    elif client_filter and _is_uuid(client_filter):
        query = query.filter(Run.client_id == client_filter)

    # Filtre dossier optionnel
    dossier_filter = request.args.get('dossier_id')
    if dossier_filter == 'null':
        query = query.filter(Run.dossier_id.is_(None))
    elif dossier_filter and _is_uuid(dossier_filter):
        query = query.filter(Run.dossier_id == dossier_filter)

    query = query.order_by(Run.created_at.desc())

    total = query.count()
    runs = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'total': total,
        'page': page,
        'per_page': per_page,
        'runs': [_run_to_dict(r) for r in runs],
    })


@api_bp.route('/api/runs/<run_id>', methods=['GET'])
@login_required
def get_run(run_id):
    run = resolve_run_for_current_user(run_id)
    if not run:
        return jsonify({'error': 'Run introuvable'}), 404
    return jsonify(_run_to_dict(run, include_snapshot=True))


def _run_to_dict(r, include_snapshot=False):
    d = {
        'id': str(r.id),
        'legacy_job_id': r.legacy_job_id,
        'legacy_run_id': r.legacy_run_id,
        'client_id': str(r.client_id) if r.client_id else None,
        'client_name': r.client.name if r.client else None,
        'dossier_id': str(r.dossier_id) if r.dossier_id else None,
        'dossier_label': r.dossier.label if r.dossier else None,
        'filenames': r.filenames or [],
        'status': r.status,
        'pages_total': r.pages_total,
        'tickets_good': r.tickets_good,
        'tickets_doubtful': r.tickets_doubtful,
        'tickets_unreadable': r.tickets_unreadable,
        'excel_path': r.excel_path,
        'rescan_pdf_path': r.rescan_pdf_path,
        'cost_eur': float(r.cost_eur) if r.cost_eur is not None else None,
        'created_at': r.created_at.isoformat() if r.created_at else None,
        'completed_at': r.completed_at.isoformat() if r.completed_at else None,
    }
    if include_snapshot:
        d['snapshot'] = r.snapshot or {}
        d['cost_data'] = r.cost_data or {}
    return d


# ─── /api/review/<run_id> ────────────────────────────────────────
@api_bp.route('/api/review/<run_id>', methods=['GET'])
@login_required
@org_run_required
def api_review_get(run_id, run=None):
    # Le scoping est déjà fait : run appartient à l'org courante.
    # On utilise legacy_run_id pour lire les fichiers queue.
    key = run.legacy_run_id or run.legacy_job_id or run_id
    queue = load_review_queue(key)
    if not queue:
        return jsonify({'error': 'Queue introuvable pour ce run'}), 404

    good_tickets = load_auto_validated(key)

    rescan_path = REVIEW_BASE / key / 'rescan.json'
    rescan_data = {}
    if rescan_path.exists():
        try:
            rescan_data = json.loads(rescan_path.read_text(encoding='utf-8'))
        except Exception:
            pass

    # Backfill comptes PCG pour les anciens runs qui n'avaient pas attach_default_accounts.
    # attach_default_accounts ne modifie un champ que s'il est absent ou vide,
    # donc les valeurs édités à la main ne sont pas écrasées.
    for t in (queue.get('tickets') or []):
        attach_default_accounts(t)
    for t in (good_tickets or []):
        attach_default_accounts(t)

    return jsonify({
        **queue,
        'good_tickets': good_tickets,
        'rescan_tickets': rescan_data.get('tickets', []),
        'rescan_pdf': rescan_data.get('rescan_pdf'),
    })


# ─── /api/review/<run_id>/<ticket_id> PATCH ──────────────────────
@api_bp.route('/api/review/<run_id>/<ticket_id>', methods=['PATCH'])
@login_required
@org_run_required
def api_review_update(run_id, ticket_id, run=None):
    data = request.get_json(silent=True) or {}
    action = data.get('action')
    fields = data.get('fields', {})

    if action not in ('validate', 'ignore', 'duplicate'):
        return jsonify({'error': 'Invalid action'}), 400

    status_map = {'validate': 'validated', 'ignore': 'ignored', 'duplicate': 'duplicate'}
    updates = {'review_status': status_map[action]}

    if action == 'validate' and fields:
        for key in ('date', 'fournisseur', 'montant_ttc', 'montant_ht', 'montant_tva',
                    'mode_paiement', 'type',
                    'compte_charge', 'compte_tva', 'compte_fournisseur', 'compte_tresorerie',
                    'numero_facture'):
            if key in fields:
                updates[key] = fields[key]
        updates['user_corrected'] = True

    key = run.legacy_run_id or run.legacy_job_id or run_id
    success = update_ticket_anywhere(key, ticket_id, updates)
    if not success:
        return jsonify({'error': 'Ticket not found'}), 404

    _log_audit(f'ticket.{action}', resource_type='ticket', resource_id=ticket_id,
               meta={'run_id': str(run.id)})
    db.session.commit()
    return jsonify({'ok': True})


# ─── /api/review/<run_id>/ignore-duplicates ──────────────────────
@api_bp.route('/api/review/<run_id>/ignore-duplicates', methods=['POST'])
@login_required
@org_run_required
def api_review_ignore_duplicates(run_id, run=None):
    key = run.legacy_run_id or run.legacy_job_id or run_id
    queue = load_review_queue(key)
    if not queue:
        return jsonify({'error': 'Queue introuvable'}), 404

    count = 0
    for ticket in queue['tickets']:
        if (ticket.get('review_status') == 'pending'
                and 'possible_duplicate' in ticket.get('review_reasons', [])):
            ticket['review_status'] = 'ignored'
            ticket['ignored_reason'] = 'batch_duplicate'
            ticket['updated_at'] = datetime.utcnow().isoformat()
            count += 1

    queue['stats']['pending'] = sum(1 for t in queue['tickets'] if t.get('review_status') == 'pending')
    queue['stats']['ignored'] = sum(1 for t in queue['tickets'] if t.get('review_status') == 'ignored')
    _save_queue_data(key, queue)
    return jsonify({'ok': True, 'ignored_count': count})


# ─── /api/review/<run_id>/finalize ───────────────────────────────
@api_bp.route('/api/review/<run_id>/finalize', methods=['POST'])
@login_required
@org_run_required
def api_review_finalize(run_id, run=None):
    key = run.legacy_run_id or run.legacy_job_id or run_id
    queue = load_review_queue(key)
    if not queue:
        return jsonify({'error': 'Queue introuvable'}), 404

    manually_validated = [
        t for t in queue['tickets'] if t.get('review_status') == 'validated'
    ]
    auto_validated = load_auto_validated(key)
    final_tickets = auto_validated + manually_validated

    if not final_tickets:
        return jsonify({
            'ok': True,
            'message': 'Aucun ticket à exporter',
            'tickets_included': 0,
        })

    ecritures, _, alerts = generate_ecritures_from_tickets(final_tickets, start_ref=1)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    excel_bytes = create_excel(ecritures, alerts if alerts else None)
    excel_name = f'Sage_review_{key[:15]}_{timestamp}.xlsx'
    (OUTPUT_FOLDER / excel_name).write_bytes(excel_bytes)

    run.excel_path = excel_name
    _log_audit('run.finalize', resource_type='run', resource_id=str(run.id),
               meta={'tickets_included': len(final_tickets), 'excel': excel_name})
    db.session.commit()

    ignored = sum(
        1 for t in queue['tickets']
        if t.get('review_status') in ('ignored', 'duplicate')
    )

    return jsonify({
        'ok': True,
        'excel_name': excel_name,
        'excel_url': f'/api/download/{excel_name}',
        'tickets_included': len(final_tickets),
        'tickets_excluded': ignored,
    })


# ─── /api/rescan-pdf/<run_id> ────────────────────────────────────
@api_bp.route('/api/rescan-pdf/<run_id>', methods=['GET'])
@login_required
@org_run_required
def api_rescan_pdf_download(run_id, run=None):
    key = run.legacy_run_id or run.legacy_job_id or run_id
    pdf_path = REVIEW_BASE / key / 'rescan.pdf'
    if not pdf_path.exists():
        return jsonify({'error': 'PDF non disponible'}), 404
    return send_file(
        str(pdf_path),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'tickets_a_rescanner_{key[:12]}.pdf',
    )


# ─── /api/download/<filename> ────────────────────────────────────
@api_bp.route('/api/download/<filename>', methods=['GET'])
@login_required
def download_file(filename):
    safe_name = sanitize_filename(filename)
    filepath = OUTPUT_FOLDER / safe_name

    if not filepath.exists():
        return jsonify({'error': 'Fichier non trouve'}), 404

    # Anti path-traversal
    try:
        filepath.resolve().relative_to(OUTPUT_FOLDER.resolve())
    except ValueError:
        abort(403)

    # Scoping multi-tenant : le filename doit correspondre à un Run de l'org du user
    run = db.session.query(Run).filter(
        Run.organization_id == current_user.organization_id,
        Run.excel_path == safe_name,
    ).first()
    if not run:
        # Fallback : Excel généré au moment du pipeline (avant persist_run_completion)
        # → on autorise si pattern Sage_import_<timestamp>.xlsx avec timestamp < 1h
        if not _filename_belongs_to_recent_run(safe_name):
            return jsonify({'error': 'Acces refuse a ce fichier'}), 403

    @after_this_request
    def remove_file(response):
        try:
            filepath.unlink()
            logger.info(f"[ZDR] Fichier supprime apres download: {safe_name}")
        except Exception:
            pass
        return response

    _log_audit('file.download', resource_type='file', resource_id=safe_name)
    db.session.commit()
    return send_file(filepath, as_attachment=True, download_name=safe_name)


def _filename_belongs_to_recent_run(filename):
    """Tolère un download avant que persist_run_completion ait écrit excel_path
    en DB : on cherche un Run de l'org créé dans la dernière heure dont le job
    pourrait avoir produit ce fichier."""
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(hours=1)
    return db.session.query(Run.id).filter(
        Run.organization_id == current_user.organization_id,
        Run.created_at >= cutoff,
    ).first() is not None


# ─── /api/status ─────────────────────────────────────────────────
@api_bp.route('/api/status', methods=['GET'])
@login_required
def api_status():
    providers = {
        'gemini': bool(getattr(ocr_engine, 'GEMINI_API_KEY', None)),
        'anthropic': bool(getattr(ocr_engine, 'ANTHROPIC_API_KEY', None)),
        'docai': bool(getattr(ocr_engine, 'GOOGLE_DOCAI_PROJECT_ID', None)
                       and getattr(ocr_engine, 'GOOGLE_DOCAI_PROCESSOR_ID', None)),
    }
    return jsonify({
        'providers': providers,
        'active_providers': sum(1 for v in providers.values() if v),
        'file_retention_minutes': getattr(ocr_engine, 'FILE_RETENTION_MINUTES', 10),
        'max_pages_per_batch': MAX_PAGES_PER_BATCH,
    })


# ─── /api/costs (admin uniquement, scoping fait sur les runs DB) ──
@api_bp.route('/api/costs', methods=['GET'])
@login_required
def get_cost_history():
    """Coûts agrégés des runs de l'organization courante (depuis la DB)."""
    runs = db.session.query(Run).filter(
        Run.organization_id == current_user.organization_id,
        Run.cost_eur.isnot(None),
    ).order_by(Run.created_at.desc()).limit(100).all()

    total_eur = sum(float(r.cost_eur or 0) for r in runs)
    total_pages = sum(r.pages_total or 0 for r in runs)
    total_tickets = sum(
        (r.tickets_good or 0) + (r.tickets_doubtful or 0)
        for r in runs
    )

    totals = {}
    if runs:
        totals = {
            'total_runs': len(runs),
            'total_cost_eur': round(total_eur, 2),
            'total_pages': total_pages,
            'total_tickets': total_tickets,
            'avg_cost_per_run_eur': round(total_eur / len(runs), 4),
            'avg_cost_per_ticket_eur': round(total_eur / max(total_tickets, 1), 4),
        }

    return jsonify({
        'runs': [_run_to_dict(r) for r in runs],
        'totals': totals,
    })


# ─── /api/clients (CRUD multi-tenant) ────────────────────────────
def _client_to_dict(c):
    return {
        'id': str(c.id),
        'name': c.name,
        'siren': c.siren,
        'legal_form': c.legal_form,
        'fiscal_year_end': c.fiscal_year_end,
        'address_line1': c.address_line1,
        'address_line2': c.address_line2,
        'postal_code': c.postal_code,
        'city': c.city,
        'contact_name': c.contact_name,
        'contact_email': c.contact_email,
        'contact_phone': c.contact_phone,
        'is_active': c.is_active,
        'created_at': c.created_at.isoformat() if c.created_at else None,
    }


def _clean_siren(s):
    if not s:
        return None
    digits = ''.join(ch for ch in s if ch.isdigit())
    return digits or None


@api_bp.route('/api/clients', methods=['GET'])
@login_required
def list_clients():
    q = (request.args.get('q') or '').strip().lower()
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

    query = db.session.query(Client).filter(
        Client.organization_id == current_user.organization_id,
    )
    if not include_inactive:
        query = query.filter(Client.is_active.is_(True))
    clients = query.order_by(Client.name.asc()).all()
    if q:
        clients = [c for c in clients
                   if q in (c.name or '').lower()
                   or q in (c.siren or '')]

    return jsonify({
        'total': len(clients),
        'clients': [_client_to_dict(c) for c in clients],
    })


@api_bp.route('/api/clients', methods=['POST'])
@login_required
def create_client():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Nom requis'}), 400

    siren = _clean_siren(data.get('siren'))
    if siren and len(siren) != 9:
        return jsonify({'error': 'SIREN doit comporter 9 chiffres'}), 400

    # Unicité du nom dans l'org
    existing = db.session.query(Client).filter(
        Client.organization_id == current_user.organization_id,
        Client.name == name,
        Client.is_active.is_(True),
    ).first()
    if existing:
        return jsonify({'error': 'Un client avec ce nom existe déjà'}), 409

    c = Client(
        organization_id=current_user.organization_id,
        name=name,
        siren=siren,
        legal_form=(data.get('legal_form') or '').strip() or None,
        fiscal_year_end=(data.get('fiscal_year_end') or '').strip() or None,
        address_line1=(data.get('address_line1') or '').strip() or None,
        address_line2=(data.get('address_line2') or '').strip() or None,
        postal_code=(data.get('postal_code') or '').strip() or None,
        city=(data.get('city') or '').strip() or None,
        contact_name=(data.get('contact_name') or '').strip() or None,
        contact_email=(data.get('contact_email') or '').strip() or None,
        contact_phone=(data.get('contact_phone') or '').strip() or None,
    )
    db.session.add(c)
    db.session.flush()
    _log_audit('client.create', resource_type='client', resource_id=str(c.id),
               meta={'name': name})
    db.session.commit()
    return jsonify(_client_to_dict(c)), 201


def _get_org_client_or_404(client_id):
    """Helper : récupère un client en garantissant qu'il appartient à l'org."""
    if not _is_uuid(client_id):
        return None
    return db.session.query(Client).filter(
        Client.id == client_id,
        Client.organization_id == current_user.organization_id,
    ).first()


def _is_uuid(s):
    import uuid
    try:
        uuid.UUID(str(s))
        return True
    except (ValueError, TypeError):
        return False


@api_bp.route('/api/clients/<client_id>', methods=['GET'])
@login_required
def get_client(client_id):
    c = _get_org_client_or_404(client_id)
    if not c:
        return jsonify({'error': 'Client introuvable'}), 404
    return jsonify(_client_to_dict(c))


@api_bp.route('/api/clients/<client_id>', methods=['PATCH'])
@login_required
def update_client(client_id):
    c = _get_org_client_or_404(client_id)
    if not c:
        return jsonify({'error': 'Client introuvable'}), 404

    data = request.get_json(silent=True) or {}
    editable = (
        'name', 'siren', 'legal_form', 'fiscal_year_end',
        'address_line1', 'address_line2', 'postal_code', 'city',
        'contact_name', 'contact_email', 'contact_phone', 'is_active',
    )
    for k in editable:
        if k not in data:
            continue
        v = data[k]
        if k == 'siren':
            v = _clean_siren(v)
            if v and len(v) != 9:
                return jsonify({'error': 'SIREN doit comporter 9 chiffres'}), 400
        elif k == 'is_active':
            v = bool(v)
        elif isinstance(v, str):
            v = v.strip() or None
        setattr(c, k, v)

    _log_audit('client.update', resource_type='client', resource_id=str(c.id))
    db.session.commit()
    return jsonify(_client_to_dict(c))


@api_bp.route('/api/clients/<client_id>', methods=['DELETE'])
@login_required
def delete_client(client_id):
    """Soft-delete : on passe is_active=false. Les runs liés restent rattachés."""
    c = _get_org_client_or_404(client_id)
    if not c:
        return jsonify({'error': 'Client introuvable'}), 404
    c.is_active = False
    _log_audit('client.delete', resource_type='client', resource_id=str(c.id))
    db.session.commit()
    return jsonify({'ok': True})


# ─── /api/dossiers (CRUD multi-tenant, rattaché à un Client) ─────
def _parse_date(s):
    if not s:
        return None
    from datetime import date
    try:
        # accepte "YYYY-MM-DD" (HTML date input) ou "DD/MM/YYYY"
        s = str(s).strip()
        if '/' in s:
            d, m, y = s.split('/')
            return date(int(y), int(m), int(d))
        y, m, d = s.split('-')
        return date(int(y), int(m), int(d))
    except Exception:
        return None


def _dossier_to_dict(d):
    return {
        'id': str(d.id),
        'client_id': str(d.client_id),
        'client_name': d.client.name if d.client else None,
        'label': d.label,
        'date_start': d.date_start.isoformat() if d.date_start else None,
        'date_end': d.date_end.isoformat() if d.date_end else None,
        'status': d.status,
        'is_active': d.is_active,
        'created_at': d.created_at.isoformat() if d.created_at else None,
    }


def _get_org_dossier_or_404(dossier_id):
    if not _is_uuid(dossier_id):
        return None
    return db.session.query(Dossier).filter(
        Dossier.id == dossier_id,
        Dossier.organization_id == current_user.organization_id,
    ).first()


@api_bp.route('/api/dossiers', methods=['GET'])
@login_required
def list_dossiers():
    """Liste tous les dossiers de l'org, ou ceux d'un client précis via ?client_id=<uuid>."""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    query = db.session.query(Dossier).filter(
        Dossier.organization_id == current_user.organization_id,
    )
    if not include_inactive:
        query = query.filter(Dossier.is_active.is_(True))

    client_filter = request.args.get('client_id')
    if client_filter and _is_uuid(client_filter):
        query = query.filter(Dossier.client_id == client_filter)

    dossiers = query.order_by(Dossier.label.desc()).all()
    return jsonify({
        'total': len(dossiers),
        'dossiers': [_dossier_to_dict(d) for d in dossiers],
    })


@api_bp.route('/api/dossiers', methods=['POST'])
@login_required
def create_dossier():
    data = request.get_json(silent=True) or {}
    client_id = (data.get('client_id') or '').strip()
    label = (data.get('label') or '').strip()

    if not label:
        return jsonify({'error': 'Label requis'}), 400
    if not client_id or not _is_uuid(client_id):
        return jsonify({'error': 'client_id requis'}), 400

    client = db.session.query(Client).filter(
        Client.id == client_id,
        Client.organization_id == current_user.organization_id,
        Client.is_active.is_(True),
    ).first()
    if not client:
        return jsonify({'error': 'Client introuvable'}), 404

    # Unicité du label dans le client
    existing = db.session.query(Dossier).filter(
        Dossier.client_id == client_id,
        Dossier.label == label,
        Dossier.is_active.is_(True),
    ).first()
    if existing:
        return jsonify({'error': 'Un dossier avec ce label existe déjà pour ce client'}), 409

    status = (data.get('status') or 'open').strip().lower()
    if status not in ('open', 'closed'):
        status = 'open'

    d = Dossier(
        organization_id=current_user.organization_id,
        client_id=client_id,
        label=label,
        date_start=_parse_date(data.get('date_start')),
        date_end=_parse_date(data.get('date_end')),
        status=status,
    )
    db.session.add(d)
    db.session.flush()
    _log_audit('dossier.create', resource_type='dossier', resource_id=str(d.id),
               meta={'label': label, 'client_id': client_id})
    db.session.commit()
    return jsonify(_dossier_to_dict(d)), 201


@api_bp.route('/api/dossiers/<dossier_id>', methods=['GET'])
@login_required
def get_dossier(dossier_id):
    d = _get_org_dossier_or_404(dossier_id)
    if not d:
        return jsonify({'error': 'Dossier introuvable'}), 404
    return jsonify(_dossier_to_dict(d))


@api_bp.route('/api/dossiers/<dossier_id>', methods=['PATCH'])
@login_required
def update_dossier(dossier_id):
    d = _get_org_dossier_or_404(dossier_id)
    if not d:
        return jsonify({'error': 'Dossier introuvable'}), 404

    data = request.get_json(silent=True) or {}
    if 'label' in data:
        lbl = (data['label'] or '').strip()
        if not lbl:
            return jsonify({'error': 'Label requis'}), 400
        d.label = lbl
    if 'date_start' in data:
        d.date_start = _parse_date(data['date_start'])
    if 'date_end' in data:
        d.date_end = _parse_date(data['date_end'])
    if 'status' in data:
        s = (data['status'] or '').strip().lower()
        if s in ('open', 'closed'):
            d.status = s
    if 'is_active' in data:
        d.is_active = bool(data['is_active'])

    _log_audit('dossier.update', resource_type='dossier', resource_id=str(d.id))
    db.session.commit()
    return jsonify(_dossier_to_dict(d))


@api_bp.route('/api/dossiers/<dossier_id>', methods=['DELETE'])
@login_required
def delete_dossier(dossier_id):
    d = _get_org_dossier_or_404(dossier_id)
    if not d:
        return jsonify({'error': 'Dossier introuvable'}), 404
    d.is_active = False
    _log_audit('dossier.delete', resource_type='dossier', resource_id=str(d.id))
    db.session.commit()
    return jsonify({'ok': True})


# ─── /api/plan-comptable ─────────────────────────────────────────
@api_bp.route('/api/plan-comptable', methods=['GET'])
@login_required
def get_plan_comptable():
    """Retourne le plan comptable PCG (sous-ensemble utile pour l'UI)."""
    return jsonify({
        'charges': COMPTES_CHARGES,
        'tva': COMPTES_TVA,
        'fournisseurs': COMPTES_FOURNISSEURS,
        'tresorerie': COMPTES_TRESORERIE,
    })
