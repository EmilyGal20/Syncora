import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uuid4() -> str:
    return str(uuid.uuid4())


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", String(36), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)
team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", String(36), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)
event_participants = Table(
    "event_participants",
    Base.metadata,
    Column("event_id", String(36), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)
announcement_users = Table(
    "announcement_users",
    Base.metadata,
    Column("announcement_id", String(36), ForeignKey("announcements.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    blocked = "blocked"
    completed = "completed"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    default_locale: Mapped[str] = mapped_column(String(12), default="en")
    default_theme: Mapped[str] = mapped_column(String(20), default="system")
    allow_user_locale: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_user_theme: Mapped[bool] = mapped_column(Boolean, default=True)
    workspace_type: Mapped[str] = mapped_column(String(20), default="general")
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    primary_color: Mapped[str] = mapped_column(String(7), default="#176B5B")
    secondary_color: Mapped[str] = mapped_column(String(7), default="#3156C8")
    enabled_modules: Mapped[list] = mapped_column(JSON, default=list)
    logo_storage_key: Mapped[str | None] = mapped_column(String(240))
    logo_content_type: Mapped[str | None] = mapped_column(String(80))


class WorkspaceMembership(Base, TimestampMixin):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    access_level: Mapped[str] = mapped_column(String(20), default="administrator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Department(Base, TimestampMixin):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("organization_id", "name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))


class Team(Base, TimestampMixin):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("organization_id", "name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    manager_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    group: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(240), default="")


class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("organization_id", "name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(240), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    default_locale: Mapped[str | None] = mapped_column(String(12))
    permissions: Mapped[list[Permission]] = relationship(secondary=role_permissions, lazy="selectin")


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("organization_id", "email"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    email: Mapped[str] = mapped_column(String(254), index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"))
    locale: Mapped[str | None] = mapped_column(String(12))
    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)


class NavigationItem(Base, TimestampMixin):
    __tablename__ = "navigation_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("navigation_items.id"))
    title: Mapped[str] = mapped_column(String(80))
    title_en: Mapped[str | None] = mapped_column(String(80))
    title_he: Mapped[str | None] = mapped_column(String(80))
    icon: Mapped[str] = mapped_column(String(60), default="Circle")
    route: Mapped[str | None] = mapped_column(String(160))
    item_type: Mapped[str] = mapped_column(String(20), default="item")
    order: Mapped[int] = mapped_column(default=0)
    required_permission: Mapped[str | None] = mapped_column(String(100))
    module: Mapped[str | None] = mapped_column(String(80))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Dashboard(Base, TimestampMixin):
    __tablename__ = "dashboards"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    widgets: Mapped[list["DashboardWidget"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    dashboard_id: Mapped[str] = mapped_column(ForeignKey("dashboards.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(default=0)
    width: Mapped[int] = mapped_column(default=4)
    height: Mapped[int] = mapped_column(default=1)
    required_permission: Mapped[str | None] = mapped_column(String(100))
    configuration: Mapped[dict] = mapped_column(JSON, default=dict)


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.todo)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    creator_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tags: Mapped[list] = mapped_column(JSON, default=list)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    visibility: Mapped[str] = mapped_column(String(20), default="private")


class Event(Base, TimestampMixin):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    visibility: Mapped[str] = mapped_column(String(20), default="organization")
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String(200), default="")
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    participants: Mapped[list[User]] = relationship(secondary=event_participants, lazy="selectin")


class Announcement(Base, TimestampMixin):
    __tablename__ = "announcements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    audience: Mapped[str] = mapped_column(String(20), default="organization")
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    creator_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    target_users: Mapped[list[User]] = relationship(secondary=announcement_users, lazy="selectin")


class UserPreference(Base):
    __tablename__ = "user_preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    theme: Mapped[str] = mapped_column(String(20), default="light")
    sidebar_collapsed: Mapped[bool] = mapped_column(Boolean, default=False)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    locale: Mapped[str] = mapped_column(String(12), default="en")
    notifications: Mapped[dict] = mapped_column(JSON, default=dict)


class AccessGrant(Base, TimestampMixin):
    __tablename__ = "access_grants"
    __table_args__ = (UniqueConstraint("organization_id", "principal_type", "principal_id", "permission_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    principal_type: Mapped[str] = mapped_column(String(10))
    principal_id: Mapped[str] = mapped_column(String(36), index=True)
    permission_id: Mapped[str] = mapped_column(ForeignKey("permissions.id", ondelete="CASCADE"))
    scope: Mapped[str] = mapped_column(String(20), default="OWN")
    effect: Mapped[str] = mapped_column(String(10), default="allow")
    permission: Mapped[Permission] = relationship(lazy="joined")


class StoredFile(Base, TimestampMixin):
    __tablename__ = "stored_files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(240))
    display_name: Mapped[str] = mapped_column(String(240))
    storage_key: Mapped[str] = mapped_column(String(300), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(BigInteger)
    checksum: Mapped[str] = mapped_column(String(64), index=True)
    context_type: Mapped[str] = mapped_column(String(40), default="workspace")
    context_id: Mapped[str | None] = mapped_column(String(36), index=True)
    attachments: Mapped[list["FileAttachment"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class FileAttachment(Base, TimestampMixin):
    __tablename__ = "file_attachments"
    __table_args__ = (UniqueConstraint("file_id", "context_type", "context_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    file_id: Mapped[str] = mapped_column(ForeignKey("stored_files.id", ondelete="CASCADE"), index=True)
    context_type: Mapped[str] = mapped_column(String(40))
    context_id: Mapped[str] = mapped_column(String(36), index=True)


class BandShow(Base, TimestampMixin):
    __tablename__ = "band_shows"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    venue: Mapped[str] = mapped_column(String(180), default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str] = mapped_column(Text, default="")


class Rehearsal(Base, TimestampMixin):
    __tablename__ = "rehearsals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(String(180), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class Song(Base, TimestampMixin):
    __tablename__ = "songs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    artist: Mapped[str] = mapped_column(String(180), default="")
    musical_key: Mapped[str] = mapped_column(String(20), default="")
    duration_seconds: Mapped[int] = mapped_column(default=0)
    notes: Mapped[str] = mapped_column(Text, default="")


class Setlist(Base, TimestampMixin):
    __tablename__ = "setlists"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    show_id: Mapped[str | None] = mapped_column(ForeignKey("band_shows.id"))
    notes: Mapped[str] = mapped_column(Text, default="")
    items: Mapped[list["SetlistItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class SetlistItem(Base):
    __tablename__ = "setlist_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    setlist_id: Mapped[str] = mapped_column(ForeignKey("setlists.id", ondelete="CASCADE"), index=True)
    song_id: Mapped[str | None] = mapped_column(ForeignKey("songs.id"))
    position: Mapped[int] = mapped_column(default=0)
    item_type: Mapped[str] = mapped_column(String(20), default="song")
    label: Mapped[str] = mapped_column(String(180), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    song: Mapped[Song | None] = relationship(lazy="joined")


class Equipment(Base, TimestampMixin):
    __tablename__ = "equipment"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(30), default="available")
    notes: Mapped[str] = mapped_column(Text, default="")


class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    description: Mapped[str] = mapped_column(String(200))
    amount_minor: Mapped[int] = mapped_column(default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    incurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
