"""Helpers de sécurité : bcrypt, anti-bruteforce, CSRF."""
import hmac
import json
import secrets
from datetime import datetime, timedelta
from pathlib import Path

import bcrypt
from flask import session

LOGIN_ATTEMPTS_FILE = Path('login_attempts.json')
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300


# ── Password hashing ──────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt(rounds=12),
    ).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode('utf-8'),
            password_hash.encode('utf-8'),
        )
    except Exception:
        return False


# ── CSRF ──────────────────────────────────────────────────────────
def generate_csrf_token() -> str:
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def validate_csrf(token: str) -> bool:
    return hmac.compare_digest(token or '', session.get('csrf_token', ''))


# ── Anti-bruteforce (file-based, identique à l'ancien comportement) ──
def _load_attempts():
    if not LOGIN_ATTEMPTS_FILE.exists():
        return {}
    try:
        raw = json.loads(LOGIN_ATTEMPTS_FILE.read_text(encoding='utf-8'))
        out = {}
        for ip, val in raw.items():
            count, lockout_iso = val
            out[ip] = [count, datetime.fromisoformat(lockout_iso) if lockout_iso else None]
        return out
    except Exception:
        return {}


def _save_attempts(attempts):
    data = {}
    for ip, val in attempts.items():
        count, lockout = val
        data[ip] = [count, lockout.isoformat() if lockout else None]
    LOGIN_ATTEMPTS_FILE.write_text(json.dumps(data, indent=2), encoding='utf-8')


def is_locked_out(ip: str) -> bool:
    attempts = _load_attempts()
    if ip not in attempts:
        return False
    count, lockout = attempts[ip]
    if lockout and datetime.now() < lockout:
        return True
    if lockout and datetime.now() >= lockout:
        del attempts[ip]
        _save_attempts(attempts)
    return False


def record_failed_attempt(ip: str):
    attempts = _load_attempts()
    if ip not in attempts:
        attempts[ip] = [0, None]
    attempts[ip][0] += 1
    if attempts[ip][0] >= MAX_LOGIN_ATTEMPTS:
        attempts[ip][1] = datetime.now() + timedelta(seconds=LOCKOUT_DURATION_SECONDS)
    _save_attempts(attempts)


def clear_attempts(ip: str):
    attempts = _load_attempts()
    if ip in attempts:
        del attempts[ip]
        _save_attempts(attempts)
