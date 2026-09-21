"""Normalize reusable file attachments."""

import sqlalchemy as sa
from alembic import op

revision = "0006_file_attachments"
down_revision = "0005_band_modules"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "file_attachments" in inspector.get_table_names():
        return
    op.create_table(
        "file_attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("file_id", sa.String(36), sa.ForeignKey("stored_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("context_type", sa.String(40), nullable=False),
        sa.Column("context_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("file_id", "context_type", "context_id"),
    )
    op.create_index("ix_file_attachments_organization_id", "file_attachments", ["organization_id"])
    op.create_index("ix_file_attachments_file_id", "file_attachments", ["file_id"])
    op.create_index("ix_file_attachments_context_id", "file_attachments", ["context_id"])


def downgrade():
    op.drop_table("file_attachments")
