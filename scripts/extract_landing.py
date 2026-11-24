from pathlib import Path
import re

source = Path(r"C:\Users\emely\Downloads\LoadInsight-Landing.html")
text = source.read_text(encoding="utf-8", errors="replace")
style = re.search(r"<style>(.*?)</style>", text, re.S)
body = re.search(r"<body[^>]*>(.*)</body>", text, re.S)
css = style.group(1) if style else ""
css = re.sub(r'url\("data:[^"]+"\)', "url()", css)
html = body.group(1) if body else ""
html = re.sub(r'src="data:[^"]+"', 'src=""', html)
html = re.sub(r"\s+", " ", html)
out = Path(r"C:\Users\emely\Desktop\Syncora\scripts\_landing_extract.txt")
out.write_text("CSS_START\n" + css + "\nCSS_END\nHTML_START\n" + html[:25000] + "\nHTML_END\n", encoding="utf-8")
print("css", len(css), "html_snip", min(len(html), 25000))
