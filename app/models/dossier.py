"""Modèle Dossier — exercice comptable d'un client."""
import uuid

from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..extensions import db


class Dossier(db.Model):
    __tablename__ = 'dossiers'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Tenant : redondant avec client.organization_id mais évite un join pour les filtres
    organization_id = Column(UUID(as_uuid=True),
                             ForeignKey('organizations.id', ondelete='CASCADE'),
                             nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True),
                       ForeignKey('clients.id', ondelete='CASCADE'),
                       nullable=False, index=True)

    label = Column(String(150), nullable=False)   # ex "Exercice 2025"
    date_start = Column(Date)
    date_end = Column(Date)
    status = Column(String(20), default='open')   # open | closed

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    client = relationship('Client', back_populates='dossiers')
    runs = relationship('Run', back_populates='dossier')

    __table_args__ = (
        Index('ix_dossiers_client_label', 'client_id', 'label'),
    )
