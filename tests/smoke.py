import asyncio, sys
from playwright.async_api import async_playwright
BASE = "http://localhost:8765/index.html"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ar-SA")
        pg = await ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path="/home/claude/shajara/tests/shots/01-families-empty.png")
        print("\n".join(errs) or "no errors")
        await b.close()
asyncio.run(main())
