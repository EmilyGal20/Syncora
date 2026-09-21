"""Add explicit workspace administration, branding, and secure files."""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0004_multitenant"
down_revision = "0003_scoped_grants"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    table_names = inspector.get_table_names()

    def columns(table):
        return {column["name"] for column in sa.inspect(connection).get_columns(table)}

    existing = columns("organizations")
    additions = [
        sa.Column("workspace_type", sa.String(20), nullable=False, server_default="general"),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="UTC"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("primary_color", sa.String(7), nullable=False, server_default="#176B5B"),
        sa.Column("secondary_color", sa.String(7), nullable=False, server_default="#3156C8"),
        sa.Column("enabled_modules", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("logo_storage_key", sa.String(240), nullable=True),
        sa.Column("logo_content_type", sa.String(80), nullable=True),
    ]
    with op.batch_alter_table("organizations") as batch:
        for column in additions:
            if column.name not in existing:
                batch.add_column(column)

    if "organization_id" not in columns("refresh_tokens"):
        with op.batch_alter_table("refresh_tokens") as batch:
            batch.add_column(sa.Column("organization_id", sa.String(36), nullable=True))
            batch.create_index("ix_refresh_tokens_organization_id", ["organization_id"])
            batch.create_foreign_key("fk_refresh_workspace", "organizations", ["organization_id"], ["id"])
    op.execute(
        "UPDATE refresh_tokens SET organization_id = (SELECT organization_id FROM users WHERE users.id = refresh_tokens.user_id) WHERE organization_id IS NULL"
    )

    if "workspace_memberships" not in table_names:
        op.create_table(
            "workspace_memberships",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("access_level", sa.String(20), nullable=False, server_default="administrator"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "organization_id"),
        )
        op.create_index("ix_workspace_memberships_user_id", "workspace_memberships", ["user_id"])
        op.create_index("ix_workspace_memberships_organization_id", "workspace_memberships", ["organization_id"])

    platform_users = connection.execute(
        sa.text("SELECT id, organization_id, created_at, updated_at FROM users WHERE is_platform_admin = 1")
    ).mappings()
    for user in platform_users:
        present = connection.execute(
            sa.text("SELECT id FROM workspace_memberships WHERE user_id=:user_id AND organization_id=:organization_id"),
            user,
        ).first()
        if not present:
            connection.execute(
                sa.text(
                    "INSERT INTO workspace_memberships (id,user_id,organization_id,access_level,is_active,created_at,updated_at) VALUES (:id,:user_id,:organization_id,'administrator',1,:created_at,:updated_at)"
                ),
                {"id": str(uuid4()), **user},
            )

    if "stored_files" in table_names:
        return
    op.create_table(
        "stored_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("original_filename", sa.String(240), nullable=False),
        sa.Column("display_name", sa.String(240), nullable=False),
        sa.Column("storage_key", sa.String(300), nullable=False, unique=True),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("context_type", sa.String(40), nullable=False, server_default="workspace"),
        sa.Column("context_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, values in [
        ("organization_id", ["organization_id"]),
        ("uploaded_by", ["uploaded_by"]),
        ("checksum", ["checksum"]),
        ("context_id", ["context_id"]),
    ]:
        op.create_index(f"ix_stored_files_{name}", "stored_files", values)


def downgrade():
    op.drop_table("stored_files")
    op.drop_table("workspace_memberships")
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.drop_constraint("fk_refresh_workspace", type_="foreignkey")
        batch.drop_index("ix_refresh_tokens_organization_id")
        batch.drop_column("organization_id")
    with op.batch_alter_table("organizations") as batch:
        for column in [
            "logo_content_type",
            "logo_storage_key",
            "enabled_modules",
            "secondary_color",
            "primary_color",
            "currency",
            "timezone",
            "workspace_type",
        ]:
            batch.drop_column(column)
