"""Modèle Run — historique des traitements OCR."""
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..extensions import db


class Run(db.Model):
    __tablename__ = 'runs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True),
                             ForeignKey('organizations.id', ondelete='CASCADE'),
                             nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    # Société cliente rattachée (optionnel : null = "Non classé")
    client_id = Column(UUID(as_uuid=True),
                       ForeignKey('clients.id', ondelete='SET NULL'),
                       nullable=True, index=True)
    # Dossier (exercice comptable) optionnel
    dossier_id = Column(UUID(as_uuid=True),
                        ForeignKey('dossiers.id', ondelete='SET NULL'),
                        nullable=True, index=True)

    # Liens vers le système de fichiers legacy (transition douce)
    legacy_job_id = Column(String(64), unique=True, index=True)
    legacy_run_id = Column(String(64), index=True)

    filenames = Column(JSONB, default=list)
    status = Column(String(50), default='pending')  # pending | running | done | failed

    pages_total = Column(Integer, default=0)
    tickets_good = Column(Integer, default=0)
    tickets_doubtful = Column(Integer, default=0)
    tickets_unreadable = Column(Integer, default=0)

    excel_path = Column(String(500))
    rescan_pdf_path = Column(String(500))
    snapshot = Column(JSONB, default=dict)

    cost_eur = Column(Numeric(10, 4))
    cost_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))

    organization = relationship('Organization', back_populates='runs')
    client = relationship('Client', back_populates='runs')
    dossier = relationship('Dossier', back_populates='runs')

    __table_args__ = (
        Index('ix_runs_org_created', 'organization_id', 'created_at'),
    )
