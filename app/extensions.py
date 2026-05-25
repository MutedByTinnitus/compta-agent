"""Singletons d'extensions Flask (db, login_manager)."""
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

db = SQLAlchemy()
login_manager = LoginManager()


def init_extensions(app):
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Veuillez vous connecter.'
    login_manager.session_protection = 'strong'

    # Import différé pour éviter les imports circulaires
    from .models.user import User

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return db.session.get(User, user_id)
        except Exception:
            return None
