"""Imports the 137-person sample family and exercises the tree and exports."""
import asyncio, time, os
from playwright.async_api import async_playwright

BASE = "http://localhost:8765/index.html"
SH = "/home/claude/shajara/tests/shots"
OUT = "/home/claude/shajara/tests/out"
errs = []

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, accept_downloads=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_timeout(500)
        async with pg.expect_file_chooser() as fc:
            await pg.get_by_role("button", name="استيراد من ملف").click()
        await (await fc.value).set_files(f"{OUT}/sample137.json")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{SH}/b1-root.png", full_page=True)
        # a G2 son with many children, then his card
        await pg.locator("a.chip", has_text="يزيد").first.click()
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/b2-yazid.png", full_page=True)
        await pg.locator("a.chip", has_text="سعد").first.click()  # back to the polygamous brother via siblings
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/b3-saad-two-wives.png", full_page=True)
        t0 = time.time()
        await pg.locator(".ib[aria-label='شجرة العائلة']").click()
        await pg.wait_for_selector(".stage svg", timeout=30000)
        print("tree screen:", round(time.time() - t0, 2), "s")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SH}/b4-tree.png")
        await pg.locator(".ib[aria-label='الشجرة كاملة']").click()
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SH}/b5-tree-fit.png")
        # export PDF with dates
        await pg.get_by_role("button", name="التصميم").click()
        await pg.wait_for_timeout(300)
        await pg.locator(".sheet .tog", has_text="الميلاد").click()
        await pg.locator(".sheet .tog", has_text="الوفاة").click()
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SH}/b6-design-sheet.png")
        await pg.get_by_role("button", name="تم").click()
        await pg.wait_for_timeout(300)
        await pg.get_by_role("button", name="تصدير").first.click()
        await pg.wait_for_timeout(300)
        await pg.get_by_role("radio", name="PDF للطباعة").click()
        t0 = time.time()
        async with pg.expect_download(timeout=180000) as dl:
            await pg.locator(".sheet").get_by_role("button", name="تصدير الشجرة").click()
        await (await dl.value).save_as(f"{OUT}/big.pdf")
        print("pdf export:", round(time.time() - t0, 2), "s")
        await pg.wait_for_timeout(500)
        await pg.get_by_role("button", name="تصدير").first.click()
        await pg.get_by_role("radio", name="PowerPoint للتعديل").click()
        await pg.wait_for_timeout(300)
        t0 = time.time()
        async with pg.expect_download(timeout=180000) as dl2:
            await pg.locator(".sheet").get_by_role("button", name="تصدير الشجرة").click()
        await (await dl2.value).save_as(f"{OUT}/big.pptx")
        print("pptx export:", round(time.time() - t0, 2), "s")
        await b.close()
    print("\n".join(errs) or "no errors")

asyncio.run(main())
