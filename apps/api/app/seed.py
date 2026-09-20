from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .models import (
    AccessGrant,
    Announcement,
    Dashboard,
    DashboardWidget,
    Department,
    Event,
    NavigationItem,
    Organization,
    Permission,
    Role,
    Task,
    Team,
    User,
    UserPreference,
)
from .security import hash_password

PERMISSIONS = [
    "dashboard.view", "dashboard.manage", "users.view", "users.create", "users.edit", "users.delete",
    "roles.manage", "teams.view", "teams.manage", "departments.view", "departments.manage",
    "tasks.view", "tasks.create", "tasks.edit", "tasks.delete", "navigation.manage",
    "settings.view", "settings.manage", "audit.view", "announcements.view", "announcements.manage",
    "schedule.view", "schedule.create", "schedule.edit", "schedule.delete", "schedule.manage",
    "announcements.create", "announcements.edit", "announcements.delete", "users.manage",
]


async def ensure_access_grants(db: AsyncSession, org: Organization, admin_role: Role, member_role: Role) -> None:
    existing_codes = set((await db.scalars(select(Permission.code))).all())
    db.add_all([Permission(code=code, group=code.split(".")[0].title(), description=code.replace(".", " ").title()) for code in PERMISSIONS if code not in existing_codes])
    await db.flush()
    permissions = {p.code: p for p in (await db.scalars(select(Permission))).all()}
    existing_admin = await db.scalar(select(AccessGrant.id).where(AccessGrant.organization_id == org.id, AccessGrant.principal_type == "role", AccessGrant.principal_id == admin_role.id).limit(1))
    existing_member = await db.scalar(select(AccessGrant.id).where(AccessGrant.organization_id == org.id, AccessGrant.principal_type == "role", AccessGrant.principal_id == member_role.id).limit(1))
    if not existing_admin:
        db.add_all([AccessGrant(organization_id=org.id, principal_type="role", principal_id=admin_role.id, permission_id=p.id, scope="ORGANIZATION", effect="allow") for p in permissions.values()])
    member_codes = {"dashboard.view", "tasks.view", "tasks.create", "schedule.view", "schedule.create", "teams.view", "announcements.view"}
    if not existing_member:
        db.add_all([AccessGrant(organization_id=org.id, principal_type="role", principal_id=member_role.id, permission_id=permissions[code].id, scope="OWN", effect="allow") for code in member_codes])


async def seed(db: AsyncSession) -> None:
    existing_org = await db.scalar(select(Organization).limit(1))
    if existing_org:
        roles = {role.name: role for role in (await db.scalars(select(Role).where(Role.organization_id == existing_org.id))).all()}
        if "Organization Admin" in roles and "Member" in roles:
            await ensure_access_grants(db, existing_org, roles["Organization Admin"], roles["Member"])
            await db.commit()
        return
    settings = get_settings()
    org = Organization(name="Syncora Demo", slug="syncora-demo")
    db.add(org)
    await db.flush()
    sales = Department(organization_id=org.id, name="Operations")
    product = Team(organization_id=org.id, name="Product")
    db.add_all([sales, product])
    await db.flush()
    perms = [Permission(code=code, group=code.split(".")[0].title(), description=code.replace(".", " ").title()) for code in PERMISSIONS]
    db.add_all(perms)
    await db.flush()
    admin_role = Role(organization_id=org.id, name="Organization Admin", description="Full organization administration", permissions=perms)
    member_role = Role(organization_id=org.id, name="Member", description="Daily workspace access", permissions=[p for p in perms if p.code in {"dashboard.view", "tasks.view", "tasks.create", "teams.view", "schedule.view", "announcements.view"}])
    db.add_all([admin_role, member_role])
    await db.flush()
    await ensure_access_grants(db, org, admin_role, member_role)
    admin = User(organization_id=org.id, email=settings.dev_admin_email.lower(), full_name="Demo Administrator", password_hash=hash_password(settings.dev_admin_password), department_id=sales.id, team_id=product.id, roles=[admin_role])
    manager = User(organization_id=org.id, email="manager@syncora.dev", full_name="Maya Cohen", password_hash=hash_password("Manager123!"), department_id=sales.id, team_id=product.id, roles=[member_role])
    employee = User(organization_id=org.id, email="member@syncora.dev", full_name="Noah Levi", password_hash=hash_password("Member123!"), department_id=sales.id, team_id=product.id, roles=[member_role])
    db.add_all([admin, manager, employee])
    await db.flush()
    db.add_all([UserPreference(user_id=u.id, timezone="Asia/Jerusalem") for u in [admin, manager, employee]])
    nav = [
        ("Dashboard", "Dashboard", "/dashboard", None, 0), ("My Work", "CheckCircle", "/tasks", "tasks.view", 10),
        ("Schedule", "CalendarMonth", "/schedule", "schedule.view", 20), ("Teams", "Groups", "/teams", "teams.view", 30),
        ("Announcements", "Campaign", "/announcements", "announcements.view", 40), ("Administration", "AdminPanelSettings", "/admin", "users.view", 90),
    ]
    db.add_all([NavigationItem(organization_id=org.id, title=t, icon=i, route=r, required_permission=p, order=o) for t, i, r, p, o in nav])
    dashboard = Dashboard(organization_id=org.id, name="Company overview", is_default=True)
    dashboard.widgets = [
        DashboardWidget(type="kpi", title="Open tasks", position=0, width=4, configuration={"metric": "open_tasks"}),
        DashboardWidget(type="task_summary", title="Work at a glance", position=1, width=8, configuration={}),
        DashboardWidget(type="announcements", title="Announcements", position=2, width=6, configuration={}),
        DashboardWidget(type="schedule", title="Upcoming", position=3, width=6, configuration={}),
    ]
    db.add(dashboard)
    db.add_all([
        Task(organization_id=org.id, title="Review onboarding workflow", description="Confirm ownership and due dates", status="in_progress", priority="high", assignee_id=manager.id, creator_id=admin.id, team_id=product.id, due_date=datetime.now(UTC) + timedelta(days=2), tags=["operations"]),
        Task(organization_id=org.id, title="Publish weekly update", status="todo", priority="medium", assignee_id=employee.id, creator_id=admin.id, team_id=product.id, due_date=datetime.now(UTC) + timedelta(days=4), tags=["communication"]),
        Event(organization_id=org.id, title="Company planning", starts_at=datetime.now(UTC) + timedelta(days=1), ends_at=datetime.now(UTC) + timedelta(days=1, hours=1)),
        Announcement(organization_id=org.id, title="Welcome to Syncora", body="Your shared workspace is ready.", published=True),
    ])
    await db.commit()
