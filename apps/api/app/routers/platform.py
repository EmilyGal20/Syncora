import hashlib
import io
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font
from PIL import Image, UnidentifiedImageError
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..audit import record_audit
from ..config import get_settings
from ..database import get_db
from ..dependencies import access_scope, current_user, require_permission
from ..models import (
    AccessGrant,
    Dashboard,
    NavigationItem,
    Organization,
    Permission,
    Role,
    StoredFile,
    Task,
    User,
    UserPreference,
    WorkspaceMembership,
)
from ..schemas import WorkspaceCreate, WorkspaceUpdate
from ..security import hash_password
from ..storage import StorageAdapter, get_storage
from .auth import issue_tokens

router = APIRouter(tags=["platform and files"])
settings = get_settings()
ALLOWED_MODULES = {
    "dashboard",
    "tasks",
    "schedule",
    "teams",
    "announcements",
    "files",
    "shows",
    "rehearsals",
    "songs",
    "setlists",
    "equipment",
    "expenses",
}
ALLOWED_FILES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
}
LOGO_FILES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


def require_platform(user: User = Depends(current_user)) -> User:
    if not user.is_platform_admin:
        raise HTTPException(status_code=403, detail="Platform administrator access required")
    return user


def workspace_json(org: Organization, members: int = 0) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "workspace_type": org.workspace_type,
        "is_active": org.is_active,
        "default_locale": org.default_locale,
        "timezone": org.timezone,
        "currency": org.currency,
        "primary_color": org.primary_color,
        "secondary_color": org.secondary_color,
        "enabled_modules": org.enabled_modules or [],
        "members": members,
        "created_at": org.created_at,
        "logo_url": f"/api/v1/platform/workspaces/{org.id}/logo" if org.logo_storage_key else None,
    }


@router.get("/platform/workspaces")
async def workspaces(actor: User = Depends(require_platform), db: AsyncSession = Depends(get_db)):
    allowed = select(WorkspaceMembership.organization_id).where(
        WorkspaceMembership.user_id == actor.id, WorkspaceMembership.is_active.is_(True)
    )
    rows = (
        await db.execute(
            select(Organization, func.count(User.id))
            .outerjoin(User, User.organization_id == Organization.id)
            .where(Organization.id.in_(allowed))
            .group_by(Organization.id)
            .order_by(Organization.name)
        )
    ).all()
    return [workspace_json(org, count) for org, count in rows]


@router.get("/platform/workspaces/{workspace_id}/logo")
async def platform_workspace_logo(
    workspace_id: str,
    actor: User = Depends(require_platform),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    authorized = await db.scalar(
        select(WorkspaceMembership.id).where(
            WorkspaceMembership.user_id == actor.id,
            WorkspaceMembership.organization_id == workspace_id,
            WorkspaceMembership.is_active.is_(True),
        )
    )
    if not authorized:
        raise HTTPException(status_code=404, detail="Workspace not found")
    org = await db.get(Organization, workspace_id)
    if not org or not org.logo_storage_key:
        raise HTTPException(status_code=404, detail="Logo not configured")
    return StreamingResponse(
        io.BytesIO(await storage.read(org.logo_storage_key)),
        media_type=org.logo_content_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.post("/platform/workspaces", status_code=201)
async def create_workspace(
    body: WorkspaceCreate, actor: User = Depends(require_platform), db: AsyncSession = Depends(get_db)
):
    if set(body.enabled_modules) - ALLOWED_MODULES:
        raise HTTPException(status_code=422, detail="Unknown module")
    if await db.scalar(
        select(Organization.id).where(or_(Organization.slug == body.slug, Organization.name == body.name))
    ):
        raise HTTPException(status_code=409, detail="Workspace name or slug already exists")
    org = Organization(
        **body.model_dump(exclude={"administrator_email", "administrator_name", "administrator_password"})
    )
    db.add(org)
    await db.flush()
    permissions = list((await db.scalars(select(Permission))).all())
    role = Role(organization_id=org.id, name="Workspace Administrator", description="Full workspace administration")
    db.add(role)
    await db.flush()
    db.add_all(
        [
            AccessGrant(
                organization_id=org.id,
                principal_type="role",
                principal_id=role.id,
                permission_id=p.id,
                scope="ORGANIZATION",
                effect="allow",
            )
            for p in permissions
        ]
    )
    admin = User(
        organization_id=org.id,
        email=body.administrator_email.lower(),
        full_name=body.administrator_name,
        password_hash=hash_password(body.administrator_password),
        roles=[role],
    )
    db.add(admin)
    await db.flush()
    db.add(UserPreference(user_id=admin.id, timezone=org.timezone, locale=org.default_locale))
    db.add(WorkspaceMembership(user_id=actor.id, organization_id=org.id, access_level="administrator"))
    nav = [
        ("Dashboard", "Dashboard", "/dashboard", "dashboard.view", 0),
        ("My Work", "CheckCircle", "/tasks", "tasks.view", 10),
        ("Schedule", "CalendarMonth", "/schedule", "schedule.view", 20),
        ("Files", "Folder", "/files", "files.view", 30),
        ("Administration", "AdminPanelSettings", "/admin", "users.view", 90),
    ]
    db.add_all(
        [
            NavigationItem(
                organization_id=org.id,
                title=t,
                icon=i,
                route=r,
                required_permission=p,
                order=o,
                module=r.strip("/") or None,
            )
            for t, i, r, p, o in nav
        ]
    )
    dashboard = Dashboard(organization_id=org.id, name=f"{org.name} overview", is_default=True)
    db.add(dashboard)
    await db.commit()
    await record_audit(
        actor, "platform.workspace.created", "organization", org.id, {"name": org.name, "type": org.workspace_type}
    )
    return workspace_json(org, 1)


@router.patch("/platform/workspaces/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    actor: User = Depends(require_platform),
    db: AsyncSession = Depends(get_db),
):
    membership = await db.scalar(
        select(WorkspaceMembership.id).where(
            WorkspaceMembership.user_id == actor.id,
            WorkspaceMembership.organization_id == workspace_id,
            WorkspaceMembership.is_active.is_(True),
        )
    )
    org = await db.get(Organization, workspace_id)
    if not membership or not org:
        raise HTTPException(status_code=404, detail="Workspace not found")
    values = body.model_dump(exclude_unset=True)
    if values.get("enabled_modules") is not None and set(values["enabled_modules"]) - ALLOWED_MODULES:
        raise HTTPException(status_code=422, detail="Unknown module")
    for key, value in values.items():
        setattr(org, key, value)
    await db.commit()
    await record_audit(actor, "platform.workspace.updated", "organization", org.id, {"fields": sorted(values)})
    return workspace_json(org)


@router.post("/platform/workspaces/{workspace_id}/switch")
async def switch_workspace(
    workspace_id: str, response: Response, actor: User = Depends(require_platform), db: AsyncSession = Depends(get_db)
):
    membership = await db.scalar(
        select(WorkspaceMembership.id).where(
            WorkspaceMembership.user_id == actor.id,
            WorkspaceMembership.organization_id == workspace_id,
            WorkspaceMembership.is_active.is_(True),
        )
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace not found")
    home_id = getattr(actor, "_home_organization_id", actor.organization_id)
    await record_audit(
        actor,
        "platform.workspace.switched",
        "organization",
        workspace_id,
        {"from": actor.organization_id, "to": workspace_id},
    )
    from sqlalchemy.orm import attributes

    attributes.set_committed_value(actor, "organization_id", home_id)
    return await issue_tokens(db, actor, response, workspace_id)


async def save_upload(
    upload: UploadFile,
    organization_id: str,
    uploader_id: str,
    context_type: str,
    context_id: str | None,
    storage: StorageAdapter,
    allowed: dict[str, str] = ALLOWED_FILES,
) -> StoredFile:
    filename = Path(upload.filename or "file").name
    extension = Path(filename).suffix.lower()
    expected = allowed.get(extension)
    if not expected or upload.content_type != expected:
        raise HTTPException(status_code=415, detail="File type is not allowed")
    content = await upload.read(settings.upload_max_bytes + 1)
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(status_code=413, detail="File exceeds upload limit")
    key = f"{organization_id}/{uuid4().hex}{extension}"
    await storage.put(key, content)
    return StoredFile(
        organization_id=organization_id,
        uploaded_by=uploader_id,
        original_filename=filename,
        display_name=filename,
        storage_key=key,
        content_type=expected,
        size=len(content),
        checksum=hashlib.sha256(content).hexdigest(),
        context_type=context_type,
        context_id=context_id,
    )


def file_json(item: StoredFile) -> dict:
    return {
        "id": item.id,
        "display_name": item.display_name,
        "original_filename": item.original_filename,
        "content_type": item.content_type,
        "size": item.size,
        "context_type": item.context_type,
        "context_id": item.context_id,
        "uploaded_by": item.uploaded_by,
        "created_at": item.created_at,
    }


@router.get("/files")
async def list_files(
    search: str = "",
    context_type: str | None = None,
    user: User = Depends(require_permission("files.view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(StoredFile).where(StoredFile.organization_id == user.organization_id)
    if search:
        query = query.where(StoredFile.display_name.ilike(f"%{search}%"))
    if context_type:
        query = query.where(StoredFile.context_type == context_type)
    return [file_json(x) for x in (await db.scalars(query.order_by(StoredFile.created_at.desc()))).all()]


@router.post("/files", status_code=201)
async def upload_file(
    context_type: str = Query("workspace", pattern="^(workspace|show|rehearsal|song|task|equipment|expense)$"),
    context_id: str | None = None,
    file: UploadFile = File(...),
    user: User = Depends(require_permission("files.upload")),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    item = await save_upload(file, user.organization_id, user.id, context_type, context_id, storage)
    db.add(item)
    await db.commit()
    await record_audit(
        user, "file.uploaded", "file", item.id, {"name": item.display_name, "size": item.size, "context": context_type}
    )
    return file_json(item)


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    user: User = Depends(require_permission("files.download")),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    item = await db.scalar(
        select(StoredFile).where(StoredFile.id == file_id, StoredFile.organization_id == user.organization_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="File not found")
    content = await storage.read(item.storage_key)
    safe = re.sub(r"[^A-Za-z0-9._ -]", "_", item.display_name)
    await record_audit(user, "file.downloaded", "file", item.id, {"name": safe})
    return StreamingResponse(
        io.BytesIO(content),
        media_type=item.content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe}"'},
    )


@router.delete("/files/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    user: User = Depends(require_permission("files.delete")),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    item = await db.scalar(
        select(StoredFile).where(StoredFile.id == file_id, StoredFile.organization_id == user.organization_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="File not found")
    await storage.delete(item.storage_key)
    await db.delete(item)
    await db.commit()
    await record_audit(user, "file.deleted", "file", file_id)
    return Response(status_code=204)


@router.post("/workspace/logo", status_code=201)
async def upload_logo(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    org = await db.get(Organization, user.organization_id)
    item = await save_upload(file, user.organization_id, user.id, "workspace_logo", org.id, storage, LOGO_FILES)
    content = await storage.read(item.storage_key)
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
            width, height = image.size
            if width < 64 or height < 64 or width > 4096 or height > 4096:
                raise HTTPException(status_code=422, detail="Logo dimensions must be between 64 and 4096 pixels")
    except UnidentifiedImageError as exc:
        await storage.delete(item.storage_key)
        raise HTTPException(status_code=415, detail="Invalid image content") from exc
    if org.logo_storage_key:
        await storage.delete(org.logo_storage_key)
    org.logo_storage_key = item.storage_key
    org.logo_content_type = item.content_type
    await db.commit()
    await record_audit(user, "workspace.logo.changed", "organization", org.id)
    return {"logo_url": "/api/v1/workspace/logo"}


@router.delete("/workspace/logo", status_code=204)
async def remove_logo(
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    org = await db.get(Organization, user.organization_id)
    if org.logo_storage_key:
        await storage.delete(org.logo_storage_key)
    org.logo_storage_key = None
    org.logo_content_type = None
    await db.commit()
    await record_audit(user, "workspace.logo.removed", "organization", org.id)
    return Response(status_code=204)


@router.patch("/workspace/settings")
async def workspace_settings(
    body: WorkspaceUpdate,
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, user.organization_id)
    allowed = {"name", "default_locale", "timezone", "currency", "primary_color", "secondary_color", "enabled_modules"}
    values = {key: value for key, value in body.model_dump(exclude_unset=True).items() if key in allowed}
    if values.get("enabled_modules") is not None and set(values["enabled_modules"]) - ALLOWED_MODULES:
        raise HTTPException(status_code=422, detail="Unknown module")
    for key, value in values.items():
        setattr(org, key, value)
    await db.commit()
    await record_audit(user, "workspace.settings.changed", "organization", org.id, {"fields": sorted(values)})
    return workspace_json(org)


@router.get("/workspace/logo")
async def workspace_logo(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
    storage: StorageAdapter = Depends(get_storage),
):
    org = await db.get(Organization, user.organization_id)
    if not org.logo_storage_key:
        raise HTTPException(status_code=404, detail="Logo not configured")
    return StreamingResponse(
        io.BytesIO(await storage.read(org.logo_storage_key)),
        media_type=org.logo_content_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


async def export_rows(user: User, db: AsyncSession) -> tuple[Dashboard, list[Task]]:
    dashboard = await db.scalar(
        select(Dashboard)
        .options(selectinload(Dashboard.widgets))
        .where(Dashboard.organization_id == user.organization_id, Dashboard.is_default.is_(True))
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not configured")
    scope = access_scope(user, "tasks.view")
    query = select(Task).where(Task.organization_id == user.organization_id)
    if scope == "OWN":
        query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id))
    elif scope == "TEAM":
        query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id, Task.team_id == user.team_id))
    elif scope == "DEPARTMENT":
        query = query.where(
            or_(Task.assignee_id == user.id, Task.creator_id == user.id, Task.department_id == user.department_id)
        )
    return dashboard, list((await db.scalars(query.order_by(Task.created_at.desc()))).all()) if scope else []


@router.get("/dashboards/default/export.pdf")
async def export_pdf(
    user: User = Depends(require_permission("dashboards.export_pdf")), db: AsyncSession = Depends(get_db)
):
    dashboard, tasks = await export_rows(user, db)
    org = user._workspace
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(48, height - 55, org.name)
    pdf.setFont("Helvetica", 12)
    pdf.drawString(48, height - 76, dashboard.name)
    pdf.drawString(48, height - 94, datetime.now(UTC).strftime("Exported %Y-%m-%d %H:%M UTC"))
    y = height - 130
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(48, y, "Authorized tasks")
    y -= 22
    pdf.setFont("Helvetica", 10)
    for task in tasks:
        if y < 55:
            pdf.showPage()
            y = height - 55
            pdf.setFont("Helvetica", 10)
        pdf.drawString(58, y, f"{task.title}  |  {task.status.value}  |  {task.priority}")
        y -= 17
    pdf.save()
    buffer.seek(0)
    await record_audit(user, "dashboard.exported", "dashboard", dashboard.id, {"format": "pdf"})
    return StreamingResponse(
        buffer, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="dashboard.pdf"'}
    )


@router.get("/dashboards/default/export.xlsx")
async def export_xlsx(
    user: User = Depends(require_permission("dashboards.export_excel")), db: AsyncSession = Depends(get_db)
):
    dashboard, tasks = await export_rows(user, db)
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Dashboard Summary"
    summary.append(["Workspace", user._workspace.name])
    summary.append(["Dashboard", dashboard.name])
    summary.append(["Exported", datetime.now(UTC).replace(tzinfo=None)])
    sheet = workbook.create_sheet("Tasks")
    sheet.append(["Title", "Status", "Priority", "Due date"])
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = "A1:D1"
    for task in tasks:
        sheet.append(
            [
                task.title,
                task.status.value,
                task.priority,
                task.due_date.replace(tzinfo=None) if task.due_date else None,
            ]
        )
    for column, width in zip("ABCD", [38, 18, 16, 22], strict=False):
        sheet.column_dimensions[column].width = width
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    await record_audit(user, "dashboard.exported", "dashboard", dashboard.id, {"format": "xlsx"})
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="dashboard.xlsx"'},
    )
