import re
from pathlib import Path

src = Path(r"C:\Users\emely\Downloads\LoadInsight-Landing.html")
text = src.read_text(encoding="utf-8")
clean = re.sub(r"data:[^\"']+", "DATA", text)
out = Path(r"C:\Users\emely\Desktop\Syncora\scripts\landing-extract.txt")
out.write_text(clean, encoding="utf-8")
print("wrote", out, "chars", len(clean), "orig", len(text))
