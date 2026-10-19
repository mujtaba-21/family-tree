"""Tree screen: layouts, designs (palettes and decorated), tapping a person, exports. Screenshots in tests/shots/t*."""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8765/index.html"
SH = "/home/claude/shajara/tests/shots"
OUT = "/home/claude/shajara/tests/out"
errs = []


async def js_wait(pg, expr, timeout=30):
    for _ in range(int(timeout / 0.2)):
        if await pg.evaluate(expr):
            return
        await asyncio.sleep(0.2)
    raise TimeoutError(expr)


async def main(which):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, accept_downloads=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_selector("body.ready")
        async with pg.expect_file_chooser() as fc:
            await pg.get_by_role("button", name="استيراد من ملف").click()
        await (await fc.value).set_files(f"{OUT}/sample137.json")
        await pg.wait_for_selector("a.chip")
        await pg.locator("button[aria-label='شجرة العائلة']").click()
        await pg.wait_for_selector(".stage svg")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SH}/t01-tree.png")
        await pg.locator("button[aria-label='الشجرة كاملة']").click()
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/t02-tree-whole.png")
        # design sheet
        await pg.get_by_role("button", name="التصميم").click()
        await pg.wait_for_selector(".sheet.design")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=f"{SH}/t03-design-sheet.png")
        info = []
        for i, lab in enumerate(["عمودي كامل", "مرن", "متوازن"]):
            await pg.locator(".sheet.design button[role=radio]", has_text=lab).click()
            await pg.wait_for_timeout(500)
            dims = await pg.evaluate("(() => { const s = document.querySelector('.stage svg'); return s.getAttribute('viewBox'); })()")
            info.append((lab, dims))
            await pg.screenshot(path=f"{SH}/t04-layout-{i}.png")
        print("layouts:", info)
        if which in ("all", "themes"):
            names = await pg.locator(".sheet.design .swatch .sw-name").all_text_contents()
            for i, n in enumerate(names):
                await pg.locator(".sheet.design .swatch").nth(i).click()
                await pg.wait_for_timeout(450)
                await pg.screenshot(path=f"{SH}/t05-theme-{i:02d}.png")
            print("themes:", names)
            await pg.locator(".sheet.design .swatch").nth(0).click()
            await pg.wait_for_timeout(300)
        await pg.get_by_role("button", name="تم").click()
        await pg.wait_for_timeout(400)
        # tap a person
        g = pg.locator(".stage g[data-pid]").nth(5)
        bb = await g.bounding_box()
        await pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        await pg.wait_for_selector(".sheet .acts", timeout=5000)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/t06-person-actions.png")
        acts = await pg.locator(".sheet .acts button").all_text_contents()
        print("actions:", acts)
        await pg.mouse.click(195, 120)  # tap outside closes
        await pg.wait_for_timeout(400)
        print("sheet after tap outside:", await pg.locator(".sheet").count())
        # export sheet
        await pg.get_by_role("button", name="تصدير").first.click()
        await pg.wait_for_selector(".sheet")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/t07-export-sheet.png")
        await pg.mouse.click(195, 120)
        await pg.wait_for_timeout(300)
        if which in ("all", "exports"):
            for theme_idx, tag in [(0, "calm"), (7, "sadu"), (8, "islamic"), (9, "parchment"), (10, "botanical"), (11, "gold")]:
                await pg.get_by_role("button", name="التصميم").click()
                await pg.wait_for_selector(".sheet.design")
                await pg.locator(".sheet.design .swatch").nth(theme_idx).click()
                await pg.wait_for_timeout(300)
                await pg.get_by_role("button", name="تم").click()
                await pg.wait_for_timeout(300)
                for fmt, ext in [("PDF للطباعة", "pdf"), ("PowerPoint للتعديل", "pptx")]:
                    if ext == "pptx" and tag not in ("calm", "sadu", "gold"):
                        continue
                    await pg.get_by_role("button", name="تصدير").first.click()
                    await pg.wait_for_selector(".sheet button[role=radio]")
                    await pg.locator(".sheet button[role=radio]", has_text=fmt).click()
                    async with pg.expect_download(timeout=180000) as dl:
                        await pg.locator(".sheet button.btn.primary", has_text="تصدير").click()
                    await (await dl.value).save_as(f"{OUT}/design-{tag}.{ext}")
                    await pg.wait_for_timeout(300)
            print("exports saved")
        await b.close()
    print("\n".join(errs) or "no errors")


asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "all"))
