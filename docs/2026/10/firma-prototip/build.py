#!/usr/bin/env python3
"""Sklapa firma-dizajn.html: board.template.html + app.css + app.js + snimci (data URI)."""
import base64, pathlib, re, sys
here = pathlib.Path(__file__).parent
shots = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "shots"
t = (here / "board.template.html").read_text(encoding="utf-8")
t = t.replace("/*__APP_CSS__*/", (here / "app.css").read_text(encoding="utf-8"))
t = t.replace("/*__APP_JS__*/", (here / "app.js").read_text(encoding="utf-8"))
def img(m):
    f = shots / (m.group(1) + ".webp")
    return "data:image/webp;base64," + base64.b64encode(f.read_bytes()).decode()
t = re.sub(r"__IMG_([a-z0-9-]+)__", img, t)
out = here / "firma-dizajn.html"
out.write_text(t, encoding="utf-8")
print(out, len(t) // 1024, "KB")
