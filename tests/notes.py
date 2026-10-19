"""Checks for the second round of notes (unknown names, kunya, forms, card rows, reorder, Back, search,
بن/بنت, dark mode, big text). Screenshots in tests/shots/n*. Prints ok/FAIL per check."""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:8765/index.html"
SH = "/home/claude/shajara/tests/shots"
problems, errs = [], []


def check(cond, what):
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        problems.append(what)


async def js(pg, expr):
    return await pg.evaluate(expr)


async def wait_js(pg, expr, timeout=15):
    for _ in range(int(timeout / 0.2)):
        if await pg.evaluate(expr):
            return True
        await asyncio.sleep(0.2)
    return False


async def shot(pg, name, full=True):
    await pg.wait_for_timeout(250)
    await pg.screenshot(path=f"{SH}/{name}.png", full_page=full)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_selector("body.ready")
        hash_ = lambda: js(pg, "location.hash")

        # ---- new family: fathers' names grow by themselves (note 11)
        await pg.click("a[href='#/new']")
        await pg.fill("input[name=name]", "حسين")
        anc = pg.locator("input[name=ancestor]")
        check(await anc.count() == 1 and await anc.nth(0).get_attribute("placeholder") == "اسم الأب", "one empty father box at first, «اسم الأب»")
        await anc.nth(0).fill("محمد")
        await anc.nth(1).fill("علي")
        ph = [await anc.nth(i).get_attribute("placeholder") for i in range(await anc.count())]
        check(ph == ["اسم الأب", "اسم الجد", "اسم أبي الجد"], f"boxes appear as you type: {ph}")
        check(await pg.locator(".addname").count() == 0, "no «+» button for names")
        await pg.fill("input[name=fam]", "المشرف")
        await shot(pg, "n01-new-family")
        await pg.click("button:has-text('إنشاء العائلة')")
        await pg.wait_for_selector("main .btn.ghost")
        root_hash = await hash_()
        check("حسين محمد علي المشرف" in await pg.locator(".pfull").text_content(), "full name of the common ancestor")

        # ---- root edit shows fathers' names and family name (note 7)
        await pg.click("a[aria-label='تعديل']")
        await pg.wait_for_selector(".pform")
        labels = await pg.locator(".pform .field .lbl").all_text_contents()
        check(any("أسماء الآباء" in l for l in labels) and any("اسم العائلة" in l for l in labels), "common ancestor: fathers' names and family name can be edited")
        await shot(pg, "n02-root-edit")
        await pg.locator("header button[aria-label='رجوع']").click()
        await pg.wait_for_selector("main .btn.ghost")

        # ---- children with the new-row button (note 5), in the family sheet
        await pg.click("main .btn.ghost")
        await pg.wait_for_selector(".sheet.family .brow input")
        await pg.locator(".brow").nth(0).locator("input").fill("محمد")
        await pg.locator(".brow").nth(0).locator(".seg button", has_text="ذكر").click()
        await pg.locator(".brow").nth(1).locator(".rm").click()  # remove the automatic empty row
        n_before = await pg.locator(".brow").count()
        await pg.click("button.addrow")
        check(await pg.locator(".brow").count() == n_before + 1, "«سطر جديد» adds a row")
        await pg.locator(".brow").nth(1).locator("input").fill("فاطمة")
        await pg.locator(".brow").nth(1).locator(".seg button", has_text="أنثى").click()
        await pg.locator(".brow").nth(2).locator("input").fill("كاظم")
        await pg.locator(".brow").nth(2).locator(".seg button", has_text="ذكر").click()
        await shot(pg, "n03-add-kids")
        await pg.click(".sheet.family .fs > button.btn.primary")
        await pg.wait_for_selector(".kid-list")
        check(await hash_() == root_hash, "after adding children: still on the card")

        # ---- kunya from the eldest son (note 3)
        nick = await pg.locator(".pnick").text_content() if await pg.locator(".pnick").count() else ""
        check(nick == "أبو محمد", f"kunya derived: {nick!r}")

        # ---- wife with unknown name (notes 1, 2, 18), in the family sheet
        await pg.click("main .btn.ghost")
        await pg.wait_for_selector(".sheet.family")
        await pg.locator(".sheet.family button.check", has_text="اسمها غير معروف").click()
        check(await pg.locator(".sheet.family input[name=spouse]").is_disabled(), "name box off when the name is unknown")
        await pg.fill(".sheet.family input[name=spouseFam]", "الحربي")
        await shot(pg, "n04-unknown-wife")
        # the children recorded without a mother are preselected for the first wife
        pre = await pg.locator(".sheet.family .fs-assign button.check[aria-checked=true]").all_text_contents()
        check(sorted(t.strip() for t in pre if t.strip() in ("محمد", "فاطمة", "كاظم")) == ["فاطمة", "كاظم", "محمد"], f"children preselected: {pre}")
        await pg.click(".sheet.family .fs > button.btn.primary")
        await pg.wait_for_selector(".spouse-h")
        head = await pg.locator(".spouse-h .n").first.text_content()
        check("أم محمد" in head, f"wife shown by her kunya: {head!r}")
        await shot(pg, "n05-card-unknown-wife")
        # her own form: no gender choice, and the optional part
        await pg.locator("a.spouse-h").first.click()
        await pg.wait_for_selector(".hero")
        await pg.click("a[aria-label='تعديل']")
        await pg.wait_for_selector(".pform")
        check(await pg.locator(".pform .seg.g").count() == 0, "no gender choice for a spouse")
        check(await pg.locator(".opt-sec").count() == 1, "optional part shown (folded)")
        await pg.locator("header button[aria-label='رجوع']").click()
        await pg.wait_for_selector("header .title-link")
        await pg.click("header .title-link")  # the family's name: back to the common ancestor
        await pg.wait_for_selector(".kid-list")
        check(await hash_() == root_hash, "the family's name opens the common ancestor")

        # ---- card: a «+» on every child with no family yet, the path (note 6)
        check(await pg.locator(".kid .kid-pill.add").count() == 3, "a + next to every child")
        await pg.locator(".kid .kid-pill.add").nth(0).click()
        await pg.wait_for_selector(".sheet.family")
        check("أسرة محمد" in (await pg.locator(".sheet.family h3").text_content()), "+ opens «أسرة محمد»")
        await shot(pg, "n06-plus-sheet", full=False)
        await pg.mouse.click(200, 60)  # tap outside closes (nothing typed, nothing saved)
        await pg.wait_for_timeout(400)
        check(await pg.locator(".sheet").count() == 0, "tap outside closes the sheet")
        await pg.locator(".kid-line a.chip", has_text="محمد").click()
        await pg.wait_for_selector(".crumbs")
        crumbs = await pg.locator(".crumbs").text_content()
        check("حسين" in crumbs and "محمد" in crumbs, f"path above the card: {crumbs!r}")
        await shot(pg, "n07-child-card")

        # ---- Back: first press = previous screen, then up the family (note 10)
        mohammed = await hash_()
        await pg.locator(".strip a.chip", has_text="كاظم").click()   # sibling
        await pg.wait_for_selector(".crumbs b.cur:has-text('كاظم')")
        kazem = await hash_()
        await pg.locator(".strip a.chip", has_text="فاطمة").click()
        await pg.wait_for_selector(".crumbs b.cur:has-text('فاطمة')")
        await pg.go_back()
        await pg.wait_for_timeout(500)
        check(await hash_() == kazem, "Back once: the previous screen (كاظم)")
        await pg.go_back()
        await pg.wait_for_timeout(500)
        check(await hash_() == root_hash, f"Back again: up to the father, not to محمد ({await hash_()})")
        await pg.go_back()
        await pg.wait_for_timeout(500)
        check((await hash_()) in ("", "#/"), "Back on the common ancestor: the family list")
        check(await js(pg, "history.length") <= 3, f"history kept short ({await js(pg, 'history.length')})")
        await pg.goto(BASE + root_hash)
        await pg.wait_for_selector(".kid-list")

        # ---- reorder: the card behind follows each move; drag works (note 8)
        await pg.locator(".unit-tools button[aria-label='خيارات']").first.click()
        await pg.click(".menu button:has-text('ترتيب الأبناء')")
        await pg.wait_for_selector(".order-row")
        await pg.locator(".order-row").nth(0).locator("button[aria-label='تأخير']").click()
        await pg.wait_for_timeout(300)
        behind = await pg.locator(".kid-list .kid-line a.chip").all_text_contents()
        check(behind[:2] == ["فاطمة", "محمد"], f"the card behind updates at once: {behind}")
        # drag the last row to the top: press and hold, then move
        row = pg.locator(".order-row").nth(2)
        bb = await row.bounding_box()
        x, y = bb["x"] + bb["width"] * 0.55, bb["y"] + bb["height"] / 2
        await pg.mouse.move(x, y)
        await pg.mouse.down()
        await pg.wait_for_timeout(400)
        for i in range(1, 11):
            await pg.mouse.move(x, y - bb["height"] * 2.2 * i / 10)
            await pg.wait_for_timeout(20)
        await pg.mouse.up()
        await pg.wait_for_timeout(300)
        order = await pg.locator(".order-row .n").all_text_contents()
        check(order[0].endswith("كاظم"), f"drag to the top: {order}")
        await shot(pg, "n08-reorder", full=False)
        await pg.mouse.click(200, 100)  # tap outside closes
        await pg.wait_for_timeout(300)
        check(await pg.locator(".sheet").count() == 0, "tap outside closes the sheet")

        # ---- dialog and help: tap outside closes
        await pg.click("a[aria-label='تعديل']")
        await pg.wait_for_selector(".pform")
        await pg.locator(".help").first.click()
        await pg.wait_for_selector(".pop")
        await pg.mouse.click(30, 700)
        await pg.wait_for_timeout(300)
        check(await pg.locator(".pop").count() == 0, "tap outside closes the explanation")

        # ---- gender correction moves the spouse too, with a warning (note 18)
        await pg.locator(".pform .seg.g button", has_text="أنثى").click()
        await pg.wait_for_selector(".dialog")
        txt = await pg.locator(".dialog").text_content()
        check("يغيّر معه" in txt, "warning before changing a married person's gender")
        await shot(pg, "n09-gender-warning", full=False)
        await pg.mouse.click(200, 80)  # tap outside: cancel
        await pg.wait_for_timeout(300)
        check(await pg.locator(".dialog").count() == 0, "tap outside closes the dialog")
        g = await js(pg, "(async () => { const s = await import('./js/store.js'); const f = s.state.family; return f.persons[f.rootId].gender; })()")
        check(g == "m", "cancelled: nothing changed")
        await pg.locator("header button[aria-label='رجوع']").click()
        await pg.wait_for_selector(".kid-list")

        # ---- search by kunya (note 17)
        await pg.click("button[aria-label='بحث']")
        await pg.fill(".sbar input", "أبو كاظم")  # كاظم is the eldest son after the reorder above
        await pg.wait_for_timeout(400)
        res = await pg.locator(".res").all_text_contents()
        check(any("حسين" in r for r in res), f"search by kunya: {res[:2]}")
        await shot(pg, "n10-search-kunya", full=False)

        # ---- بن/بنت (note 16), dark mode (note 12)
        await pg.goto(BASE + "#/settings")
        await pg.wait_for_selector(".toggle-row")
        await pg.locator(".toggle-row", has_text="بن").locator("button.sw").click()
        await pg.locator("button[role=radio]", has_text="داكن").click()
        await shot(pg, "n11-settings-dark")
        check(await js(pg, "document.documentElement.dataset.theme") == "dark", "dark mode applied")
        await pg.goto(BASE + root_hash)
        await pg.wait_for_selector(".pfull")
        full = await pg.locator(".pfull").text_content()
        check(full.strip() == "حسين بن محمد بن علي المشرف", f"بن in the ancestor's name: {full!r}")
        await shot(pg, "n12-card-dark")
        await pg.click("button[aria-label='شجرة العائلة']")
        await pg.wait_for_selector(".stage svg")
        await shot(pg, "n13-tree-dark", full=False)
        await pg.goto(BASE + root_hash + "/edit")
        await pg.wait_for_selector(".pform")
        await shot(pg, "n14-form-dark")

        # ---- big text: no cut dots under a final yaa (note 4)
        await pg.goto(BASE + "#/settings")
        await pg.locator("button[role=radio]", has_text="فاتح").click()
        await pg.goto(BASE + "#/new")
        await pg.wait_for_selector(".pform")
        await pg.add_style_tag(content="html { -webkit-text-size-adjust: none; } .inp, .sbar input { font-size: 25px !important; }")
        await pg.fill("input[name=name]", "أي شي")
        await pg.locator("input[name=ancestor]").nth(0).fill("علي")
        await pg.wait_for_timeout(200)
        await pg.locator(".pform").screenshot(path=f"{SH}/n15-big-text.png")
        check(True, "big-text screenshot taken (look at n15)")
        await b.close()
    check(not errs, "no page errors " + " | ".join(errs[:5]))
    print("\n" + ("all good" if not problems else f"{len(problems)} problem(s)"))


asyncio.run(main())
