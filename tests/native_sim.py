"""Android-app code paths in a desktop browser, with a stand-in for the Capacitor plugins.
Checks: save to the phone (and the retry under a numbered name), backups counted as done,
share closed without choosing an app, the file-picker filter, and the hardware Back button."""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:8765/index.html"
FAKE = """
window.__calls = []; window.__fsFail = 0; window.__shareReject = false; window.__exited = false;
window.Capacitor = {
  isNativePlatform: () => true, getPlatform: () => "android",
  Plugins: {
    Filesystem: {
      checkPermissions: async () => ({ publicStorage: "granted" }),
      requestPermissions: async () => ({ publicStorage: "granted" }),
      writeFile: async (o) => {
        window.__calls.push(["writeFile", o.path, o.directory]);
        if (window.__fsFail > 0) { window.__fsFail--; throw new Error("exists"); }
        return { uri: "file:///storage/" + o.path };
      },
    },
    Share: { share: async (o) => { window.__calls.push(["share", o.title]); if (window.__shareReject) throw new Error("Share canceled"); return {}; } },
    App: { addListener: (ev, fn) => { window.__back = fn; return { remove() {} }; }, exitApp: () => { window.__exited = true; } },
  },
};
"""
problems = []


async def wait_js(pg, expr, timeout=20):
    """Polls a JS function; Playwright's own waiting needs eval, which the app's CSP forbids."""
    for _ in range(int(timeout / 0.2)):
        v = await pg.evaluate(expr)
        if v:
            return v
        await asyncio.sleep(0.2)
    raise TimeoutError("waiting for " + expr)


def check(cond, what):
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        problems.append(what)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        await ctx.add_init_script(FAKE)
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(BASE)
        await pg.wait_for_selector("body.ready")

        # a family to work with
        await pg.click("a[href='#/new']")
        await pg.fill("input[name=name]", "سليمان")
        await pg.fill("input[name=fam]", "المنصور")
        await pg.click("button:has-text('إنشاء العائلة')")
        await wait_js(pg, "() => /#\\/f\\/[^/]+\\/p\\//.test(location.hash)")
        await pg.evaluate("history.back()")
        await pg.wait_for_selector("a.card.fam")

        async def backup_and_save():
            await pg.click("button[aria-label='خيارات العائلة']")
            await pg.click(".menu button:has-text('تصدير البيانات')")
            await pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.remove())")
            await pg.click(".sheet button:has-text('حفظ في الجهاز')")
            await pg.wait_for_selector(".toast")
            return await pg.locator(".toast").text_content()

        # 1) save → Documents/شجرة العائلة, and the backup is recorded
        t = await backup_and_save()
        calls = await pg.evaluate("window.__calls")
        check("حُفظ" in t and "Documents" in t, f"toast after saving: {t}")
        check(any(c[0] == "writeFile" and c[2] == "DOCUMENTS" and c[1].startswith("شجرة العائلة/") and c[1].endswith(".zip") for c in calls), f"written to Documents/شجرة العائلة: {calls[-1]}")
        await pg.wait_for_timeout(300)
        recorded = await pg.evaluate("(async () => (await (await import('./js/store.js')).familySummaries())[0].lastExport > 0)()")
        check(recorded, "the backup counts as done (no more reminder)")

        # 2) the first name is taken → saved as "(2)"
        await pg.evaluate("window.__calls = []; window.__fsFail = 1")
        t = await backup_and_save()
        calls = await pg.evaluate("window.__calls")
        check("حُفظ" in t and len(calls) == 2 and calls[1][1].endswith(" (2).zip"), f"retry under a numbered name: {[c[1] for c in calls]}")

        # 3) saving impossible → clear message
        await pg.evaluate("window.__calls = []; window.__fsFail = 99")
        t = await backup_and_save()
        check("تعذر" in t, f"message when saving fails: {t}")
        await pg.evaluate("window.__fsFail = 0")

        # 4) share: closed without choosing an app → false; chosen → true
        async def share_result(reject):
            await pg.evaluate(f"window.__shareReject = {str(reject).lower()}")
            await pg.evaluate("() => { window.__r = undefined; import('./js/platform.js').then(m => m.deliverFile(new Blob(['x']), 'a.txt', {})).then(v => { window.__r = v; }); }")
            await pg.click(".sheet button:has-text('مشاركة')")
            await wait_js(pg, "() => window.__r !== undefined")
            return await pg.evaluate("window.__r")
        check(await share_result(True) is False, "share sheet closed → not counted")
        check(await share_result(False) is True, "shared → counted")

        # 5) the sheet closed by Back → false
        await pg.evaluate("() => { window.__r = undefined; import('./js/platform.js').then(m => m.deliverFile(new Blob(['x']), 'a.txt', {})).then(v => { window.__r = v; }); }")
        await pg.wait_for_selector(".sheet")
        await pg.evaluate("window.__back()")
        await wait_js(pg, "() => window.__r !== undefined")
        check(await pg.evaluate("window.__r") is False and await pg.locator(".sheet").count() == 0, "Back closes the choice sheet, nothing saved")

        # 6) the file picker asks for all files in the app
        await pg.evaluate("import('./js/platform.js').then(m => { m.pickFile(''); })")
        await pg.wait_for_timeout(200)
        acc = await pg.evaluate("document.querySelector('input[type=file]') && document.querySelector('input[type=file]').accept")
        check(acc == "*/*", f"import picker filter: {acc!r}")
        await pg.evaluate("document.querySelectorAll('input[type=file]').forEach(i => i.remove())")

        # 7) Back on the family list closes the app
        await pg.evaluate("window.__back()")
        await pg.wait_for_timeout(200)
        check(await pg.evaluate("window.__exited") is True, "Back on the family list closes the app")

        check(not errs, "no page errors " + " ".join(errs))
        await b.close()
    print("\n" + ("all good" if not problems else f"{len(problems)} problem(s)"))


asyncio.run(main())
