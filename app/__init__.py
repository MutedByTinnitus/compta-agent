"""Flask app factory."""
import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, render_template, redirect, url_for
from flask_login import current_user

load_dotenv()


def create_app(config_override=None):
    # static_folder = ../static, template_folder = ./templates (du package app)
    base_dir = Path(__file__).resolve().parent.parent
    app = Flask(
        __name__,
        template_folder=str(base_dir / 'templates'),
        static_folder=str(base_dir / 'static'),
    )

    # Configuration
    from .config import configure_app
    configure_app(app, config_override)

    # Logging basique (le pipeline OCR a son propre logger via ocr_engine)
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    )

    # Extensions (db + login_manager)
    from .extensions import init_extensions
    init_extensions(app)

    # Importer les modèles pour qu'Alembic les détecte
    from . import models  # noqa: F401

    # Middleware sécurité (CSP, CSRF, headers) — réutilise les fonctions du moteur OCR
    _register_security_middleware(app)

    # Blueprints
    from .auth.routes import auth_bp
    app.register_blueprint(auth_bp)

    from .routes_api import api_bp
    app.register_blueprint(api_bp)

    # Routes principales : / et /legacy
    @app.route('/')
    def index():
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        from .auth.security import generate_csrf_token
        return render_template('app.html', csrf_token=generate_csrf_token())

    @app.route('/legacy')
    def index_legacy():
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        from .auth.security import generate_csrf_token
        return render_template('_legacy/index.html', csrf_token=generate_csrf_token())

    return app


def _register_security_middleware(app):
    """Headers de sécurité + CSRF check sur les POST."""
    from flask import request, session, abort
    from .auth.security import validate_csrf

    @app.before_request
    def _csrf_guard():
        # CSRF sur les POST (sauf login, signup, webhook)
        if request.method != 'POST':
            return
        if request.path in ('/login', '/signup', '/api/webhook'):
            return
        if not session.get('_user_id'):  # Flask-Login pose _user_id en session
            return
        token = (request.form.get('csrf_token')
                 or request.headers.get('X-CSRF-Token')
                 or '')
        if not validate_csrf(token):
            abort(403)

    @app.after_request
    def _security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        # CSP : autorise React + Babel standalone depuis unpkg.com
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'"
        )
        if request.path.startswith('/api/download'):
            response.headers['Cache-Control'] = 'no-store'
        return response
