from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import current_user, permission_codes, require_permission
from ..infrastructure.mongodb.repositories import activity_repository
from ..models import Note, User
from ..realtime import realtime_hub
from ..schemas import NoteCreate, NoteUpdate

router = APIRouter(tags=["notes"])


def note_json(value: Note) -> dict:
    return {
        "id": value.id,
        "title": value.title,
        "body": value.body,
        "visibility": value.visibility,
        "pinned": value.pinned,
        "archived_at": value.archived_at,
        "version": value.version,
        "created_at": value.created_at,
        "updated_at": value.updated_at,
    }


def visible_clause(user: User):
    clauses = [Note.owner_user_id == user.id]
    if "notes.view_shared" in permission_codes(user):
        clauses.append(Note.visibility == "shared")
    return (Note.organization_id == user.organization_id) & or_(*clauses)


async def owned_note(note_id: str, user: User, db: AsyncSession) -> Note:
    value = await db.scalar(select(Note).where(Note.id == note_id, Note.organization_id == user.organization_id, Note.owner_user_id == user.id))
    if not value:
        raise HTTPException(status_code=404, detail="Note not found")
    return value


@router.get("/notes")
async def list_notes(
    filter: str = Query("all", pattern="^(all|pinned|recent|archived)$"),
    search: str = Query("", max_length=200),
    sort: str = Query("updated", pattern="^(updated|created|title)$"),
    user: User = Depends(require_permission("notes.view_own")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Note).where(visible_clause(user))
    query = query.where(Note.archived_at.is_not(None) if filter == "archived" else Note.archived_at.is_(None))
    if filter == "pinned":
        query = query.where(Note.pinned.is_(True))
    if search:
        escaped = search.replace("%", r"\%").replace("_", r"\_")
        query = query.where(or_(Note.title.ilike(f"%{escaped}%", escape="\\"), Note.body.ilike(f"%{escaped}%", escape="\\")))
    ordering = Note.title.asc() if sort == "title" else Note.created_at.desc() if sort == "created" else Note.updated_at.desc()
    return [note_json(value) for value in (await db.scalars(query.order_by(Note.pinned.desc(), ordering).limit(250))).all()]


@router.get("/notes/{note_id}")
async def get_note(note_id: str, user: User = Depends(require_permission("notes.view_own")), db: AsyncSession = Depends(get_db)):
    value = await db.scalar(select(Note).where(Note.id == note_id, visible_clause(user)))
    if not value:
        raise HTTPException(status_code=404, detail="Note not found")
    return note_json(value)


@router.post("/notes", status_code=201)
async def create_note(body: NoteCreate, user: User = Depends(require_permission("notes.create")), db: AsyncSession = Depends(get_db)):
    if body.visibility == "shared" and "notes.manage_shared" not in permission_codes(user):
        raise HTTPException(status_code=403, detail="Shared note permission required")
    value = Note(organization_id=user.organization_id, owner_user_id=user.id, **body.model_dump())
    db.add(value)
    await db.commit()
    await realtime_hub.publish(user.organization_id, "note.created", {"id": value.id}, {user.id})
    return note_json(value)


@router.patch("/notes/{note_id}")
async def update_note(note_id: str, body: NoteUpdate, user: User = Depends(require_permission("notes.edit_own")), db: AsyncSession = Depends(get_db)):
    value = await owned_note(note_id, user, db)
    if value.version != body.version:
        raise HTTPException(status_code=409, detail="This note changed elsewhere. Reload before saving.")
    changes = body.model_dump(exclude_unset=True, exclude={"version", "archived"})
    if changes.get("visibility") == "shared" and "notes.manage_shared" not in permission_codes(user):
        raise HTTPException(status_code=403, detail="Shared note permission required")
    for key, field_value in changes.items():
        setattr(value, key, field_value)
    if body.archived is not None:
        value.archived_at = datetime.now(UTC) if body.archived else None
    value.version += 1
    await db.commit()
    await realtime_hub.publish(user.organization_id, "note.updated", {"id": value.id, "version": value.version}, {user.id})
    return note_json(value)


@router.post("/notes/{note_id}/duplicate", status_code=201)
async def duplicate_note(note_id: str, user: User = Depends(require_permission("notes.create")), db: AsyncSession = Depends(get_db)):
    source = await db.scalar(select(Note).where(Note.id == note_id, visible_clause(user)))
    if not source:
        raise HTTPException(status_code=404, detail="Note not found")
    value = Note(organization_id=user.organization_id, owner_user_id=user.id, title=f"{source.title} copy"[:200], body=source.body, visibility="private")
    db.add(value)
    await db.commit()
    await realtime_hub.publish(user.organization_id, "note.created", {"id": value.id}, {user.id})
    return note_json(value)


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(note_id: str, user: User = Depends(require_permission("notes.delete_own")), db: AsyncSession = Depends(get_db)):
    value = await owned_note(note_id, user, db)
    await db.delete(value)
    await db.commit()
    await realtime_hub.publish(user.organization_id, "note.deleted", {"id": note_id}, {user.id})
    return Response(status_code=204)


@router.get("/activity")
async def activity(
    actor_user_id: str | None = None,
    before: datetime | None = None,
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(current_user),
):
    if actor_user_id and actor_user_id != user.id and "audit.view" not in permission_codes(user):
        raise HTTPException(status_code=403, detail="Activity permission required")
    return await activity_repository.list(user.organization_id, actor_user_id, before, limit)
