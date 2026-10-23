from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text

from .config import get_settings
from .database import Base, SessionLocal, engine
from .install_prompt import ensure_install_prompt_column
from .infrastructure.mongodb import mongo
from .infrastructure.mongodb.migration import migrate_compatibility_documents
from .routers import auth, band, bookings, collaboration, core, notes, phase2, platform, requests_support
from .seed import seed

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await mongo.connect()
    if settings.environment == "development" or settings.app_mode:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
            await connection.run_sync(ensure_install_prompt_column)
        async with SessionLocal() as db:
            await seed(db)
            await migrate_compatibility_documents(db)
    yield
    await mongo.close()


app = FastAPI(title="Syncora API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_origin_regex=settings.cors_origin_regex if settings.environment == "development" or settings.app_mode else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN" if settings.app_mode else "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred"})


@app.get("/health", tags=["system"])
async def health():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=503, content={"status": "unhealthy", "service": "syncora-api", "database": "unavailable"}
        )
    return {
        "status": "healthy" if (settings.app_mode or mongo.available) else "degraded",
        "service": "syncora-api",
        "database": "connected",
        "mongodb": "disabled" if settings.app_mode else ("connected" if mongo.available else "unavailable"),
        "audit": "configured",
        "realtime": "available",
    }


app.include_router(auth.router, prefix="/api/v1")
app.include_router(core.router, prefix="/api/v1")
app.include_router(phase2.router, prefix="/api/v1")
app.include_router(platform.router, prefix="/api/v1")
app.include_router(band.router, prefix="/api/v1")
app.include_router(collaboration.router, prefix="/api/v1")
app.include_router(requests_support.router, prefix="/api/v1")
app.include_router(notes.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")

WEB_DIST = Path(__file__).resolve().parents[3] / "apps" / "web" / "dist"


def _app_file(full_path: str):
    if not settings.app_mode or not WEB_DIST.exists():
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    if full_path.startswith("api/") or full_path in {"health", "docs", "openapi.json", "redoc"}:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    root = WEB_DIST.resolve()
    candidate = (WEB_DIST / full_path).resolve() if full_path else root / "index.html"
    try:
        candidate.relative_to(root)
    except ValueError:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(root / "index.html")


@app.get("/", include_in_schema=False)
async def app_root():
    return _app_file("")


@app.get("/{full_path:path}", include_in_schema=False)
async def app_shell(full_path: str):
    return _app_file(full_path)
