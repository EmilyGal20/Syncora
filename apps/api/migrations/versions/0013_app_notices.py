"""app install notices

Revision ID: 0013_app_notices
Revises: 0012_install_prompt
"""

import sqlalchemy as sa
from alembic import op

revision = "0013_app_notices"
down_revision = "0012_install_prompt"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "app_notices" in inspector.get_table_names():
        return
    op.create_table(
        "app_notices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("audience", sa.String(20), nullable=False, server_default="organization"),
        sa.Column("target_ids", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "app_notices" in inspector.get_table_names():
        op.drop_table("app_notices")
