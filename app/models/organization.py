"""Modèle Organization — un cabinet comptable = un tenant isolé."""
import uuid

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..extensions import db


class Organization(db.Model):
    __tablename__ = 'organizations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    siret = Column(String(20), nullable=True)
    plan = Column(String(50), default='beta')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship('User', back_populates='organization',
                         cascade='all, delete-orphan')
    runs = relationship('Run', back_populates='organization',
                        cascade='all, delete-orphan')

    def __repr__(self):
        return f"<Organization {self.name}>"
