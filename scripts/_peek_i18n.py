from pathlib import Path

t = Path("apps/web/src/i18n.ts").read_text(encoding="utf-8")
idx = 0
while True:
    i = t.find("supportNotes:", idx)
    if i < 0:
        break
    print("SN", repr(t[i : i + 140]))
    idx = i + 1
idx = 0
while True:
    i = t.find("install:{", idx)
    if i < 0:
        break
    print("IN", repr(t[i : i + 360]))
    idx = i + 1
