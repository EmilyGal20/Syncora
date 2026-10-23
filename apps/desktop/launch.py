from __future__ import annotations

import os
import socket
import sys
import threading
import time
import traceback
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API_DIR = REPO / "apps" / "api"
WEB_DIST = REPO / "apps" / "web" / "dist"
LAN_CORS = (
    r"^https?://(localhost|127\.0\.0\.1|\[::1\]|10(?:\.\d{1,3}){3}|"
    r"192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}"
    r"|[a-zA-Z0-9-]+(?:\.local)?)(:\d+)?$"
)


def data_dir() -> Path:
    root = Path(os.environ.get("LOCALAPPDATA") or os.environ.get("HOME") or Path.home()) / "Syncora"
    root.mkdir(parents=True, exist_ok=True)
    (root / "storage").mkdir(exist_ok=True)
    return root


def write_log(root: Path, message: str) -> None:
    with (root / "syncora-app.log").open("a", encoding="utf-8") as handle:
        handle.write(message.rstrip() + "\n")


def ensure_secret(root: Path) -> str:
    path = root / "jwt-secret.txt"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    secret = os.urandom(32).hex()
    path.write_text(secret, encoding="utf-8")
    return secret


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def listen_port() -> int:
    requested = int(os.environ.get("SYNCORA_APP_PORT") or 8765)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("0.0.0.0", requested))
            return requested
        except OSError:
            return free_port()


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def prepare_env() -> tuple[int, str, str, Path]:
    root = data_dir()
    db = (root / "syncora.db").as_posix()
    port = listen_port()
    local = f"http://127.0.0.1:{port}"
    phone = f"http://{lan_ip()}:{port}"
    os.environ["SYNCORA_APP"] = "true"
    os.environ["APP_MODE"] = "true"
    os.environ["ENVIRONMENT"] = "development"
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db}"
    os.environ["JWT_SECRET"] = ensure_secret(root)
    os.environ["STORAGE_LOCAL_ROOT"] = str(root / "storage")
    os.environ["PUBLIC_APP_URL"] = local
    os.environ["COOKIE_SECURE"] = "false"
    os.environ["CORS_ORIGINS"] = f"{local},{phone}"
    os.environ["CORS_ORIGIN_REGEX"] = LAN_CORS
    (root / "phone-url.txt").write_text(
        f"On this computer: {local}\nOn your phone (same Wi-Fi): {phone}\n",
        encoding="utf-8",
    )
    return port, local, phone, root


def wait_ready(origin: str, timeout: float = 40) -> None:
    deadline = time.time() + timeout
    last_error = "timeout"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{origin}/health", timeout=1) as response:
                if response.status < 500:
                    return
        except Exception as exc:
            last_error = str(exc)
            time.sleep(0.15)
    raise RuntimeError(f"Syncora did not start: {last_error}")


def main() -> int:
    root = data_dir()
    try:
        if not WEB_DIST.exists():
            write_log(root, "Missing apps/web/dist. Run npm --prefix apps/web run build.")
            print("The app UI is missing. Run npm --prefix apps/web run build once, then open Syncora again.", flush=True)
            return 1
        port, origin, phone, root = prepare_env()
        write_log(root, f"starting {origin} phone {phone}")
        print(f"Syncora window: {origin}", flush=True)
        print(f"Phone (same Wi-Fi): {phone}", flush=True)
        print("On iPhone/Android: open that address, then Add to Home Screen.", flush=True)
        sys.path.insert(0, str(API_DIR))
        from app.config import get_settings

        get_settings.cache_clear()
        from app.main import app
        import uvicorn

        server = uvicorn.Server(
            uvicorn.Config(app, host="0.0.0.0", port=port, log_level="warning", access_log=False)
        )
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        wait_ready(origin)
        if os.environ.get("SYNCORA_NO_WINDOW") == "true":
            thread.join()
            return 0
        try:
            import webview
        except ImportError:
            write_log(root, "pywebview missing; opening browser")
            import webbrowser

            webbrowser.open(origin)
            thread.join()
            return 0
        webview.create_window("Syncora", origin, width=1440, height=920, min_size=(390, 700))
        webview.start()
        server.should_exit = True
        return 0
    except Exception:
        write_log(root, traceback.format_exc())
        raise


if __name__ == "__main__":
    raise SystemExit(main())
