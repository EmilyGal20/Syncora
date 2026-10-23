import os
from pathlib import Path

os.environ["SYNCORA_NO_WINDOW"] = "true"
os.environ["SYNCORA_APP_PORT"] = os.environ.get("SYNCORA_APP_PORT", "8765")
import runpy

runpy.run_path(str(Path(__file__).resolve().parents[1] / "apps" / "desktop" / "launch.py"), run_name="__main__")
