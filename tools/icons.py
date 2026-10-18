"""Render the app icon (SVG) to every PNG size the web app and Android need."""
import asyncio, os
from playwright.async_api import async_playwright

BG = "#2F5D50"; FG = "#F4EFE5"
def glyph(scale=1.0):
    # family-tree glyph: ancestor on top, three descendants below (square = male, round = female)
    g = f'''<g transform="translate(256 256) scale({scale}) translate(-256 -246)" fill="{FG}" stroke="{FG}" stroke-linecap="round" stroke-linejoin="round">
      <rect x="200" y="92" width="112" height="84" rx="12"/>
      <path d="M256 176V236M120 236H392M120 236V292M256 236V292M392 236V292" fill="none" stroke-width="18"/>
      <rect x="74" y="292" width="92" height="72" rx="10"/>
      <rect x="210" y="292" width="92" height="72" rx="36"/>
      <rect x="346" y="292" width="92" height="72" rx="10"/>
    </g>'''
    return g
def svg(kind):
    if kind == "any":        body = f'<rect width="512" height="512" rx="112" fill="{BG}"/>' + glyph(1.0)
    elif kind == "square":   body = f'<rect width="512" height="512" fill="{BG}"/>' + glyph(1.0)
    elif kind == "maskable": body = f'<rect width="512" height="512" fill="{BG}"/>' + glyph(0.78)
    elif kind == "round":    body = f'<circle cx="256" cy="256" r="256" fill="{BG}"/>' + glyph(0.86)
    elif kind == "fg":       body = glyph(0.60)   # adaptive icon foreground (transparent), inside the safe zone
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{body}</svg>'

OUT_WEB = "/home/claude/shajara/web/icons"
OUT_AND = "/home/claude/shajara/android-shell/res"
jobs = [(f"{OUT_WEB}/icon-192.png", "any", 192), (f"{OUT_WEB}/icon-512.png", "any", 512),
        (f"{OUT_WEB}/icon-maskable-512.png", "maskable", 512), (f"{OUT_WEB}/apple-touch-icon.png", "square", 180),
        ("/home/claude/shajara/tools/icon-preview.png", "any", 256)]
for d, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    jobs.append((f"{OUT_AND}/mipmap-{d}/ic_launcher.png", "any", px))
    jobs.append((f"{OUT_AND}/mipmap-{d}/ic_launcher_round.png", "round", px))
    jobs.append((f"{OUT_AND}/mipmap-{d}/ic_launcher_foreground.png", "fg", int(px * 108 / 48)))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        for path, kind, px in jobs:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            await pg.set_viewport_size({"width": px, "height": px})
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(kind).replace("<svg ", f"<svg width=\"{px}\" height=\"{px}\" ")}</body></html>')
            await pg.locator("svg").screenshot(path=path, omit_background=True)
        await b.close()
asyncio.run(main())
print(len(jobs), "icons")
