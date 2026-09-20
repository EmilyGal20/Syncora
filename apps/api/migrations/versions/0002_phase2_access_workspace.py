"""Phase 2 access scopes, localization, preferences, and content ownership."""
import sqlalchemy as sa
from alembic import op

revision = "0002_phase2"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    def add(table, column):
        if column.name not in {item["name"] for item in sa.inspect(bind).get_columns(table)}:
            op.add_column(table, column)

    def exists(table):
        return table in sa.inspect(bind).get_table_names()

    for column in [
        sa.Column("default_locale", sa.String(12), nullable=False, server_default="en"),
        sa.Column("default_theme", sa.String(20), nullable=False, server_default="system"),
        sa.Column("allow_user_locale", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("allow_user_theme", sa.Boolean(), nullable=False, server_default=sa.true()),
    ]:
        add("organizations", column)
    add("roles", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    add("roles", sa.Column("default_locale", sa.String(12), nullable=True))
    add("users", sa.Column("locale", sa.String(12), nullable=True))
    add("teams", sa.Column("description", sa.Text(), nullable=False, server_default=""))
    add("teams", sa.Column("manager_id", sa.String(36), nullable=True))
    add("teams", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    add("navigation_items", sa.Column("title_en", sa.String(80), nullable=True))
    add("navigation_items", sa.Column("title_he", sa.String(80), nullable=True))
    add("tasks", sa.Column("department_id", sa.String(36), nullable=True))
    add("tasks", sa.Column("visibility", sa.String(20), nullable=False, server_default="private"))
    for column in [
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("location", sa.String(200), nullable=False, server_default=""),
        sa.Column("creator_id", sa.String(36), nullable=True), sa.Column("owner_user_id", sa.String(36), nullable=True),
        sa.Column("team_id", sa.String(36), nullable=True), sa.Column("department_id", sa.String(36), nullable=True),
    ]:
        add("events", column)
    for column in [
        sa.Column("audience", sa.String(20), nullable=False, server_default="organization"),
        sa.Column("team_id", sa.String(36), nullable=True), sa.Column("department_id", sa.String(36), nullable=True),
        sa.Column("creator_id", sa.String(36), nullable=True),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
    ]:
        add("announcements", column)
    if not exists("team_members"): op.create_table("team_members", sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True))
    if not exists("event_participants"): op.create_table("event_participants", sa.Column("event_id", sa.String(36), sa.ForeignKey("events.id", ondelete="CASCADE"), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True))
    if not exists("announcement_users"): op.create_table("announcement_users", sa.Column("announcement_id", sa.String(36), sa.ForeignKey("announcements.id", ondelete="CASCADE"), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True))
    if not exists("access_grants"):
        op.create_table("access_grants", sa.Column("id", sa.String(36), primary_key=True), sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False), sa.Column("principal_type", sa.String(10), nullable=False), sa.Column("principal_id", sa.String(36), nullable=False), sa.Column("permission_id", sa.String(36), sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False), sa.Column("scope", sa.String(20), nullable=False), sa.Column("effect", sa.String(10), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("organization_id", "principal_type", "principal_id", "permission_id"))
        op.create_index("ix_access_grants_organization_id", "access_grants", ["organization_id"])
        op.create_index("ix_access_grants_principal_id", "access_grants", ["principal_id"])
    if dialect != "sqlite":
        for name, table, local, remote in [("fk_teams_manager","teams","manager_id","users.id"),("fk_tasks_department","tasks","department_id","departments.id"),("fk_events_creator","events","creator_id","users.id"),("fk_events_owner","events","owner_user_id","users.id"),("fk_events_team","events","team_id","teams.id"),("fk_events_department","events","department_id","departments.id"),("fk_announcements_team","announcements","team_id","teams.id"),("fk_announcements_department","announcements","department_id","departments.id"),("fk_announcements_creator","announcements","creator_id","users.id")]:
            op.create_foreign_key(name, table, remote.split(".")[0], [local], [remote.split(".")[1]])


def downgrade():
    for table in ["access_grants", "announcement_users", "event_participants", "team_members"]:
        op.drop_table(table)
    for table, names in {
        "announcements":["priority","expires_at","publish_at","creator_id","department_id","team_id","audience"],
        "events":["department_id","team_id","owner_user_id","creator_id","location","all_day","description"],
        "tasks":["visibility","department_id"], "navigation_items":["title_he","title_en"],
        "teams":["is_active","manager_id","description"], "users":["locale"],
        "roles":["default_locale","is_active"],
        "organizations":["allow_user_theme","allow_user_locale","default_theme","default_locale"],
    }.items():
        for name in names:
            op.drop_column(table, name)
