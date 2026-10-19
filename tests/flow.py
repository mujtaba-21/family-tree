"""End-to-end walk through the app on a phone-sized screen, with screenshots."""
import asyncio, os, sys, json
from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8765/index.html"
SHOTS = "/home/claude/shajara/tests/shots"
OUT = "/home/claude/shajara/tests/out"
os.makedirs(SHOTS, exist_ok=True); os.makedirs(OUT, exist_ok=True)
errs = []

async def shot(pg, name):
    await pg.wait_for_timeout(250)
    await pg.screenshot(path=f"{SHOTS}/{name}.png", full_page=True)

async def add_kids(pg, rows):
    for i, (name, g) in enumerate(rows):
        inp = pg.locator(".brow .inp").nth(i)
        await inp.fill(name)
        row = pg.locator(".brow").nth(i)
        if g:
            await row.get_by_role("radio", name="ذكر" if g == "m" else "أنثى").click()

async def open_person(pg, name):
    await pg.locator("a.chip", has_text=name).first.click()
    await pg.wait_for_timeout(200)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, accept_downloads=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type in ("error",) else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_timeout(600)

        # ---- new family
        await pg.get_by_role("link", name="عائلة جديدة").click()
        await pg.locator('input[name=name]').fill("سعد")
        await pg.locator('.names-row input').first.fill("ناصر")
        await pg.locator('input[name=fam]').fill("السعيد")
        await shot(pg, "02-new-family")
        await pg.get_by_role("button", name="إنشاء العائلة").click()
        await pg.wait_for_timeout(300)
        await shot(pg, "03-root-empty")

        # ---- wife of the root, then children
        await pg.get_by_role("link", name="زوجة").click()
        await pg.locator('input[name=name]').fill("موضي")
        await pg.locator('.names-row input').first.fill("حمد")
        await pg.locator('input[name=fam]').fill("الراشد")
        await shot(pg, "04-add-spouse")
        await pg.get_by_role("button", name="إضافة الزوجة").click()
        await pg.wait_for_timeout(300)
        await pg.get_by_role("link", name="أبناء").first.click()
        await add_kids(pg, [("محمد", "m"), ("عبدالله", "m"), ("نورة", "f"), ("إبراهيم", "m"), ("سارة", "f")])
        await shot(pg, "05-add-kids")
        await pg.get_by_role("button", name="إضافة ٥ أبناء").click()
        await pg.wait_for_timeout(300)
        await shot(pg, "06-root-with-kids")

        # ---- عبدالله: wife from outside, children (gender memory now knows some names)
        await open_person(pg, "عبدالله")
        await pg.get_by_role("link", name="زوجة").click()
        await pg.locator('input[name=name]').fill("منيرة")
        await pg.locator('.names-row input').first.fill("علي")
        await pg.locator('input[name=fam]').fill("الحربي")
        await pg.get_by_role("button", name="إضافة الزوجة").click()
        await pg.wait_for_timeout(300)
        await pg.get_by_role("link", name="أبناء").first.click()
        await add_kids(pg, [("ناصر", "m"), ("الجوهرة", "f"), ("سعد", None), ("هيا", "f")])
        await shot(pg, "07-add-kids-auto-gender")
        await pg.get_by_role("button", name="إضافة ٤ أبناء").click()
        await pg.wait_for_timeout(300)

        # ---- محمد: wife, daughter لطيفة
        await pg.locator(".ib[aria-label='الجد الجامع']").click()
        await pg.wait_for_timeout(200)
        await open_person(pg, "محمد")
        await pg.get_by_role("link", name="زوجة").click()
        await pg.locator('input[name=name]').fill("هند")
        await pg.locator('input[name=fam]').fill("العتيبي")
        await pg.get_by_role("button", name="إضافة الزوجة").click()
        await pg.wait_for_timeout(300)
        await pg.get_by_role("link", name="أبناء").first.click()
        await add_kids(pg, [("لطيفة", "f"), ("فهد", "m")])
        await pg.get_by_role("button", name="إضافة الاثنين").click()
        await pg.wait_for_timeout(300)

        # ---- cousin marriage: ناصر (son of عبدالله) marries لطيفة (daughter of محمد)
        await pg.locator(".ib[aria-label='بحث']").click()
        await pg.locator(".sbar input").fill("ناصر عبدالله")
        await pg.wait_for_timeout(200)
        await shot(pg, "08-search")
        await pg.locator("a.res").first.click()
        await pg.wait_for_timeout(200)
        await pg.get_by_role("link", name="زوجة").click()
        await pg.get_by_role("radio", name="من العائلة").click()
        await pg.locator(".sbar input").fill("لطيفة")
        await pg.wait_for_timeout(200)
        await shot(pg, "09-spouse-from-family")
        await pg.locator("button.res").first.click()
        await pg.get_by_role("button", name="تسجيل").click()
        await pg.wait_for_timeout(300)
        await pg.get_by_role("link", name="أبناء").first.click()
        await add_kids(pg, [("عبدالله", None), ("موضي", "f")])
        await pg.get_by_role("button", name="إضافة الاثنين").click()
        await pg.wait_for_timeout(300)
        await shot(pg, "10-cousin-card")

        # ---- dates on عبدالله and the root
        await pg.locator(".ib[aria-label='الجد الجامع']").click()
        await open_person(pg, "عبدالله")
        await pg.locator("a.ib[aria-label='تعديل']").click()
        await pg.wait_for_timeout(200)
        date_rows = pg.locator(".date-row")
        await date_rows.nth(0).locator("input.y").fill("1355")
        await pg.locator(".field-date").nth(0).get_by_role("checkbox", name="تقريبي").click()
        await date_rows.nth(1).locator("input.y").fill("1420")
        await date_rows.nth(1).locator("select").select_option("9")
        await pg.locator('input[name=note]').fill("تاجر")
        await shot(pg, "11-edit")
        await pg.go_back()
        await pg.wait_for_timeout(300)
        await shot(pg, "12-card-with-stats")

        # ---- tree + export sheet
        await pg.locator(".ib[aria-label='شجرة العائلة']").click()
        await pg.wait_for_timeout(900)
        await shot(pg, "13-tree")
        await pg.get_by_role("button", name="تصدير").first.click()
        await pg.wait_for_timeout(300)
        await shot(pg, "14-export-sheet")
        async with pg.expect_download(timeout=60000) as dl:
            await pg.locator(".sheet").get_by_role("button", name="تصدير").click()
        d = await dl.value
        await d.save_as(f"{OUT}/tree.pdf")
        await pg.wait_for_timeout(300)
        # PowerPoint
        await pg.get_by_role("button", name="تصدير").first.click()
        await pg.wait_for_timeout(200)
        await pg.get_by_role("radio", name="PowerPoint للتعديل").click()
        await pg.wait_for_timeout(200)
        async with pg.expect_download(timeout=60000) as dl2:
            await pg.locator(".sheet").get_by_role("button", name="تصدير").click()
        d2 = await dl2.value
        await d2.save_as(f"{OUT}/tree.pptx")
        await pg.go_back()
        await pg.wait_for_timeout(300)

        # ---- backup export from the families list
        await pg.goto(BASE + "#/")
        await pg.wait_for_timeout(500)
        await shot(pg, "15-families")
        await pg.locator(".fam .ib").first.click()
        await shot(pg, "16-family-menu")
        async with pg.expect_download(timeout=30000) as dl3:
            await pg.get_by_role("button", name="تصدير البيانات").click()
        d3 = await dl3.value
        await d3.save_as(f"{OUT}/backup.zip")
        await pg.wait_for_timeout(300)
        # import it back as a copy
        async with pg.expect_file_chooser() as fc:
            await pg.get_by_role("button", name="استيراد من ملف").click()
        chooser = await fc.value
        await chooser.set_files(f"{OUT}/backup.zip")
        await pg.wait_for_timeout(500)
        await shot(pg, "17-import-choice")
        await pg.get_by_role("button", name="إضافة نسخة").click()
        await pg.wait_for_timeout(800)
        await pg.goto(BASE + "#/")
        await pg.wait_for_timeout(500)
        await shot(pg, "18-families-after-import")

        # ---- delete a person with children (leaves an empty slot)
        await pg.locator("a.fam").first.click()
        await pg.wait_for_timeout(300)
        await pg.locator(".ib[aria-label='الجد الجامع']").click()
        await open_person(pg, "عبدالله")
        await pg.locator("a.ib[aria-label='تعديل']").click()
        await pg.get_by_role("button", name="حذف عبدالله").click()
        await pg.wait_for_timeout(200)
        await shot(pg, "19-delete-dialog")
        await pg.locator(".dialog").get_by_role("button", name="حذف").click()
        await pg.wait_for_timeout(400)
        await shot(pg, "20-after-delete")
        await pg.locator(".ib[aria-label='شجرة العائلة']").click()
        await pg.wait_for_timeout(800)
        await shot(pg, "21-tree-after-delete")
        await b.close()
    print("\n".join(errs) or "no errors")

asyncio.run(main())
