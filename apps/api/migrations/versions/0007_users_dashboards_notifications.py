"""advanced users dashboards and notifications

Revision ID: 0007_users_dashboards_notifications
Revises: 0006_file_attachments
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_users_dashboards_notifications"
down_revision = "0006_file_attachments"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    existing_columns = {column["name"] for column in sa.inspect(connection).get_columns("users")}
    columns = [
        sa.Column("username", sa.String(80), nullable=True),
        sa.Column("first_name", sa.String(80), nullable=False, server_default=""),
        sa.Column("last_name", sa.String(80), nullable=False, server_default=""),
        sa.Column("phone", sa.String(40)),
        sa.Column("job_title", sa.String(120)),
        sa.Column("notes", sa.Text()),
        sa.Column("avatar_file_id", sa.String(36)),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
    ]
    for column in columns:
        if column.name not in existing_columns:
            op.add_column("users", column)
    rows = connection.execute(sa.text("SELECT id, organization_id, email FROM users ORDER BY created_at, id")).fetchall()
    used = set()
    for row in rows:
        base = ((row.email or "user").split("@", 1)[0].lower().replace(" ", "."))[:70] or "user"
        candidate, suffix = base, 1
        while (row.organization_id, candidate) in used:
            suffix += 1
            candidate = f"{base}-{suffix}"
        used.add((row.organization_id, candidate))
        connection.execute(sa.text("UPDATE users SET username=:username WHERE id=:id AND username IS NULL"), {"username": candidate, "id": row.id})
    indexes = {index["name"] for index in sa.inspect(connection).get_indexes("users")}
    if "ix_users_username" not in indexes:
        op.create_index("ix_users_username", "users", ["username"])
    if "uq_users_org_username" not in indexes:
        op.create_index("uq_users_org_username", "users", ["organization_id", "username"], unique=True)
    if connection.dialect.name != "sqlite":
        op.alter_column("users", "username", nullable=False)
        op.alter_column("users", "email", nullable=True)

    dashboard_columns = {column["name"] for column in sa.inspect(connection).get_columns("dashboards")}
    if "status" not in dashboard_columns:
        op.add_column("dashboards", sa.Column("status", sa.String(20), nullable=False, server_default="published"))
    tables = set(sa.inspect(connection).get_table_names())
    if "dashboard_assignments" not in tables:
        op.create_table(
        "dashboard_assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("dashboard_id", sa.String(36), sa.ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("principal_type", sa.String(20), nullable=False),
        sa.Column("principal_id", sa.String(36), nullable=False, index=True),
        sa.Column("assigned_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "principal_type", "principal_id"),
        )
    if "notifications" not in tables:
        op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("recipient_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(80), nullable=False, index=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("message", sa.String(500), nullable=False, server_default=""),
        sa.Column("resource_type", sa.String(80)),
        sa.Column("resource_id", sa.String(36)),
        sa.Column("route", sa.String(240)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade():
    op.drop_table("notifications")
    op.drop_table("dashboard_assignments")
    op.drop_column("dashboards", "status")
    op.drop_index("uq_users_org_username", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    for column in ["must_change_password", "avatar_file_id", "notes", "job_title", "phone", "last_name", "first_name", "username"]:
        op.drop_column("users", column)
    op.alter_column("users", "email", nullable=False)
