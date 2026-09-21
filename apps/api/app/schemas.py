from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import TaskStatus


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    identifier: str | None = Field(default=None, min_length=1, max_length=254)
    email: str | None = Field(default=None, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    workspace_slug: str | None = Field(default=None, max_length=80)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class UserSummary(ApiModel):
    id: str
    username: str
    email: str | None
    full_name: str
    is_active: bool
    organization_id: str
    department_id: str | None
    team_id: str | None
    locale: str | None
    last_login_at: datetime | None
    created_at: datetime
    roles: list[str] = []
    permissions: list[str] = []
    scopes: dict[str, str] = {}
    is_platform_admin: bool = False
    workspace_name: str = ""
    workspace_slug: str = ""
    workspace_type: str = "general"
    workspace_logo_url: str | None = None
    workspace_primary_color: str = "#176B5B"
    workspace_secondary_color: str = "#3156C8"
    enabled_modules: list[str] = []


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)
    workspace_type: str = Field(default="general", pattern="^(general|band)$")
    default_locale: str = Field(default="en", pattern="^(en|he)$")
    timezone: str = Field(default="UTC", max_length=80)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    primary_color: str = Field(default="#176B5B", pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str = Field(default="#3156C8", pattern=r"^#[0-9A-Fa-f]{6}$")
    enabled_modules: list[str] = []
    administrator_email: EmailStr
    administrator_name: str = Field(min_length=2, max_length=160)
    administrator_password: str = Field(min_length=10, max_length=128)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    is_active: bool | None = None
    default_locale: str | None = Field(default=None, pattern="^(en|he)$")
    timezone: str | None = Field(default=None, max_length=80)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    primary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    enabled_modules: list[str] | None = None


class FileRename(BaseModel):
    display_name: str = Field(min_length=1, max_length=240, pattern=r"^[^\\/\x00-\x1f]+$")


class FileAttachmentInput(BaseModel):
    context_type: str = Field(pattern="^(show|rehearsal|song|task|equipment|expense|band)$")
    context_id: str = Field(min_length=36, max_length=36)


class BandResourceInput(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    notes: str = ""
    starts_at: datetime | None = None
    venue: str = Field(default="", max_length=180)
    location: str = Field(default="", max_length=180)
    artist: str = Field(default="", max_length=180)
    musical_key: str = Field(default="", max_length=20)
    duration_seconds: int = Field(default=0, ge=0, le=86400)


class SetlistItemInput(BaseModel):
    song_id: str | None = None
    item_type: str = Field(default="song", pattern="^(song|break|note)$")
    label: str = Field(default="", max_length=180)
    notes: str = ""


class SetlistInput(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    show_id: str | None = None
    notes: str = ""
    items: list[SetlistItemInput] = []


class EquipmentInput(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    category: str = Field(default="", max_length=80)
    status: str = Field(default="available", pattern="^(available|assigned|maintenance|retired)$")
    notes: str = ""


class ExpenseInput(BaseModel):
    description: str = Field(min_length=2, max_length=200)
    amount_minor: int = Field(ge=0, le=1_000_000_000)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    incurred_at: datetime


class UserCreate(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$")
    email: EmailStr | None = None
    full_name: str = Field(min_length=2, max_length=160)
    first_name: str = Field(default="", max_length=80)
    last_name: str = Field(default="", max_length=80)
    phone: str | None = Field(default=None, max_length=40)
    job_title: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    password: str = Field(min_length=10, max_length=128)
    role_ids: list[str] = []
    department_id: str | None = None
    team_id: str | None = None
    locale: str | None = Field(default=None, pattern="^(en|he)$")


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$")
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=40)
    job_title: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    is_active: bool | None = None
    role_ids: list[str] | None = None
    department_id: str | None = None
    team_id: str | None = None
    locale: str | None = Field(default=None, pattern="^(en|he)$")


class PasswordReset(BaseModel):
    password: str = Field(min_length=10, max_length=128)
    force_change: bool = True


class DashboardInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    status: str = Field(default="draft", pattern="^(draft|published)$")
    widgets: list[dict] = []


class DashboardAssignmentInput(BaseModel):
    dashboard_id: str


class RegistrationRequestInput(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$")
    password: str = Field(min_length=10, max_length=128)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    display_name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    preferred_locale: str = Field(default="en", pattern="^(en|he)$")
    timezone: str = Field(default="UTC", max_length=80)
    workspace_mode: str = Field(pattern="^(existing|new)$")
    workspace_type: str = Field(pattern="^(band|organization|creative|other)$")
    workspace_name: str = Field(min_length=2, max_length=160)
    requested_role: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=2000)
    details: dict = {}


class RegistrationDecision(BaseModel):
    organization_id: str
    role_ids: list[str] = []
    dashboard_id: str | None = None
    team_id: str | None = None
    department_id: str | None = None
    applicant_response: str = Field(default="", max_length=1000)
    internal_note: str = Field(default="", max_length=2000)


class RegistrationReject(BaseModel):
    applicant_response: str = Field(default="", max_length=1000)
    internal_note: str = Field(default="", max_length=2000)


class SupportTicketInput(BaseModel):
    category: str = Field(pattern="^(login|access|bug|information|file|calendar|band|dashboard|other)$")
    subject: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=5, max_length=5000)
    requester_name: str = Field(default="", max_length=160)
    contact: str | None = Field(default=None, max_length=254)
    current_route: str | None = Field(default=None, max_length=240)


class SupportMessageInput(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    internal: bool = False


class SupportStatusInput(BaseModel):
    status: str = Field(pattern="^(OPEN|IN_PROGRESS|WAITING_FOR_USER|RESOLVED|CLOSED)$")


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=240)
    permission_codes: list[str] = []


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    status: TaskStatus = TaskStatus.todo
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    assignee_id: str | None = None
    team_id: str | None = None
    due_date: datetime | None = None
    tags: list[str] = []
    visibility: str = Field(default="private", pattern="^(private|team|department|organization)$")


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    status: TaskStatus | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high|urgent)$")
    assignee_id: str | None = None
    due_date: datetime | None = None
    visibility: str | None = Field(default=None, pattern="^(private|team|department|organization)$")


class NavigationInput(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    icon: str = "Circle"
    route: str | None = None
    item_type: str = Field(default="item", pattern="^(item|group|separator)$")
    order: int = 0
    parent_id: str | None = None
    required_permission: str | None = None
    module: str | None = None
    enabled: bool = True
    title_en: str | None = None
    title_he: str | None = None


class GrantInput(BaseModel):
    permission_code: str
    scope: str = Field(pattern="^(OWN|TEAM|DEPARTMENT|ORGANIZATION)$")
    effect: str = Field(default="allow", pattern="^(allow|deny)$")


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=240)
    is_active: bool | None = None
    default_locale: str | None = Field(default=None, pattern="^(en|he)$")
    grants: list[GrantInput] | None = None


class PreferenceUpdate(BaseModel):
    locale: str | None = Field(default=None, pattern="^(en|he)$")
    theme: str | None = Field(default=None, pattern="^(light|dark|system)$")
    sidebar_collapsed: bool | None = None
    timezone: str | None = None


class EventInput(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    starts_at: datetime
    ends_at: datetime
    all_day: bool = False
    location: str = Field(default="", max_length=200)
    visibility: str = Field(default="private", pattern="^(private|participants|team|department|organization)$")
    owner_user_id: str | None = None
    team_id: str | None = None
    department_id: str | None = None
    participant_ids: list[str] = []


class TeamInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    manager_id: str | None = None
    member_ids: list[str] = []
    is_active: bool = True


class AnnouncementInput(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2)
    audience: str = Field(pattern="^(organization|department|team|users)$")
    team_id: str | None = None
    department_id: str | None = None
    target_user_ids: list[str] = []
    publish_at: datetime | None = None
    expires_at: datetime | None = None
    priority: str = Field(default="normal", pattern="^(normal|important|urgent)$")
    published: bool = True
