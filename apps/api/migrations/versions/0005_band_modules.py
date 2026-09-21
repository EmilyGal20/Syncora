"""Add tenant-owned Band operational modules."""

import sqlalchemy as sa
from alembic import op

revision = "0005_band_modules"
down_revision = "0004_multitenant"
branch_labels = None
depends_on = None


def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    tables = {
        "band_shows": [
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("title", sa.String(180), nullable=False),
            sa.Column("venue", sa.String(180), nullable=False, server_default=""),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        ],
        "rehearsals": [
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("title", sa.String(180), nullable=False),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("location", sa.String(180), nullable=False, server_default=""),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        ],
        "songs": [
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("title", sa.String(180), nullable=False),
            sa.Column("artist", sa.String(180), nullable=False, server_default=""),
            sa.Column("musical_key", sa.String(20), nullable=False, server_default=""),
            sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        ],
        "equipment": [
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("name", sa.String(180), nullable=False),
            sa.Column("category", sa.String(80), nullable=False, server_default=""),
            sa.Column("status", sa.String(30), nullable=False, server_default="available"),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        ],
        "expenses": [
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("description", sa.String(200), nullable=False),
            sa.Column("amount_minor", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
            sa.Column("incurred_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        ],
    }
    for name, columns in tables.items():
        if name not in existing:
            op.create_table(name, *columns)
            op.create_index(f"ix_{name}_organization_id", name, ["organization_id"])
    if "setlists" not in existing:
        op.create_table(
            "setlists",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("title", sa.String(180), nullable=False),
            sa.Column("show_id", sa.String(36), sa.ForeignKey("band_shows.id")),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_setlists_organization_id", "setlists", ["organization_id"])
    if "setlist_items" not in existing:
        op.create_table(
            "setlist_items",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("setlist_id", sa.String(36), sa.ForeignKey("setlists.id", ondelete="CASCADE"), nullable=False),
            sa.Column("song_id", sa.String(36), sa.ForeignKey("songs.id")),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("item_type", sa.String(20), nullable=False, server_default="song"),
            sa.Column("label", sa.String(180), nullable=False, server_default=""),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        )
        op.create_index("ix_setlist_items_setlist_id", "setlist_items", ["setlist_id"])


def downgrade():
    for name in ["setlist_items", "setlists", "expenses", "equipment", "songs", "rehearsals", "band_shows"]:
        op.drop_table(name)
