import io
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..audit import record_audit
from ..database import get_db
from ..dependencies import access_scope, current_user, require_permission
from ..models import BandShow, Equipment, Expense, Rehearsal, Setlist, SetlistItem, Song, User
from ..schemas import BandResourceInput, SetlistInput

router = APIRouter(tags=["band workspace"])
MODELS = {"shows": BandShow, "rehearsals": Rehearsal, "songs": Song}


def values_for(kind: str, body: BandResourceInput) -> dict:
    common = {"title": body.title, "notes": body.notes}
    if kind == "shows":
        return {**common, "venue": body.venue, "starts_at": body.starts_at}
    if kind == "rehearsals":
        return {**common, "location": body.location, "starts_at": body.starts_at}
    return {**common, "artist": body.artist, "musical_key": body.musical_key, "duration_seconds": body.duration_seconds}


def model_for(kind: str):
    model = MODELS.get(kind)
    if not model:
        raise HTTPException(status_code=404, detail="Band module not found")
    return model


@router.get("/band/{kind}")
async def resources(kind: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    model = model_for(kind)
    if access_scope(user, f"{kind}.view") is None:
        raise HTTPException(status_code=403, detail=f"Permission required: {kind}.view")
    return list(
        (
            await db.scalars(
                select(model).where(model.organization_id == user.organization_id).order_by(model.created_at.desc())
            )
        ).all()
    )


@router.get("/band/{kind}/{resource_id}")
async def resource(kind: str, resource_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    model = model_for(kind)
    if access_scope(user, f"{kind}.view") is None:
        raise HTTPException(status_code=403, detail=f"Permission required: {kind}.view")
    item = await db.scalar(select(model).where(model.id == resource_id, model.organization_id == user.organization_id))
    if not item:
        raise HTTPException(status_code=404, detail="Resource not found")
    return item


@router.post("/band/{kind}", status_code=201)
async def create_resource(
    kind: str, body: BandResourceInput, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    model = model_for(kind)
    if access_scope(user, f"{kind}.manage") is None:
        raise HTTPException(status_code=403, detail=f"Permission required: {kind}.manage")
    values = values_for(kind, body)
    if kind in {"shows", "rehearsals"} and not values["starts_at"]:
        raise HTTPException(status_code=422, detail="Start date is required")
    item = model(organization_id=user.organization_id, **values)
    db.add(item)
    await db.commit()
    await record_audit(user, f"{kind}.created", kind, item.id)
    return item


@router.get("/band/setlists")
async def list_setlists(user: User = Depends(require_permission("setlists.view")), db: AsyncSession = Depends(get_db)):
    return list(
        (
            await db.scalars(
                select(Setlist)
                .options(selectinload(Setlist.items))
                .where(Setlist.organization_id == user.organization_id)
                .order_by(Setlist.created_at.desc())
            )
        )
        .unique()
        .all()
    )


@router.get("/band/setlists/{setlist_id}")
async def setlist_detail(
    setlist_id: str, user: User = Depends(require_permission("setlists.view")), db: AsyncSession = Depends(get_db)
):
    value = await db.scalar(
        select(Setlist)
        .options(selectinload(Setlist.items).selectinload(SetlistItem.song))
        .where(Setlist.id == setlist_id, Setlist.organization_id == user.organization_id)
    )
    if not value:
        raise HTTPException(status_code=404, detail="Setlist not found")
    return value


@router.post("/band/setlists", status_code=201)
async def create_setlist(
    body: SetlistInput, user: User = Depends(require_permission("setlists.manage")), db: AsyncSession = Depends(get_db)
):
    song_ids = [item.song_id for item in body.items if item.song_id]
    found = (
        set(
            (
                await db.scalars(
                    select(Song.id).where(Song.organization_id == user.organization_id, Song.id.in_(song_ids))
                )
            ).all()
        )
        if song_ids
        else set()
    )
    if found != set(song_ids):
        raise HTTPException(status_code=422, detail="Setlist contains a song outside this workspace")
    if body.show_id and not await db.scalar(
        select(BandShow.id).where(BandShow.id == body.show_id, BandShow.organization_id == user.organization_id)
    ):
        raise HTTPException(status_code=422, detail="Show is outside this workspace")
    value = Setlist(
        organization_id=user.organization_id,
        title=body.title,
        show_id=body.show_id,
        notes=body.notes,
        items=[SetlistItem(position=index, **item.model_dump()) for index, item in enumerate(body.items)],
    )
    db.add(value)
    await db.commit()
    await record_audit(user, "setlist.created", "setlist", value.id)
    return value


@router.get("/band/setlists/{setlist_id}/export.pdf")
async def export_setlist(
    setlist_id: str, user: User = Depends(require_permission("setlists.export_pdf")), db: AsyncSession = Depends(get_db)
):
    value = await db.scalar(
        select(Setlist)
        .options(selectinload(Setlist.items).selectinload(SetlistItem.song))
        .where(Setlist.id == setlist_id, Setlist.organization_id == user.organization_id)
    )
    if not value:
        raise HTTPException(status_code=404, detail="Setlist not found")
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    width, height = A4
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(42, height - 48, user._workspace.name)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(42, height - 75, value.title)
    pdf.setFont("Helvetica", 10)
    pdf.drawRightString(width - 42, height - 48, datetime.now(UTC).strftime("%Y-%m-%d"))
    y = height - 112
    total = 0
    for index, item in enumerate(sorted(value.items, key=lambda x: x.position), 1):
        if y < 55:
            pdf.showPage()
            y = height - 50
        if item.item_type == "song" and item.song:
            total += item.song.duration_seconds
            duration = f"{item.song.duration_seconds // 60}:{item.song.duration_seconds % 60:02d}"
            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(48, y, f"{index}. {item.song.title}")
            pdf.setFont("Helvetica", 10)
            pdf.drawRightString(width - 48, y, f"{item.song.musical_key}   {duration}")
        else:
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(48, y, item.label or item.item_type.upper())
        y -= 22
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(48, y - 10, f"Estimated duration: {total // 60} minutes")
    pdf.save()
    output.seek(0)
    await record_audit(user, "setlist.exported", "setlist", value.id, {"format": "pdf"})
    return StreamingResponse(
        output, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="setlist.pdf"'}
    )


@router.get("/band/equipment")
async def equipment(user: User = Depends(require_permission("equipment.view")), db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(Equipment).where(Equipment.organization_id == user.organization_id))).all())


@router.get("/band/expenses")
async def expenses(user: User = Depends(require_permission("expenses.view")), db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(Expense).where(Expense.organization_id == user.organization_id))).all())


# Exact module paths must win over the generic show/rehearsal/song routes.
router.routes.sort(key=lambda route: "{kind}" in route.path)
