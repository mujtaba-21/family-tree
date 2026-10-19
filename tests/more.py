"""Second walkthrough: photos, unknown mother, nickname, reorder, remove marriage, export variants, settings, back button."""
import asyncio
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
        await pg.goto(BASE); await pg.wait_for_timeout(500)
        # new family with a root, kids added directly (mother unknown)
        await pg.get_by_role("link", name="عائلة جديدة").click()
        await pg.locator('input[name=name]').fill("حمد")
        await pg.locator('input[name=fam]').fill("الراشد")
        await pg.get_by_role("button", name="إنشاء العائلة").click(); await pg.wait_for_timeout(300)
        await pg.get_by_role("link", name="أبناء").click()
        rows = [("خالد", "m"), ("مها", "f"), ("بدر", "m")]
        for i, (n, g) in enumerate(rows):
            await pg.locator(".brow .inp").nth(i).fill(n)
            await pg.locator(".brow").nth(i).get_by_role("radio", name="ذكر" if g == "m" else "أنثى").click()
        await pg.get_by_role("button", name="إضافة ٣ أبناء").click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/m1-unknown-mother.png", full_page=True)
        # add a wife and assign two of the children to her
        await pg.get_by_role("link", name="زوجة").click()
        await pg.locator('input[name=name]').fill("شيخة")
        await pg.locator('input[name=fam]').fill("السبيعي")
        await pg.get_by_role("checkbox", name="بدر").click()  # untick بدر (all ticked by default for the first wife)
        await pg.screenshot(path=f"{SH}/m2-assign-kids.png", full_page=True)
        await pg.get_by_role("button", name="إضافة الزوجة").click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/m3-after-assign.png", full_page=True)
        # help popover + back button closes it
        await pg.locator(".help").first.click(); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SH}/m4-help.png")
        await pg.go_back(); await pg.wait_for_timeout(300)
        print("after back, overlays:", await pg.locator(".pop").count(), "url:", pg.url.split("#")[1])
        # reorder sheet
        await pg.locator(".card .ib[aria-label='خيارات']").first.click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/m5-union-menu.png")
        await pg.get_by_role("button", name="ترتيب الأبناء").click(); await pg.wait_for_timeout(300)
        await pg.locator(".order-row").nth(1).get_by_role("button", name="تقديم").click()
        await pg.screenshot(path=f"{SH}/m6-reorder.png")
        await pg.get_by_role("button", name="تم").click(); await pg.wait_for_timeout(300)
        # edit root: nickname + photo + Gregorian birth date
        await pg.locator("a.ib[aria-label='تعديل']").click(); await pg.wait_for_timeout(200)
        await pg.locator('input[name=nick]').fill("أبو خالد")
        await pg.locator(".toggle-row .sw").first.click()
        await pg.locator(".field-date").nth(0).get_by_role("radio", name="م").click()
        await pg.locator(".date-row").nth(0).locator("input.y").fill("1931")
        await pg.locator(".date-row").nth(0).locator("select").select_option("3")
        await pg.locator(".date-row").nth(0).locator("input.d").fill("14")
        async with pg.expect_file_chooser() as fc:
            await pg.get_by_role("button", name="إضافة صورة").click()
        await (await fc.value).set_files(f"{OUT}/face.jpg")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f"{SH}/m7-edit-photo.png", full_page=True)
        await pg.go_back(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SH}/m8-card-nick-photo.png", full_page=True)
        # remove a marriage without children: add a second wife then remove it
        await pg.get_by_role("link", name="زوجة").click()
        await pg.locator('input[name=name]').fill("نوف")
        await pg.get_by_role("button", name="إضافة الزوجة").click(); await pg.wait_for_timeout(300)
        await pg.locator(".card .ib[aria-label='خيارات']").last.click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("button", name="حذف الزواج").click(); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SH}/m9-remove-marriage.png")
        await pg.locator(".dialog").get_by_role("button", name="حذف الزواج").click(); await pg.wait_for_timeout(300)
        print("spouse cards after removal:", await pg.locator(".spouse-h").count())
        # tree exports: photos + gender-neutral + line mode + gender order
        await pg.locator(".ib[aria-label='شجرة العائلة']").click(); await pg.wait_for_timeout(700)
        await pg.get_by_role("button", name="التصميم").click(); await pg.wait_for_timeout(300)
        await pg.locator(".sheet .tog", has_text="الصورة").click()
        await pg.locator(".sheet .toggle-row .sw").click()
        await pg.get_by_role("radio", name="الذكور ثم الإناث").click()
        await pg.get_by_role("radio", name="خط بينهما").click()
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SH}/m10-export-variant.png")
        await pg.get_by_role("button", name="تم").click(); await pg.wait_for_timeout(300)
        await pg.get_by_role("button", name="تصدير").first.click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("radio", name="PDF للطباعة").click()
        async with pg.expect_download(timeout=60000) as dl:
            await pg.locator(".sheet").get_by_role("button", name="تصدير").click()
        await (await dl.value).save_as(f"{OUT}/variant.pdf")
        await pg.get_by_role("button", name="تصدير").first.click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("radio", name="PowerPoint للتعديل").click(); await pg.wait_for_timeout(200)
        async with pg.expect_download(timeout=60000) as dl2:
            await pg.locator(".sheet").get_by_role("button", name="تصدير").click()
        await (await dl2.value).save_as(f"{OUT}/variant.pptx")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SH}/m11-tree-variant.png")
        # settings: Gregorian first
        await pg.goto(BASE + "#/settings"); await pg.wait_for_timeout(300)
        await pg.get_by_role("radio", name="ميلادي").click()
        await pg.screenshot(path=f"{SH}/m12-settings.png")
        await pg.goto(BASE + "#/"); await pg.wait_for_timeout(300)
        await pg.locator("a.fam").first.click(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SH}/m13-card-gregorian.png")
        await b.close()
    print("\n".join(errs) or "no errors")

asyncio.run(main())
