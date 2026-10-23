from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

DEFAULT_INSTALL_PROMPT = {"navbar": True, "notice": True, "message": ""}


def normalize_install_prompt(value: object | None) -> dict:
    data = value if isinstance(value, dict) else {}
    message = str(data.get("message") or "").strip()[:400]
    return {
        "navbar": bool(data.get("navbar", DEFAULT_INSTALL_PROMPT["navbar"])),
        "notice": bool(data.get("notice", DEFAULT_INSTALL_PROMPT["notice"])),
        "message": message,
    }


def ensure_install_prompt_column(connection: Connection) -> None:
    inspector = inspect(connection)
    if "organizations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "install_prompt" not in columns:
        connection.execute(text("ALTER TABLE organizations ADD COLUMN install_prompt JSON"))
