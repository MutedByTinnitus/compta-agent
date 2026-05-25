"""Modèle Client — société cliente d'un cabinet comptable."""
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..extensions import db


class Client(db.Model):
    __tablename__ = 'clients'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True),
                             ForeignKey('organizations.id', ondelete='CASCADE'),
                             nullable=False, index=True)

    name = Column(String(255), nullable=False)
    siren = Column(String(20))           # 9 chiffres (sans espaces) ou null
    legal_form = Column(String(50))      # SARL / SAS / SCI / SA / EI / micro / autre
    fiscal_year_end = Column(String(5))  # "31/12" par ex.

    # Adresse
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    postal_code = Column(String(20))
    city = Column(String(120))

    # Contact référent côté client
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(40))

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship('Organization')
    runs = relationship('Run', back_populates='client')
    dossiers = relationship('Dossier', back_populates='client',
                            cascade='all, delete-orphan')

    __table_args__ = (
        Index('ix_clients_org_name', 'organization_id', 'name'),
    )
