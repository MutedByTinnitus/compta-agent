"""Modèle PasswordResetToken — token à usage unique pour reset mot de passe."""
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..extensions import db


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True),
                     ForeignKey('users.id', ondelete='CASCADE'),
                     nullable=False, index=True)

    # On stocke un hash du token, jamais le token en clair (defense en profondeur
    # au cas où la DB serait dumpée).
    token_hash = Column(String(255), unique=True, nullable=False, index=True)

    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))  # null si pas encore utilise
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship('User')
