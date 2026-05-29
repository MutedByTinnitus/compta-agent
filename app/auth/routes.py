"""Routes d'auth : signup, login, logout, /api/me."""
import os
from datetime import datetime

from flask import (
    Blueprint, request, render_template, redirect, url_for,
    jsonify, current_app,
)
from flask_login import (
    login_user, logout_user, login_required, current_user,
)
from email_validator import validate_email, EmailNotValidError

from ..extensions import db
from ..models.user import User
from ..models.organization import Organization
from ..models.audit_log import AuditLog
from .security import (
    hash_password, verify_password,
    is_locked_out, record_failed_attempt, clear_attempts,
)

auth_bp = Blueprint('auth', __name__)


def _log_audit(action, org_id=None, user_id=None, meta=None,
               resource_type=None, resource_id=None):
    db.session.add(AuditLog(
        organization_id=org_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=request.remote_addr,
        meta=meta or {},
    ))


# ── SIGNUP ────────────────────────────────────────────────────────
@auth_bp.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template('signup.html')

    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    first_name = (request.form.get('first_name') or '').strip()
    last_name = (request.form.get('last_name') or '').strip()
    cabinet = (request.form.get('cabinet') or '').strip()
    siret = (request.form.get('siret') or '').strip() or None

    try:
        validate_email(email)
    except EmailNotValidError as e:
        return render_template('signup.html', error=f'Email invalide : {e}'), 400
    if len(password) < 8:
        return render_template('signup.html', error='Mot de passe : 8 caractères minimum'), 400
    if not cabinet:
        return render_template('signup.html', error='Nom du cabinet requis'), 400

    try:
        if db.session.query(User).filter(User.email == email).first():
            return render_template('signup.html', error='Email déjà utilisé'), 400

        org = Organization(name=cabinet, siret=siret, plan='beta')
        db.session.add(org)
        db.session.flush()

        user = User(
            organization_id=org.id,
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            role='admin',
        )
        db.session.add(user)
        db.session.flush()
        _log_audit('signup.success',
                   org_id=org.id, user_id=user.id,
                   resource_type='organization', resource_id=str(org.id))
        db.session.commit()

        login_user(user, remember=True)
        return redirect(url_for('index'))

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Signup error")
        return render_template('signup.html',
                               error=f"Erreur : {str(e)[:200]}"), 500


# ── LOGIN ─────────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    ip = request.remote_addr or 'unknown'

    if is_locked_out(ip):
        return render_template(
            'login.html',
            error='Trop de tentatives. Réessayez dans 5 minutes.',
        ), 429

    email = (request.form.get('email') or request.form.get('username') or '').strip().lower()
    password = request.form.get('password') or ''

    # Legacy admin/plain (transition) — activé via ALLOW_LEGACY_ADMIN=true
    if os.environ.get('ALLOW_LEGACY_ADMIN', 'false').lower() == 'true':
        legacy_user = os.environ.get('APP_USERNAME', 'admin')
        legacy_pass = os.environ.get('APP_PASSWORD', 'changeme')
        if email == legacy_user.lower() and password == legacy_pass:
            user = _get_or_create_legacy_user(password)
            user.last_login = datetime.utcnow()
            _log_audit('login.success.legacy',
                       org_id=user.organization_id, user_id=user.id)
            db.session.commit()
            clear_attempts(ip)
            login_user(user, remember=True)
            return redirect(url_for('index'))

    user = db.session.query(User).filter(
        User.email == email,
        User.is_active.is_(True),
    ).first()

    if not user or not verify_password(password, user.password_hash):
        record_failed_attempt(ip)
        _log_audit('login.failed', meta={'email': email})
        db.session.commit()
        return render_template('login.html', error='Identifiants invalides'), 401

    user.last_login = datetime.utcnow()
    _log_audit('login.success',
               org_id=user.organization_id, user_id=user.id)
    db.session.commit()
    clear_attempts(ip)

    login_user(user, remember=True)
    return redirect(url_for('index'))


def _get_or_create_legacy_user(password):
    """Pour le mode ALLOW_LEGACY_ADMIN : un user 'legacy@enop.ai' dans org 'Legacy Admin'."""
    user = db.session.query(User).filter(User.email == 'legacy@enop.ai').first()
    if user:
        return user
    org = db.session.query(Organization).filter(
        Organization.name == 'Legacy Admin'
    ).first()
    if not org:
        org = Organization(name='Legacy Admin', plan='beta')
        db.session.add(org)
        db.session.flush()
    user = User(
        organization_id=org.id,
        email='legacy@enop.ai',
        password_hash=hash_password(password),
        first_name='Legacy', last_name='Admin',
        role='admin',
    )
    db.session.add(user)
    db.session.flush()
    return user


# ── LOGOUT ────────────────────────────────────────────────────────
# ── PASSWORD RESET ────────────────────────────────────────────────
@auth_bp.route('/reset-password/request', methods=['GET', 'POST'])
def reset_password_request():
    """Etape 1 : l'utilisateur saisit son email.
    On genere un token, on logue l'URL complete (pas d'email en beta).
    On retourne TOUJOURS le meme message (anti-enumeration d'emails)."""
    if request.method == 'GET':
        return render_template('reset_password_request.html')

    email = (request.form.get('email') or '').strip().lower()
    if not email:
        return render_template('reset_password_request.html',
                               error='Email requis'), 400

    user = db.session.query(User).filter(
        User.email == email, User.is_active.is_(True)
    ).first()

    if user:
        from .security import generate_reset_token, hash_reset_token
        from ..models.password_reset import PasswordResetToken
        from datetime import datetime, timedelta

        # Invalider les anciens tokens non-utilises de ce user
        old = db.session.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).all()
        for t in old:
            t.used_at = datetime.utcnow()

        token = generate_reset_token()
        prt = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(token),
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.session.add(prt)
        _log_audit('password.reset.request', user_id=user.id,
                   org_id=user.organization_id,
                   meta={'email': email})
        db.session.commit()

        # Log l'URL complete (visible par toi seulement dans Portainer logs)
        reset_url = url_for('auth.reset_password_confirm',
                            token=token, _external=True)
        current_app.logger.warning(
            f"[PWD-RESET] User={email} | URL={reset_url} | expire 1h"
        )
    else:
        # On simule un delai pour eviter le timing attack
        import time
        time.sleep(0.1)

    # Reponse identique dans tous les cas
    return render_template('reset_password_request.html',
                           success="Si l'email existe, un lien de réinitialisation a été généré.")


@auth_bp.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password_confirm(token):
    """Etape 2 : avec un token valide, l'utilisateur choisit un nouveau mot de passe."""
    from .security import hash_reset_token
    from ..models.password_reset import PasswordResetToken
    from datetime import datetime

    token_hash = hash_reset_token(token)
    prt = db.session.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > datetime.utcnow(),
    ).first()

    if not prt:
        return render_template('reset_password_confirm.html',
                               token=token,
                               error='Lien invalide ou expiré. Demandez un nouveau lien.'), 400

    if request.method == 'GET':
        return render_template('reset_password_confirm.html', token=token)

    new_pw = request.form.get('password') or ''
    confirm = request.form.get('confirm') or ''

    if len(new_pw) < 8:
        return render_template('reset_password_confirm.html', token=token,
                               error='Mot de passe : 8 caractères minimum'), 400
    if new_pw != confirm:
        return render_template('reset_password_confirm.html', token=token,
                               error='La confirmation ne correspond pas'), 400

    user = prt.user
    user.password_hash = hash_password(new_pw)
    prt.used_at = datetime.utcnow()
    _log_audit('password.reset.success', user_id=user.id,
               org_id=user.organization_id)
    db.session.commit()

    return render_template('reset_password_confirm.html', token=None,
                           success='Mot de passe mis à jour. Vous pouvez vous connecter.')


@auth_bp.route('/logout')
@login_required
def logout():
    _log_audit('logout',
               org_id=current_user.organization_id,
               user_id=current_user.id)
    db.session.commit()
    logout_user()
    return redirect(url_for('index'))  # retour landing publique


# ── /api/me ───────────────────────────────────────────────────────
@auth_bp.route('/api/me', methods=['GET'])
@login_required
def me():
    org = current_user.organization
    return jsonify({
        'id': str(current_user.id),
        'email': current_user.email,
        'name': current_user.display_name,
        'first_name': current_user.first_name,
        'last_name': current_user.last_name,
        'org_id': str(current_user.organization_id),
        'org_name': org.name,
        'org_siret': org.siret,
        'org_plan': org.plan,
        'role': current_user.role,
    })


@auth_bp.route('/api/me', methods=['PATCH'])
@login_required
def update_me():
    """Modifier nom/prénom/email de l'utilisateur courant."""
    data = request.get_json(silent=True) or {}
    first_name = (data.get('first_name') or '').strip() or None
    last_name = (data.get('last_name') or '').strip() or None
    email_raw = (data.get('email') or '').strip().lower()

    if email_raw and email_raw != current_user.email:
        try:
            validate_email(email_raw)
        except EmailNotValidError as e:
            return jsonify({'error': f'Email invalide : {e}'}), 400
        # Unicité
        if db.session.query(User.id).filter(
            User.email == email_raw, User.id != current_user.id
        ).first():
            return jsonify({'error': 'Email déjà utilisé par un autre compte'}), 409
        current_user.email = email_raw

    current_user.first_name = first_name
    current_user.last_name = last_name
    _log_audit('user.update',
               org_id=current_user.organization_id, user_id=current_user.id)
    db.session.commit()

    return jsonify({
        'id': str(current_user.id),
        'email': current_user.email,
        'name': current_user.display_name,
        'first_name': current_user.first_name,
        'last_name': current_user.last_name,
    })


@auth_bp.route('/api/me/password', methods=['POST'])
@login_required
def change_password():
    """Change le mot de passe en exigeant l'ancien."""
    data = request.get_json(silent=True) or {}
    current_pw = data.get('current_password') or ''
    new_pw = data.get('new_password') or ''

    if not verify_password(current_pw, current_user.password_hash):
        _log_audit('password.change.failed',
                   org_id=current_user.organization_id, user_id=current_user.id)
        db.session.commit()
        return jsonify({'error': 'Mot de passe actuel incorrect'}), 401

    if len(new_pw) < 8:
        return jsonify({'error': 'Le nouveau mot de passe doit faire 8 caractères minimum'}), 400
    if new_pw == current_pw:
        return jsonify({'error': 'Le nouveau mot de passe doit être différent'}), 400

    current_user.password_hash = hash_password(new_pw)
    _log_audit('password.change.success',
               org_id=current_user.organization_id, user_id=current_user.id)
    db.session.commit()
    return jsonify({'ok': True})


@auth_bp.route('/api/organization', methods=['GET'])
@login_required
def get_organization():
    org = current_user.organization
    return jsonify({
        'id': str(org.id),
        'name': org.name,
        'siret': org.siret,
        'plan': org.plan,
        'created_at': org.created_at.isoformat() if org.created_at else None,
    })


@auth_bp.route('/api/organization', methods=['PATCH'])
@login_required
def update_organization():
    """Modifier nom + SIRET du cabinet. Réservé aux admins."""
    if current_user.role != 'admin':
        return jsonify({'error': 'Réservé aux administrateurs du cabinet'}), 403

    org = current_user.organization
    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = (data['name'] or '').strip()
        if not name:
            return jsonify({'error': 'Nom du cabinet requis'}), 400
        org.name = name

    if 'siret' in data:
        siret_raw = data['siret']
        if siret_raw is None or siret_raw == '':
            org.siret = None
        else:
            digits = ''.join(ch for ch in str(siret_raw) if ch.isdigit())
            if len(digits) not in (0, 14):
                return jsonify({'error': 'SIRET doit comporter 14 chiffres'}), 400
            org.siret = digits or None

    _log_audit('organization.update',
               org_id=org.id, user_id=current_user.id,
               resource_type='organization', resource_id=str(org.id))
    db.session.commit()

    return jsonify({
        'id': str(org.id),
        'name': org.name,
        'siret': org.siret,
        'plan': org.plan,
    })
