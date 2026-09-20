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
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserSummary(ApiModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    organization_id: str
    department_id: str | None
    team_id: str | None
    last_login_at: datetime | None
    created_at: datetime
    roles: list[str] = []
    permissions: list[str] = []


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=10, max_length=128)
    role_ids: list[str] = []
    department_id: str | None = None
    team_id: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    is_active: bool | None = None
    role_ids: list[str] | None = None
    department_id: str | None = None
    team_id: str | None = None


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

