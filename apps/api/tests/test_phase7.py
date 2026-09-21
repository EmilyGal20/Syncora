from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import Dashboard, DashboardAssignment, Notification, Organization, User
from app.routers.collaboration import notifications, resolve_dashboard


@pytest.fixture
async def database(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'phase7.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_username_is_workspace_unique_and_email_is_optional(database):
    org = Organization(name="Username Workspace", slug="username-workspace")
    database.add(org)
    await database.flush()
    database.add(User(organization_id=org.id, username="alex", email=None, full_name="Alex", password_hash="hash"))
    await database.commit()
    database.add(User(organization_id=org.id, username="alex", email=None, full_name="Other Alex", password_hash="hash"))
    with pytest.raises(IntegrityError):
        await database.commit()


@pytest.mark.asyncio
async def test_personal_dashboard_precedes_workspace_default(database):
    org = Organization(name="Dashboard Workspace", slug="dashboard-workspace")
    database.add(org)
    await database.flush()
    user = User(organization_id=org.id, username="emily", email=None, full_name="Emily", password_hash="hash", roles=[])
    default = Dashboard(organization_id=org.id, name="Workspace", is_default=True, status="published")
    personal = Dashboard(organization_id=org.id, name="Emily Personal", status="published")
    database.add_all([user, default, personal])
    await database.flush()
    database.add(DashboardAssignment(organization_id=org.id, dashboard_id=personal.id, principal_type="user", principal_id=user.id, assigned_by=user.id))
    await database.commit()
    assert (await resolve_dashboard(database, user)).id == personal.id


@pytest.mark.asyncio
async def test_notification_query_is_recipient_and_tenant_scoped(database):
    alpha = Organization(name="Notice Alpha", slug="notice-alpha")
    beta = Organization(name="Notice Beta", slug="notice-beta")
    database.add_all([alpha, beta])
    await database.flush()
    user = User(organization_id=alpha.id, username="member", email=None, full_name="Member", password_hash="hash")
    other = User(organization_id=beta.id, username="member", email=None, full_name="Other", password_hash="hash")
    database.add_all([user, other])
    await database.flush()
    database.add_all([
        Notification(organization_id=alpha.id, recipient_id=user.id, type="task.assigned", title="Alpha", created_at=datetime.now(UTC)),
        Notification(organization_id=beta.id, recipient_id=other.id, type="task.assigned", title="Beta", created_at=datetime.now(UTC)),
    ])
    await database.commit()
    result = await notifications(False, 1, 25, user, database)
    assert result["total"] == 1
    assert result["items"][0]["title"] == "Alpha"
