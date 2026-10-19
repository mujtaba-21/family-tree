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

async def family(pg, spouse=None, fam=None, kids=(), unknown=False):
    """Fills the open family sheet (spouse and children) and closes it with «تم»."""
    await pg.wait_for_selector(".sheet.family")
    if spouse:
        await pg.locator(".sheet.family input[name=spouse]").fill(spouse)
    if unknown:
        await pg.locator(".sheet.family button.check").first.click()
    if fam:
        await pg.locator(".sheet.family input[name=spouseFam]").fill(fam)
    for i, (name, g) in enumerate(kids):
        row = pg.locator(".sheet.family .brow").nth(i)
        await row.locator("input").fill(name)
        if g:
            await row.get_by_role("radio", name="ذكر" if g == "m" else "أنثى").click()


async def done(pg):
    await pg.locator(".sheet.family .fs > button.btn.primary").click()
    await pg.wait_for_selector(".sheet.family", state="detached")
    await pg.wait_for_timeout(300)


async def to_root(pg):
    if await pg.locator("header .title-link").count():
        await pg.locator("header .title-link").click()
        await pg.wait_for_timeout(300)


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

        # ---- wife of the root and children, in one sheet
        await pg.locator("main .btn.ghost", has_text="زوجة وأبناء").click()
        await family(pg, "موضي", "الراشد", [("محمد", "m"), ("عبدالله", "m"), ("نورة", "f"), ("إبراهيم", "m"), ("سارة", "f")])
        await shot(pg, "05-add-kids")
        await done(pg)
        await shot(pg, "06-root-with-kids")

        # ---- عبدالله: wife from outside, children (gender memory now knows some names)
        await open_person(pg, "عبدالله")
        await pg.locator("main .btn.ghost", has_text="زوجة وأبناء").click()
        await family(pg, "منيرة", "الحربي", [("ناصر", "m"), ("الجوهرة", "f"), ("سعد", None), ("هيا", "f")])
        await shot(pg, "07-add-kids-auto-gender")
        await done(pg)

        # ---- محمد: wife, daughter لطيفة
        await to_root(pg)
        await open_person(pg, "محمد")
        await pg.locator("main .btn.ghost", has_text="زوجة وأبناء").click()
        await family(pg, "هند", "العتيبي", [("لطيفة", "f"), ("فهد", "m")])
        await done(pg)

        # ---- cousin marriage: ناصر (son of عبدالله) marries لطيفة (daughter of محمد)
        await pg.locator(".ib[aria-label='بحث']").click()
        await pg.locator(".sbar input").fill("ناصر عبدالله")
        await pg.wait_for_timeout(200)
        await shot(pg, "08-search")
        await pg.locator("a.res").first.click()
        await pg.wait_for_timeout(200)
        await pg.locator("main .btn.ghost", has_text="زوجة وأبناء").click()
        await pg.wait_for_selector(".sheet.family")
        await pg.locator(".sheet.family a.link-t").click()
        await pg.wait_for_selector(".sbar input")
        await pg.locator(".sbar input").fill("لطيفة")
        await pg.wait_for_timeout(200)
        await shot(pg, "09-spouse-from-family")
        await pg.locator("button.res").first.click()
        await pg.get_by_role("button", name="تسجيل").click()
        await pg.wait_for_timeout(300)
        await pg.locator(".card button.addkids").first.click()
        await family(pg, kids=[("عبدالله", None), ("موضي", "f")])
        await done(pg)
        await shot(pg, "10-cousin-card")

        # ---- dates on عبدالله and the root
        await to_root(pg)
        await open_person(pg, "عبدالله")
        await pg.locator("a.ib[aria-label='تعديل']").click()
        await pg.wait_for_timeout(200)
        await pg.locator(".opt-sec").click()  # the optional part opens
        await pg.wait_for_timeout(400)
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
            await pg.locator(".sheet").get_by_role("button", name="تصدير الشجرة").click()
        d = await dl.value
        await d.save_as(f"{OUT}/tree.pdf")
        await pg.wait_for_timeout(300)
        # PowerPoint
        await pg.get_by_role("button", name="تصدير").first.click()
        await pg.wait_for_timeout(200)
        await pg.get_by_role("radio", name="PowerPoint للتعديل").click()
        await pg.wait_for_timeout(200)
        async with pg.expect_download(timeout=60000) as dl2:
            await pg.locator(".sheet").get_by_role("button", name="تصدير الشجرة").click()
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
        await to_root(pg)
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
