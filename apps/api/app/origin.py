from urllib.parse import urlsplit

from fastapi import Request

from .config import get_settings


def public_app_origin(request: Request | None = None) -> str:
    settings = get_settings()
    if request is not None:
        origin_header = (request.headers.get("origin") or "").strip()
        if origin_header:
            parts = urlsplit(origin_header)
            if parts.scheme and parts.netloc:
                return f"{parts.scheme}://{parts.netloc}"
        forwarded_host = request.headers.get("x-forwarded-host")
        host = (forwarded_host or request.headers.get("host") or "").split(",")[0].strip()
        forwarded_proto = request.headers.get("x-forwarded-proto")
        proto = (forwarded_proto or request.url.scheme or "http").split(",")[0].strip()
        if host:
            hostname, separator, port = host.partition(":")
            if separator and port in {"8500", "8501"}:
                host = f"{hostname}:8600"
            return f"{proto}://{host}"
    return settings.public_app_url.rstrip("/")
