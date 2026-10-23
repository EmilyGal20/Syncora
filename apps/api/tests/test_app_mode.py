from pathlib import Path

from app.config import Settings


def test_syncora_app_env_enables_app_mode(monkeypatch):
    monkeypatch.setenv("SYNCORA_APP", "true")
    monkeypatch.setenv("APP_MODE", "true")
    settings = Settings(_env_file=None)
    assert settings.app_mode is True


def test_web_dist_exists_beside_repo():
    dist = Path(__file__).resolve().parents[3] / "apps" / "web" / "dist"
    assert dist.parent.name == "web"
