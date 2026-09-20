from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import TaskStatus


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class UserSummary(ApiModel):
    id: str
    email: EmailStr
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


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=10, max_length=128)
    role_ids: list[str] = []
    department_id: str | None = None
    team_id: str | None = None
    locale: str | None = Field(default=None, pattern="^(en|he)$")


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    is_active: bool | None = None
    role_ids: list[str] | None = None
    department_id: str | None = None
    team_id: str | None = None
    locale: str | None = Field(default=None, pattern="^(en|he)$")


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
