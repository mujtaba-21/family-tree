"""Builds the web/iPhone version: copies web/ to dist/ and writes the offline file list into sw.js."""
import json, os, shutil, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "web")
DST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist")

if os.path.exists(DST):
    shutil.rmtree(DST)
shutil.copytree(SRC, DST)

files = ["./"]
for base, _, names in os.walk(DST):
    for n in sorted(names):
        rel = os.path.relpath(os.path.join(base, n), DST).replace(os.sep, "/")
        if rel in ("sw.js",) or rel.startswith("."):
            continue
        files.append(rel)
files.sort()
sw_path = os.path.join(DST, "sw.js")
sw = open(sw_path, encoding="utf-8").read()
sw = sw.replace("__BUILD__", time.strftime("%Y%m%d%H%M%S")).replace("__FILES__", json.dumps(files, ensure_ascii=False))
open(sw_path, "w", encoding="utf-8").write(sw)
open(os.path.join(DST, ".nojekyll"), "w").close()
print(f"built {len(files)} files into {DST}")
