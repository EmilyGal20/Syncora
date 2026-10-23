from typing import Any

AUDIENCES = {"organization", "users", "organizations"}


def notice_visible(notice: Any, user: Any, allowed_notice: bool) -> bool:
    if not notice.enabled:
        return False
    targets = list(notice.target_ids or [])
    if notice.audience == "users":
        return user.id in targets
    if notice.audience == "organizations":
        return allowed_notice and user.organization_id in targets
    return allowed_notice and notice.organization_id == user.organization_id


def notice_json(notice: Any) -> dict:
    return {
        "id": notice.id,
        "message": notice.message or "",
        "enabled": bool(notice.enabled),
        "audience": notice.audience if notice.audience in AUDIENCES else "organization",
        "target_ids": list(notice.target_ids or []),
        "created_at": notice.created_at,
    }
