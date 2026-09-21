from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import Dashboard, Organization, RegistrationRequest, Role, SupportTicket, User
from app.realtime import RealtimeHub
from app.routers.requests_support import approve_registration, submit_registration, visible_ticket
from app.schemas import RegistrationDecision, RegistrationRequestInput
from app.security import verify_password


@pytest.fixture
async def database(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'phase8.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


def public_request():
    return SimpleNamespace(headers={}, client=SimpleNamespace(host="198.51.100.7"))


@pytest.mark.asyncio
async def test_registration_is_pending_hashed_and_transactionally_approved(database):
    org = Organization(name="Approval Band", slug="approval-band", workspace_type="band")
    database.add(org)
    await database.flush()
    role = Role(organization_id=org.id, name="Band Member")
    dashboard = Dashboard(organization_id=org.id, name="Guitarist", status="published")
    admin = User(organization_id=org.id, username="owner", email=None, full_name="Owner", password_hash="hash", is_platform_admin=True)
    database.add_all([role, dashboard, admin])
    await database.commit()
    password = "SafePendingPass123!"
    submitted = await submit_registration(
        RegistrationRequestInput(username="newguitarist", password=password, first_name="New", last_name="Guitarist", display_name="New Guitarist", workspace_mode="existing", workspace_type="band", workspace_name="Approval Band", requested_role="Guitar", details={"instruments": ["Guitar"]}),
        public_request(),
        database,
    )
    request = await database.get(RegistrationRequest, submitted["id"])
    assert request.status == "PENDING"
    assert password not in request.password_hash
    assert verify_password(password, request.password_hash)
    assert await database.scalar(select(User.id).where(User.username == "newguitarist")) is None
    result = await approve_registration(request.id, RegistrationDecision(organization_id=org.id, role_ids=[role.id], dashboard_id=dashboard.id), admin, database)
    created = await database.get(User, result["user_id"])
    assert created.username == "newguitarist"
    assert created.email is None
    assert request.status == "APPROVED"


@pytest.mark.asyncio
async def test_support_direct_id_is_hidden_across_users_and_tenants(database):
    alpha = Organization(name="Support Alpha", slug="support-alpha")
    beta = Organization(name="Support Beta", slug="support-beta")
    database.add_all([alpha, beta])
    await database.flush()
    owner = User(organization_id=alpha.id, username="owner", email=None, full_name="Owner", password_hash="x")
    attacker = User(organization_id=beta.id, username="attacker", email=None, full_name="Attacker", password_hash="x")
    database.add_all([owner, attacker])
    await database.flush()
    ticket = SupportTicket(organization_id=alpha.id, requester_user_id=owner.id, requester_name="Owner", category="bug", subject="Private issue", description="Private support details")
    database.add(ticket)
    await database.commit()
    attacker._access_grants = []
    with pytest.raises(HTTPException) as error:
        await visible_ticket(ticket.id, attacker, database)
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_realtime_hub_never_crosses_workspace_or_recipient():
    class Socket:
        def __init__(self):
            self.messages = []

        async def accept(self, subprotocol=None):
            self.subprotocol = subprotocol

        async def send_json(self, value):
            self.messages.append(value)

    hub = RealtimeHub()
    alpha = Socket()
    beta = Socket()
    other_alpha = Socket()
    await hub.connect("alpha", "member-a", alpha)
    await hub.connect("beta", "member-b", beta)
    await hub.connect("alpha", "member-c", other_alpha)
    await hub.publish("alpha", "show.updated", {"id": "show-a"}, {"member-a"})
    assert len(alpha.messages) == 1
    assert beta.messages == []
    assert other_alpha.messages == []
