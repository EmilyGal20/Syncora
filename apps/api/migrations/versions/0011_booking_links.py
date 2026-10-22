"""booking links and public meeting requests

Revision ID: 0011_booking_links
Revises: 0010_notes_calendar_outbox
"""

import sqlalchemy as sa
from alembic import op

revision = "0011_booking_links"
down_revision = "0010_notes_calendar_outbox"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "booking_links" not in tables:
        op.create_table(
            "booking_links",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
            sa.Column("kind", sa.String(20), nullable=False, index=True),
            sa.Column("slug", sa.String(80), nullable=False, unique=True, index=True),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("duration_minutes", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "booking_requests" not in tables:
        op.create_table(
            "booking_requests",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
            sa.Column("link_id", sa.String(36), sa.ForeignKey("booking_links.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("host_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("event_id", sa.String(36), sa.ForeignKey("events.id"), index=True),
            sa.Column("guest_token", sa.String(64), nullable=False, unique=True, index=True),
            sa.Column("guest_name", sa.String(160), nullable=False),
            sa.Column("guest_organization", sa.String(160), nullable=False),
            sa.Column("guest_email", sa.String(254)),
            sa.Column("guest_phone", sa.String(40)),
            sa.Column("reason", sa.String(240), nullable=False),
            sa.Column("notes", sa.Text(), nullable=False),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("timezone", sa.String(80), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, index=True),
            sa.Column("rejection_reason", sa.Text(), nullable=False),
            sa.Column("reminder_sent_at", sa.DateTime(timezone=True)),
            sa.Column("messages", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade():
    op.drop_table("booking_requests")
    op.drop_table("booking_links")
