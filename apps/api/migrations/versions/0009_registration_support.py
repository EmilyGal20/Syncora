"""registration approval and support center

Revision ID: 0009_registration_support
Revises: 0008_sqlite_optional_email
"""

import sqlalchemy as sa
from alembic import op

revision = "0009_registration_support"
down_revision = "0008_sqlite_optional_email"
branch_labels = None
depends_on = None


def upgrade():
    # The historical initial migration builds from current metadata. A fresh
    # database therefore already contains these tables before reaching 0009.
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    phase_tables = {
        "registration_requests",
        "registration_review_events",
        "band_member_profiles",
        "support_tickets",
        "support_messages",
    }
    if phase_tables.issubset(existing):
        return

    op.create_table(
        "registration_requests",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("desired_username", sa.String(80), nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("first_name", sa.String(80), nullable=False), sa.Column("last_name", sa.String(80), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False), sa.Column("email", sa.String(254), index=True), sa.Column("phone", sa.String(40)),
        sa.Column("preferred_locale", sa.String(12), nullable=False), sa.Column("timezone", sa.String(80), nullable=False),
        sa.Column("workspace_mode", sa.String(20), nullable=False), sa.Column("workspace_type", sa.String(30), nullable=False),
        sa.Column("requested_workspace_name", sa.String(160), nullable=False, index=True), sa.Column("requested_role", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False), sa.Column("details", sa.JSON(), nullable=False), sa.Column("status", sa.String(20), nullable=False, index=True),
        sa.Column("resolved_organization_id", sa.String(36), sa.ForeignKey("organizations.id"), index=True), sa.Column("reviewed_by", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)), sa.Column("applicant_response", sa.Text(), nullable=False), sa.Column("internal_note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "registration_review_events",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("request_id", sa.String(36), sa.ForeignKey("registration_requests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id")), sa.Column("action", sa.String(40), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "band_member_profiles",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("stage_name", sa.String(160), nullable=False), sa.Column("instruments", sa.JSON(), nullable=False),
        sa.Column("band_role", sa.String(120), nullable=False), sa.Column("public_details", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), index=True),
        sa.Column("requester_user_id", sa.String(36), sa.ForeignKey("users.id"), index=True), sa.Column("requester_name", sa.String(160), nullable=False),
        sa.Column("contact", sa.String(254)), sa.Column("guest_token_hash", sa.String(64), unique=True), sa.Column("category", sa.String(40), nullable=False, index=True),
        sa.Column("subject", sa.String(180), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("status", sa.String(30), nullable=False, index=True),
        sa.Column("priority", sa.String(20), nullable=False), sa.Column("current_route", sa.String(240)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "support_messages",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("ticket_id", sa.String(36), sa.ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("author_user_id", sa.String(36), sa.ForeignKey("users.id")), sa.Column("author_name", sa.String(160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False), sa.Column("is_internal", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("support_messages")
    op.drop_table("support_tickets")
    op.drop_table("band_member_profiles")
    op.drop_table("registration_review_events")
    op.drop_table("registration_requests")
