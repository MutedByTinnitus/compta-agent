"""baseline + clients

Cette migration crée TOUT le schéma initial :
- organizations
- users
- runs
- audit_logs
- clients (et la colonne runs.client_id)

Idempotente : si les tables initiales existent déjà (cas dev local où
la DB avait déjà ces tables avant qu'on remette Alembic en route),
on saute leur création et on va directement à 'clients'.

Revision ID: 3d6d1fec4257
Revises:
Create Date: 2026-05-25 16:05:17.893631

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d6d1fec4257'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(bind, name: str) -> bool:
    insp = sa.inspect(bind)
    return name in insp.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    # ── 1. organizations ────────────────────────────────────────
    if not _table_exists(bind, 'organizations'):
        op.create_table(
            'organizations',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('siret', sa.String(length=20), nullable=True),
            sa.Column('plan', sa.String(length=50), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )

    # ── 2. users ────────────────────────────────────────────────
    if not _table_exists(bind, 'users'):
        op.create_table(
            'users',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('organization_id', sa.UUID(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('first_name', sa.String(length=100), nullable=True),
            sa.Column('last_name', sa.String(length=100), nullable=True),
            sa.Column('role', sa.String(length=50), nullable=True),
            sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'],
                                    ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('email'),
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
        op.create_index(op.f('ix_users_organization_id'), 'users',
                        ['organization_id'], unique=False)

    # ── 3. runs ─────────────────────────────────────────────────
    if not _table_exists(bind, 'runs'):
        op.create_table(
            'runs',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('organization_id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('legacy_job_id', sa.String(length=64), nullable=True),
            sa.Column('legacy_run_id', sa.String(length=64), nullable=True),
            sa.Column('filenames', sa.dialects.postgresql.JSONB(), nullable=True),
            sa.Column('status', sa.String(length=50), nullable=True),
            sa.Column('pages_total', sa.Integer(), nullable=True),
            sa.Column('tickets_good', sa.Integer(), nullable=True),
            sa.Column('tickets_doubtful', sa.Integer(), nullable=True),
            sa.Column('tickets_unreadable', sa.Integer(), nullable=True),
            sa.Column('excel_path', sa.String(length=500), nullable=True),
            sa.Column('rescan_pdf_path', sa.String(length=500), nullable=True),
            sa.Column('snapshot', sa.dialects.postgresql.JSONB(), nullable=True),
            sa.Column('cost_eur', sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column('cost_data', sa.dialects.postgresql.JSONB(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'],
                                    ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('legacy_job_id'),
        )
        op.create_index('ix_runs_org_created', 'runs',
                        ['organization_id', 'created_at'], unique=False)
        op.create_index(op.f('ix_runs_created_at'), 'runs',
                        ['created_at'], unique=False)
        op.create_index(op.f('ix_runs_legacy_job_id'), 'runs',
                        ['legacy_job_id'], unique=False)
        op.create_index(op.f('ix_runs_legacy_run_id'), 'runs',
                        ['legacy_run_id'], unique=False)
        op.create_index(op.f('ix_runs_organization_id'), 'runs',
                        ['organization_id'], unique=False)

    # ── 4. audit_logs ───────────────────────────────────────────
    if not _table_exists(bind, 'audit_logs'):
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('organization_id', sa.UUID(), nullable=True),
            sa.Column('user_id', sa.UUID(), nullable=True),
            sa.Column('action', sa.String(length=100), nullable=False),
            sa.Column('resource_type', sa.String(length=50), nullable=True),
            sa.Column('resource_id', sa.String(length=100), nullable=True),
            sa.Column('ip_address', sa.String(length=45), nullable=True),
            sa.Column('metadata', sa.dialects.postgresql.JSONB(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs',
                        ['created_at'], unique=False)
        op.create_index(op.f('ix_audit_logs_organization_id'), 'audit_logs',
                        ['organization_id'], unique=False)

    # ── 5. clients (toujours créée par cette migration) ─────────
    if not _table_exists(bind, 'clients'):
        op.create_table(
            'clients',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('organization_id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('siren', sa.String(length=20), nullable=True),
            sa.Column('legal_form', sa.String(length=50), nullable=True),
            sa.Column('fiscal_year_end', sa.String(length=5), nullable=True),
            sa.Column('address_line1', sa.String(length=255), nullable=True),
            sa.Column('address_line2', sa.String(length=255), nullable=True),
            sa.Column('postal_code', sa.String(length=20), nullable=True),
            sa.Column('city', sa.String(length=120), nullable=True),
            sa.Column('contact_name', sa.String(length=255), nullable=True),
            sa.Column('contact_email', sa.String(length=255), nullable=True),
            sa.Column('contact_phone', sa.String(length=40), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'],
                                    ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_clients_org_name', 'clients',
                        ['organization_id', 'name'], unique=False)
        op.create_index(op.f('ix_clients_organization_id'), 'clients',
                        ['organization_id'], unique=False)

    # ── 6. ajout colonne runs.client_id (idempotent) ────────────
    insp = sa.inspect(bind)
    runs_cols = [c['name'] for c in insp.get_columns('runs')]
    if 'client_id' not in runs_cols:
        op.add_column('runs', sa.Column('client_id', sa.UUID(), nullable=True))
        op.create_index(op.f('ix_runs_client_id'), 'runs',
                        ['client_id'], unique=False)
        op.create_foreign_key('runs_client_id_fkey', 'runs', 'clients',
                              ['client_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Downgrade : on enlève uniquement ce qu'on a ajouté de neuf (clients + client_id).
    # On NE supprime PAS les tables initiales (organizations/users/runs/audit_logs)
    # car elles sont la baseline de l'app.
    op.drop_constraint('runs_client_id_fkey', 'runs', type_='foreignkey')
    op.drop_index(op.f('ix_runs_client_id'), table_name='runs')
    op.drop_column('runs', 'client_id')
    op.drop_index(op.f('ix_clients_organization_id'), table_name='clients')
    op.drop_index('ix_clients_org_name', table_name='clients')
    op.drop_table('clients')
