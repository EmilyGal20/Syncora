from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

SYSTEM_NOTIFICATION_TYPES = (
    "task.assigned",
    "booking.created",
    "booking.approved",
    "booking.rejected",
    "support.reply",
    "support.created",
    "dashboard.assigned",
    "registration.submitted",
)

DEFAULT_SYSTEM_NOTIFICATIONS = {
    "types": {code: True for code in SYSTEM_NOTIFICATION_TYPES},
    "audience": "organization",
    "target_ids": [],
}


def normalize_system_notifications(value: object | None) -> dict:
    data = value if isinstance(value, dict) else {}
    incoming = data.get("types") if isinstance(data.get("types"), dict) else {}
    audience = data.get("audience") if data.get("audience") in {"organization", "roles", "users"} else "organization"
    raw_targets = data.get("target_ids") if isinstance(data.get("target_ids"), list) else []
    targets = [item for item in raw_targets if isinstance(item, str) and item][:200]
    return {
        "types": {code: bool(incoming.get(code, True)) for code in SYSTEM_NOTIFICATION_TYPES},
        "audience": "organization" if audience == "organization" else audience,
        "target_ids": [] if audience == "organization" else targets,
    }


def should_deliver(codes: set[str], user_id: str, role_ids: set[str], policy: dict) -> bool:
    if "system_notifications.receive" not in codes or "system_notifications.enabled" not in codes:
        return False
    audience = policy.get("audience")
    targets = set(policy.get("target_ids") or [])
    if audience == "users":
        return user_id in targets
    if audience == "roles":
        return bool(role_ids & targets)
    return True


def ensure_system_notifications_column(connection: Connection) -> None:
    inspector = inspect(connection)
    if "organizations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "system_notifications" not in columns:
        connection.execute(text("ALTER TABLE organizations ADD COLUMN system_notifications JSON"))
