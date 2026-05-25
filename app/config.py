"""Configuration centrale Flask."""
import os
from datetime import timedelta


def configure_app(app, override=None):
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_secret_change_me')

    # Base de données : si DATABASE_URL absent, fallback SQLite local (utile pour Alembic offline)
    db_url = os.environ.get('DATABASE_URL', 'sqlite:///enop_local.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 280,
    }

    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=2)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    # SESSION_COOKIE_SECURE = True quand on sera en HTTPS prod
    app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', '').lower() == 'true'

    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB upload

    if override:
        app.config.update(override)
