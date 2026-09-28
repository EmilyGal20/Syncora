from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.infrastructure.mongodb.client import mongo
from app.infrastructure.mongodb.models import NotificationDocument
from app.infrastructure.mongodb.repositories import NotificationRepository, SupportRepository
from app.models import Note, Organization, User
from app.routers.notes import get_note, update_note
from app.schemas import NoteUpdate


@pytest.fixture
async def database(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'phase10.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


def user_context(user_id: str, organization_id: str):
    return SimpleNamespace(id=user_id, organization_id=organization_id, is_platform_admin=False, roles=[], _access_grants=[])


@pytest.mark.asyncio
async def test_note_direct_id_is_owner_and_tenant_scoped(database):
    alpha = Organization(name="Notes Alpha", slug="notes-alpha")
    beta = Organization(name="Notes Beta", slug="notes-beta")
    database.add_all([alpha, beta])
    await database.flush()
    owner = User(organization_id=alpha.id, username="owner", full_name="Owner", password_hash="hash")
    other = User(organization_id=alpha.id, username="other", full_name="Other", password_hash="hash")
    foreign = User(organization_id=beta.id, username="foreign", full_name="Foreign", password_hash="hash")
    database.add_all([owner, other, foreign])
    await database.flush()
    note = Note(organization_id=alpha.id, owner_user_id=owner.id, title="Private", body="secret")
    database.add(note)
    await database.commit()

    assert (await get_note(note.id, user_context(owner.id, alpha.id), database))["title"] == "Private"
    for viewer in (user_context(other.id, alpha.id), user_context(foreign.id, beta.id)):
        with pytest.raises(HTTPException) as error:
            await get_note(note.id, viewer, database)
        assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_note_optimistic_concurrency_rejects_stale_update(database):
    org = Organization(name="Version Notes", slug="version-notes")
    database.add(org)
    await database.flush()
    owner = User(organization_id=org.id, username="editor", full_name="Editor", password_hash="hash")
    database.add(owner)
    await database.flush()
    note = Note(organization_id=org.id, owner_user_id=owner.id, title="Draft", body="one", version=2)
    database.add(note)
    await database.commit()
    with pytest.raises(HTTPException) as error:
        await update_note(note.id, NoteUpdate(title="Stale", version=1), user_context(owner.id, org.id), database)
    assert error.value.status_code == 409


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, *_):
        return self

    def skip(self, *_):
        return self

    def limit(self, *_):
        return self

    async def to_list(self, limit):
        return self.documents[:limit]


class FakeCollection:
    def __init__(self):
        self.filters = []
        self.upserts = []

    async def update_one(self, query, update, upsert=False):
        self.upserts.append((query, update, upsert))

    def find(self, query, *_):
        self.filters.append(query)
        return FakeCursor([])

    async def count_documents(self, query):
        self.filters.append(query)
        return 0


@pytest.mark.asyncio
async def test_mongo_notifications_are_idempotent_and_recipient_scoped(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(mongo, "available", True)
    monkeypatch.setattr(mongo, "database", SimpleNamespace(notifications=collection))
    repository = NotificationRepository()
    value = NotificationDocument(notification_id="notice-1", workspace_id="alpha", recipient_user_id="member-a", type="task", title_key="Assigned")
    await repository.upsert(value)
    await repository.upsert(value)
    assert all(item[0] == {"workspace_id": "alpha", "notification_id": "notice-1"} and item[2] for item in collection.upserts)

    await repository.list("alpha", "member-a", False, 1, 25)
    assert collection.filters[0] == {"workspace_id": "alpha", "recipient_user_id": "member-a"}


@pytest.mark.asyncio
async def test_operator_shaped_recipient_is_literal_not_mongo_filter(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(mongo, "available", True)
    monkeypatch.setattr(mongo, "database", SimpleNamespace(notifications=collection))
    await NotificationRepository().list("alpha", '{"$ne":null}', False, 1, 10)
    assert collection.filters[0]["recipient_user_id"] == '{"$ne":null}'
    assert isinstance(collection.filters[0]["recipient_user_id"], str)


@pytest.mark.asyncio
async def test_critical_mongo_feature_returns_controlled_outage(monkeypatch):
    monkeypatch.setattr(mongo, "available", False)
    with pytest.raises(HTTPException) as error:
        await SupportRepository().list("alpha", "ticket-a", False)
    assert error.value.status_code == 503
