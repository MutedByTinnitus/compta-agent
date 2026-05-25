"""Modèle AuditLog — traçabilité des actions."""
import uuid

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from ..extensions import db


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(String(100))
    ip_address = Column(String(45))
    # 'metadata' est réservé en SQLAlchemy declarative → on map vers 'meta'
    meta = Column('metadata', JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
