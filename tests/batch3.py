"""Checks for the third round of notes: the family sheet, fold-out children, the «التالي» bar,
progress on the family list, the header, the folding optional part and the light default.
Screenshots in tests/shots/b3-*. Prints ok/FAIL per check."""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8765/index.html"
SH = "/home/claude/shajara/tests/shots"
WIDTH = int(sys.argv[1]) if len(sys.argv) > 1 else 390
problems, errs = [], []


def check(cond, what):
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        problems.append(what)


async def js(pg, expr):
    return await pg.evaluate(expr)


async def wait_js(pg, expr, timeout=10):
    for _ in range(int(timeout / 0.2)):
        if await pg.evaluate(expr):
            return True
        await asyncio.sleep(0.2)
    return False


async def shot(pg, name, full=False):
    await pg.wait_for_timeout(350)
    await pg.screenshot(path=f"{SH}/b3-{WIDTH}-{name}.png", full_page=full)


async def kid_rows(pg, sel=".sheet.family .brow"):
    return await pg.locator(sel).evaluate_all("rs => rs.map(r => [r.querySelector('input').value, (r.querySelector('.seg button.on') || {}).textContent || ''])")


async def fill_kids(pg, kids):
    """kids: [(name, 'ذكر'|'أنثى')] typed into the family sheet's rows."""
    for i, (name, g) in enumerate(kids):
        row = pg.locator(".sheet.family .brow").nth(i)
        await row.locator("input").fill(name)
        await row.locator(".seg button", has_text=g).click()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # the phone asks for dark: the app must still open light
        ctx = await b.new_context(viewport={"width": WIDTH, "height": 800}, device_scale_factor=2, has_touch=True, is_mobile=True, color_scheme="dark")
        pg = await ctx.new_page()
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_selector("body.ready")
        check(await js(pg, "document.documentElement.dataset.theme") == "light", "opens light even when the phone is dark")

        # ---- new family keeps its button; the optional part is folded
        await pg.click("a[href='#/new']")
        await pg.fill("input[name=name]", "حسين")
        await pg.locator("input[name=ancestor]").nth(0).fill("محمد")
        await pg.fill("input[name=fam]", "المشرف")
        check(await pg.locator(".opt-sec[aria-expanded=false]").count() == 1, "optional part folded at first")
        check(await js(pg, "document.querySelector('.opt-body').inert === true"), "folded part is out of the way (inert)")
        await shot(pg, "01-new-family", full=True)
        await pg.click(".opt-sec")
        await pg.wait_for_timeout(400)
        check(await pg.locator(".opt-sec[aria-expanded=true]").count() == 1, "optional part opens")
        await pg.fill("input[name=nick]", "أبو محمد")
        check("الكنية" in (await pg.locator(".opt-what").text_content()), "its title lists what is filled")
        await shot(pg, "02-new-family-open", full=True)
        await pg.click("button:has-text('إنشاء العائلة')")
        await pg.wait_for_selector("main .btn.ghost")
        root_hash = await js(pg, "location.hash")

        # ---- header: house = families list; the root card's title is plain
        check(await pg.locator("header .title-link").count() == 0, "on the common ancestor's card the title is plain")
        check(await pg.locator("header button[aria-label^='الصفحة الرئيسية']").count() == 1, "house button goes to the family list")
        check(await pg.locator(".next-bar").count() == 1 and "أسرة حسين" in (await pg.locator(".next-bar").text_content()), "«التالي» suggests the ancestor's family first")
        await shot(pg, "03-root-card")

        # ---- family sheet from the card: wife + children in one go, saved with «تم»
        await pg.click("main .btn.ghost:has-text('زوجة وأبناء')")
        await pg.wait_for_selector(".sheet.family")
        check("أسرة حسين" in (await pg.locator(".sheet.family h3").text_content()), "sheet title «أسرة حسين»")
        await pg.fill(".sheet.family input[name=spouse]", "زينب")
        await fill_kids(pg, [("محمد", "ذكر"), ("فاطمة", "أنثى"), ("كاظم", "ذكر")])
        await shot(pg, "04-family-sheet")
        # drag: press and hold the third row, move it to the top
        r3 = await pg.locator(".sheet.family .brow").nth(2).locator(".num").bounding_box()
        r1 = await pg.locator(".sheet.family .brow").nth(0).locator(".num").bounding_box()
        await pg.mouse.move(r3["x"] + r3["width"] / 2, r3["y"] + r3["height"] / 2)
        await pg.mouse.down()
        await pg.wait_for_timeout(450)
        steps = 8
        for i in range(1, steps + 1):
            y = r3["y"] + (r1["y"] - r3["y"]) * i / steps + r3["height"] / 2
            await pg.mouse.move(r3["x"] + r3["width"] / 2, y)
            await pg.wait_for_timeout(30)
        await pg.mouse.up()
        await pg.wait_for_timeout(200)
        order = [r[0] for r in await kid_rows(pg)][:3]
        check(order == ["كاظم", "محمد", "فاطمة"], f"press-hold-drag reorders the rows: {order}")
        nums = await pg.locator(".sheet.family .brow .num").all_text_contents()
        check(nums[:3] == ["١", "٢", "٣"], f"numbers follow the new order: {nums[:3]}")
        # put it back with another drag (eldest first again)
        r1 = await pg.locator(".sheet.family .brow").nth(0).locator(".num").bounding_box()
        r3 = await pg.locator(".sheet.family .brow").nth(2).locator(".num").bounding_box()
        await pg.mouse.move(r1["x"] + 5, r1["y"] + r1["height"] / 2)
        await pg.mouse.down()
        await pg.wait_for_timeout(450)
        for i in range(1, steps + 1):
            await pg.mouse.move(r1["x"] + 5, r1["y"] + (r3["y"] - r1["y"]) * i / steps + r1["height"] / 2)
            await pg.wait_for_timeout(30)
        await pg.mouse.up()
        await pg.wait_for_timeout(200)
        order = [r[0] for r in await kid_rows(pg)][:3]
        check(order == ["محمد", "فاطمة", "كاظم"], f"dragged back down: {order}")
        await pg.click(".sheet.family .fs > button.btn.primary")
        await pg.wait_for_selector(".sheet.family", state="detached")
        await pg.wait_for_selector(".kid-list .kid")
        names = await pg.locator(".kid-list .kid > .kid-line .chip").all_text_contents()
        check(names == ["محمد", "فاطمة", "كاظم"], f"children on the card in order: {names}")
        check(await pg.locator(".spouse-h .n", has_text="زينب").count() == 1, "the wife is saved with them")
        await shot(pg, "05-card-with-kids", full=True)

        # ---- child rows: «+» for a child with no marriage opens the family sheet at once
        row = pg.locator(".kid").nth(0)
        check(await row.locator(".kid-pill.add").count() == 1, "no marriage yet: the pill is «+»")
        lb = await row.locator(".kid-line").bounding_box()
        await pg.mouse.click(lb["x"] + lb["width"] * 0.45, lb["y"] + lb["height"] / 2)  # anywhere on the row except the name
        await pg.wait_for_selector(".sheet.family")
        check("أسرة محمد" in (await pg.locator(".sheet.family h3").text_content()), "tapping the row opens «أسرة محمد»")
        await pg.fill(".sheet.family input[name=spouse]", "سارة")
        await fill_kids(pg, [("علي", "ذكر")])
        await pg.mouse.click(WIDTH / 2, 30)  # the dimmed area above the sheet
        await pg.wait_for_selector(".sheet.family", state="detached")
        await pg.wait_for_timeout(400)
        row = pg.locator(".kid").nth(0)
        check(await row.evaluate("r => r.classList.contains('open')"), "after saving, that child's family is shown unfolded")
        check(await row.locator(".kf .chip", has_text="سارة").count() == 1 and await row.locator(".kf .chip", has_text="علي").count() == 1, "tap outside saved the wife and the child")
        check("زوجته سارة" in (await row.locator(".kid-sub").text_content()), "the row shows «زوجته سارة»")
        pill = (await row.locator(".kid-pill span").text_content()) if await row.locator(".kid-pill span").count() else ""
        check(pill == "١", f"the pill counts the children: {pill!r}")
        check(await row.locator(".mini-add", has_text="زواج آخر").count() == 1 and await row.locator(".mini-add", has_text="أبناء").count() >= 1, "unfolded: «+ أبناء» and «+ زواج آخر»")
        await shot(pg, "06-kid-family", full=True)
        lb = await row.locator(".kid-line").bounding_box()
        await pg.mouse.click(lb["x"] + lb["width"] * 0.45, lb["y"] + lb["height"] / 2)
        await pg.wait_for_timeout(350)
        check(not await row.evaluate("r => r.classList.contains('open')"), "tapping the row again folds it")
        check(await js(pg, "document.querySelector('.kid .kid-body').inert === true"), "folded part is out of the way (inert)")
        await row.locator(".kid-pill").click()
        await pg.wait_for_timeout(350)
        check(await row.evaluate("r => r.classList.contains('open')"), "the pill unfolds it too")
        await shot(pg, "07-kid-open")

        # ---- Back with a child without ذكر/أنثى: the sheet comes back as it was
        await pg.locator(".kid").nth(2).locator(".kid-pill").click()
        await pg.wait_for_selector(".sheet.family")
        await pg.fill(".sheet.family input[name=spouse]", "مريم")
        await pg.locator(".sheet.family .brow").nth(0).locator("input").fill("ززز")
        await pg.go_back()
        await pg.wait_for_timeout(500)
        check(await pg.locator(".sheet.family").count() == 1, "Back with a missing ذكر/أنثى keeps the sheet")
        check(await pg.locator(".sheet.family input[name=spouse]").input_value() == "مريم", "…with what was typed")
        check("ززز" in (await pg.locator(".sheet.family .err-t").text_content()), "…and says which name needs it")
        await shot(pg, "08-missing-gender")
        await pg.locator(".sheet.family .brow").nth(0).locator(".seg button", has_text="ذكر").click()
        await pg.go_back()
        await pg.wait_for_selector(".sheet.family", state="detached")
        await pg.wait_for_timeout(400)
        check(await pg.locator(".kid").nth(2).locator(".kf .chip", has_text="ززز").count() == 1, "then Back saves it")
        check(await js(pg, "document.querySelectorAll('.kid.open').length") == 1, "one child unfolded at a time")

        # ---- «التالي»
        nb = pg.locator(".next-bar")
        t1 = await nb.locator(".nb-n").text_content()
        check("فاطمة" in t1, f"next is the next child without a family: {t1!r}")
        await nb.locator("button", has_text="ما لها أبناء").click()
        await pg.wait_for_timeout(300)
        t2 = await pg.locator(".next-bar .nb-n").text_content()
        check("فاطمة" not in t2, f"«ما لها أبناء» moves on: {t2!r}")
        check("ليس لها أبناء" in (await pg.locator(".kid").nth(1).locator(".kid-sub").text_content()), "the row says «ليس لها أبناء»")
        await pg.locator(".next-bar button", has_text="لاحقًا").click()
        await pg.wait_for_timeout(200)
        t3 = await pg.locator(".next-bar .nb-n").text_content() if await pg.locator(".next-bar:not([hidden])").count() else ""
        check(t3 != t2, f"«لاحقًا» moves on: {t3!r}")
        await shot(pg, "09-next-bar")
        if t3:
            await pg.locator(".next-bar button", has_text="أضف").click()
            await pg.wait_for_selector(".sheet.family")
            check(await pg.locator(".sheet.family").count() == 1, "«أضف» opens the family sheet right there")
            await pg.click(".sheet.family .fs > button.btn.primary")
            await pg.wait_for_selector(".sheet.family", state="detached")

        # ---- header on a child's card: title opens the common ancestor
        await pg.locator(".kid").nth(0).locator(".kid-line .chip").click()
        await pg.wait_for_selector("header .title-link")
        check("محمد" in (await pg.locator(".hero .pname").text_content()), "the name chip opens the child's card")
        await shot(pg, "10-child-card")
        await pg.click("header .title-link")
        await pg.wait_for_timeout(400)
        check(await js(pg, "location.hash") == root_hash, "family title → the common ancestor's card")
        await pg.click("header button[aria-label^='الصفحة الرئيسية']")
        await pg.wait_for_selector(".fam")
        line = " ".join(await pg.locator(".fam .t span").all_text_contents())
        check("أشخاص" in line or "شخصًا" in line, f"family list shows people: {line!r}")
        check("أجيال" in line or "جيلان" in line, "…generations")
        check("بقيت" in line or "اكتملت" in line, "…and families left")
        await shot(pg, "11-families")

        # ---- tree: tapping a person offers the family sheet
        await pg.click(".fam")
        await pg.wait_for_selector(".hero")
        await pg.click("header button[aria-label='شجرة العائلة']")
        await pg.wait_for_selector(".viewport svg")
        await pg.wait_for_timeout(500)
        box = await pg.locator(".viewport [data-pid]").nth(0).bounding_box()
        await pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await pg.wait_for_selector(".acts", timeout=4000)
        labels = await pg.locator(".acts button").all_text_contents()
        check(any("زواج آخر" in l or "وأبناء" in l for l in labels), f"tree actions: {labels}")
        await shot(pg, "12-tree-actions")

        print("\nconsole/page errors:", errs if errs else "none")
        print("FAILED:" if problems else "ALL OK", problems if problems else "")
        await b.close()


asyncio.run(main())
