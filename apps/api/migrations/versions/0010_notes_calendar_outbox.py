"""notes, calendar presentation metadata, and outbox foundation

Revision ID: 0010_notes_calendar_outbox
Revises: 0009_registration_support
"""

import sqlalchemy as sa
from alembic import op

revision = "0010_notes_calendar_outbox"
down_revision = "0009_registration_support"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    event_columns = {column["name"] for column in inspector.get_columns("events")}
    with op.batch_alter_table("events") as batch:
        if "color_key" not in event_columns:
            batch.add_column(sa.Column("color_key", sa.String(20), nullable=False, server_default="blue"))
        if "event_type" not in event_columns:
            batch.add_column(sa.Column("event_type", sa.String(30), nullable=False, server_default="general"))
        if "timezone" not in event_columns:
            batch.add_column(sa.Column("timezone", sa.String(80), nullable=False, server_default="UTC"))
    if "notes" not in tables:
        op.create_table(
            "notes",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("visibility", sa.String(20), nullable=False),
            sa.Column("pinned", sa.Boolean(), nullable=False),
            sa.Column("archived_at", sa.DateTime(timezone=True)),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_notes_organization_id", "notes", ["organization_id"])
        op.create_index("ix_notes_owner_user_id", "notes", ["owner_user_id"])
        op.create_index("ix_notes_visibility", "notes", ["visibility"])
        op.create_index("ix_notes_pinned", "notes", ["pinned"])
        op.create_index("ix_notes_archived_at", "notes", ["archived_at"])
    if "domain_outbox" not in tables:
        op.create_table(
            "domain_outbox",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("event_type", sa.String(100), nullable=False),
            sa.Column("aggregate_type", sa.String(80), nullable=False),
            sa.Column("aggregate_id", sa.String(36), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("processed_at", sa.DateTime(timezone=True)),
            sa.Column("attempts", sa.Integer(), nullable=False),
        )
        op.create_index("ix_domain_outbox_organization_id", "domain_outbox", ["organization_id"])
        op.create_index("ix_domain_outbox_event_type", "domain_outbox", ["event_type"])
        op.create_index("ix_domain_outbox_aggregate_id", "domain_outbox", ["aggregate_id"])
        op.create_index("ix_domain_outbox_processed_at", "domain_outbox", ["processed_at"])


def downgrade():
    op.drop_table("domain_outbox")
    op.drop_table("notes")
    with op.batch_alter_table("events") as batch:
        batch.drop_column("timezone")
        batch.drop_column("event_type")
        batch.drop_column("color_key")
