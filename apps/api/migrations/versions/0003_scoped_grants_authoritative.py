"""Make scoped access grants authoritative and backfill legacy role permissions."""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0003_scoped_grants"
down_revision = "0002_phase2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("""
        SELECT r.organization_id, rp.role_id, rp.permission_id
        FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        LEFT JOIN access_grants ag ON ag.organization_id = r.organization_id
          AND ag.principal_type = 'role' AND ag.principal_id = rp.role_id
          AND ag.permission_id = rp.permission_id
        WHERE ag.id IS NULL
    """)
    ).mappings()
    now = datetime.now(UTC)
    for row in rows:
        bind.execute(
            sa.text("""
            INSERT INTO access_grants
              (id, organization_id, principal_type, principal_id, permission_id, scope, effect, created_at, updated_at)
            VALUES (:id, :organization_id, 'role', :role_id, :permission_id, 'OWN', 'allow', :created_at, :updated_at)
        """),
            {"id": str(uuid4()), **row, "created_at": now, "updated_at": now},
        )


def downgrade():
    # Legacy role_permissions remain intact, so no destructive downgrade is needed.
    pass
