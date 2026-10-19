// Walks through the Android app on an emulator the way a person would, keeping a screenshot of every step.
// It drives the test build: the same app with WebView debugging switched on (the release APK keeps it off).
// Results: tests/android/out/summary.txt, console.txt, numbered screenshots, and the files the app saved.
import { _android as android } from "playwright-core";
import { execSync } from "node:child_process";
import fs from "node:fs";

const OUT = "tests/android/out";
const PKG = "com.shajara.familytree";
const DOCS = "/sdcard/Documents/شجرة العائلة";
fs.mkdirSync(OUT, { recursive: true });

const lines = [], consoleLines = [];
let failures = 0, notes = 0, shotN = 0;
const save = () => {
  fs.writeFileSync(`${OUT}/summary.txt`, lines.join("\n") + "\n");
  fs.writeFileSync(`${OUT}/console.txt`, consoleLines.join("\n") + "\n");
};
const log = (s) => { console.log(s); lines.push(s); save(); };
const sh = (cmd, timeout = 60000) => {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout }).trim(); }
  catch (e) { return "ERR " + String(e.stderr || e.message).trim(); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => { shotN++; sh(`adb exec-out screencap -p > "${OUT}/${String(shotN).padStart(2, "0")}-${name}.png"`); };
const back = async (ms = 1000) => { sh("adb shell input keyevent 4"); await sleep(ms); };
const activities = () => sh("adb shell dumpsys activity activities").split("\n");
const top = () => {
  const ls = activities();
  return (ls.find((l) => /topResumedActivity/.test(l)) || ls.find((l) => /mResumedActivity|ResumedActivity:/.test(l)) || "").trim();
};
const intents = () => activities().filter((l) => /GET_CONTENT|OPEN_DOCUMENT|PICK_IMAGES|CHOOSER|action\.SEND/.test(l)).slice(0, 3).map((l) => l.trim()).join(" | ");
const docs = () => sh(`adb shell "ls -l '${DOCS}/'"`);
const appInFront = () => new RegExp(PKG.replace(/\./g, "\\.")).test(top());
async function returnToApp() {
  for (let i = 0; i < 4 && !appInFront(); i++) await back(1500);
}

// ---- native screens (system pickers, share sheet) through uiautomator
function uiNodes() {
  sh("adb shell uiautomator dump /sdcard/ui.xml", 40000);
  const xml = sh("adb shell cat /sdcard/ui.xml");
  const unesc = (v) => v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, " ").replace(/&amp;/g, "&");
  const nodes = [];
  for (const m of xml.matchAll(/<node\b[^>]*>/g)) {
    const a = {};
    for (const k of ["text", "content-desc", "resource-id", "package", "bounds"]) {
      const mm = m[0].match(new RegExp(` ${k}="([^"]*)"`));
      a[k] = mm ? unesc(mm[1]) : "";
    }
    nodes.push(a);
  }
  return nodes;
}
function tap(node) {
  const [x1, y1, x2, y2] = node.bounds.match(/\d+/g).map(Number);
  sh(`adb shell input tap ${Math.round((x1 + x2) / 2)} ${Math.round((y1 + y2) / 2)}`);
}
async function findNode(pred, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const n = uiNodes().find(pred);
    if (n) return n;
    await sleep(1500);
  }
  return null;
}

// ---- the app's page (WebView)
const [device] = await android.devices({ omitDriverInstall: true });
let page = null;
function hook(p) {
  p.setDefaultTimeout(20000);
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleLines.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => consoleLines.push(`PAGEERROR: ${e.message}`));
}
async function attach() {
  let pid = "";
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    pid = sh(`adb shell pidof ${PKG}`);
    const wv = device.webViews().find((w) => String(w.pid()) === pid);
    if (wv) {
      const p = await wv.page();
      if (p) { hook(p); await p.waitForSelector("body.ready", { timeout: 30000 }); return p; }
      wv._pagePromise = undefined; // the page target was not there yet; ask again
    }
    await sleep(500);
  }
  throw new Error(`no WebView for ${PKG} (pid ${pid}); seen: ${device.webViews().map((w) => `${w.pkg()}:${w.pid()}`).join(", ")}`);
}
async function launch() {
  sh(`adb shell am start -W -n ${PKG}/.MainActivity`);
  await sleep(1500);
  page = await attach();
}
const hash = () => page.evaluate(() => location.hash);
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await sleep(900); };
// page.waitForFunction needs eval inside the page, which the app's Content-Security-Policy forbids: poll instead.
async function waitFor(fn, arg, timeout = 20000, what = "condition") {
  const deadline = Date.now() + timeout;
  for (;;) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(250);
  }
}
const waitHash = (re, timeout = 20000) => waitFor((src) => new RegExp(src).test(location.hash), re.source, timeout, `a screen matching ${re}`);
async function waitToast(okRe, badRe = /تعذر/) {
  const v = await waitFor(([ok, bad]) => {
    const t = [...document.querySelectorAll(".toast")].map((x) => x.textContent).join(" ");
    if (new RegExp(bad).test(t)) return "BAD:" + t;
    if (new RegExp(ok).test(t)) return "OK:" + t;
    return false;
  }, [okRe.source, badRe.source], 90000, "the confirmation message");
  if (v.startsWith("BAD:")) throw new Error(v.slice(4));
  return v.slice(3);
}

async function step(name, fn, { soft = false } = {}) {
  const t0 = Date.now();
  try {
    const note = await fn();
    log(`OK    ${name}${note ? " — " + note : ""} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return true;
  } catch (e) {
    if (soft) notes++; else failures++;
    log(`${soft ? "NOTE " : "FAIL "} ${name} — ${String((e && e.message) || e).split("\n").slice(0, 4).join(" | ")}`);
    shot((soft ? "note-" : "FAIL-") + name.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 32));
    await returnToApp(); // leave a system screen that is still open
    return false;
  }
}

// tree screen → export sheet → choose the format → wait for "file ready"
async function exportFromTree(format, adjust) {
  await page.click("header button:has-text('تصدير')");
  await page.waitForSelector(".sheet");
  await page.click(`.sheet button[role=radio]:has-text('${format === "pdf" ? "PDF للطباعة" : "PowerPoint للتعديل"}')`);
  if (adjust) await adjust();
  const t0 = Date.now();
  await page.click(".sheet button.btn.primary:has-text('تصدير')");
  await page.waitForSelector(".sheet button:has-text('حفظ في الجهاز')", { timeout: 240000 });
  return (Date.now() - t0) / 1000;
}
// "save on the phone" → the toast → the new file in Documents/شجرة العائلة
async function saveOnPhone(ext) {
  const before = docs();
  await page.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove()));
  await page.click(".sheet button:has-text('حفظ في الجهاز')");
  const msg = await waitToast(/حُفظ/);
  const files = docs().split("\n").filter((l) => l.includes(ext));
  const line = files.find((l) => !before.includes(l)) || files.pop();
  if (!line) throw new Error(`no ${ext} file in ${DOCS}`);
  return `«${msg.trim()}» ${line.replace(/\s+/g, " ")}`;
}

setTimeout(() => { log("STOP: the walk-through took more than 15 minutes"); process.exit(3); }, 15 * 60 * 1000);
log(`device: ${device.model()}, Android ${sh("adb shell getprop ro.build.version.release")} (API ${sh("adb shell getprop ro.build.version.sdk")})`);

await step("app opens", async () => {
  await launch();
  const info = await page.evaluate(() => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    const safe = `${cs.paddingTop}/${cs.paddingBottom}`;
    d.remove();
    return {
      native: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
      viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, safe,
      chrome: (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [])[1],
      font: document.fonts.check("700 23px TS"), compressionStream: typeof CompressionStream,
    };
  });
  await sleep(500);
  shot("home-empty");
  if (!info.native) throw new Error("the Capacitor bridge is missing " + JSON.stringify(info));
  return JSON.stringify(info);
});

await step("create a family", async () => {
  await page.click("a[href='#/new']");
  await page.fill("input[name=name]", "سليمان");
  await page.fill("input[name=fam]", "المنصور");
  await sleep(400);
  shot("new-family");
  await page.click("button:has-text('إنشاء العائلة')");
  await waitHash(/^#\/f\/[^/]+\/p\/[^/]+$/);
  await sleep(800);
  shot("root-card");
  return await hash();
});

await step("wife and three children in the family sheet", async () => {
  await page.click("main .btn.ghost");
  await page.waitForSelector(".sheet.family .brow input");
  await page.fill(".sheet.family input[name=spouse]", "نورة");
  const kids = [["محمد", "ذكر"], ["فاطمة", "أنثى"], ["عبدالله", "ذكر"]];
  for (let i = 0; i < kids.length; i++) {
    const row = page.locator(".sheet.family .brow").nth(i);
    await row.locator("input").fill(kids[i][0]);
    await row.locator(".seg button", { hasText: kids[i][1] }).click();
  }
  await sleep(400);
  shot("family-sheet");
  await page.click(".sheet.family .fs > button.btn.primary");
  await page.waitForSelector(".kid-list .kid");
  await sleep(800);
  shot("root-with-children");
  return `${await page.locator(".kid-list .kid").count()} children shown`;
});

await step("tree; Back closes a sheet and stays on the screen", async () => {
  await page.click("button[aria-label='شجرة العائلة']");
  await page.waitForSelector(".stage svg", { timeout: 30000 });
  await sleep(1200);
  shot("tree");
  await page.click("header button:has-text('تصدير')");
  await page.waitForSelector(".sheet");
  await sleep(600);
  shot("export-sheet");
  const before = await hash();
  await back();
  const open = await page.locator(".sheet").count();
  const after = await hash();
  if (open) throw new Error("the sheet stayed open after Back");
  if (after !== before) throw new Error(`Back left the screen: ${before} → ${after}`);
  return "sheet closed, tree still open";
});

await step("PDF → save on the phone", async () => {
  const secs = await exportFromTree("pdf");
  await sleep(400);
  shot("file-ready");
  const r = await saveOnPhone(".pdf");
  shot("pdf-saved");
  return `ready in ${secs.toFixed(1)}s; ${r}`;
});

await step("PowerPoint → Android share sheet", async () => {
  await exportFromTree("pptx");
  await page.click(".sheet button:has-text('مشاركة')");
  await sleep(4500);
  const t = top(), i = intents();
  shot("share-sheet");
  if (appInFront()) throw new Error("the share sheet did not open: " + t);
  await back(1500);
  shot("share-closed");
  if (!appInFront()) throw new Error("did not come back to the app: " + top());
  return `${t} || ${i}`;
}, { soft: true });

await step("Back walks back to the family list", async () => {
  await returnToApp();
  const seen = [await hash()];
  for (let i = 0; i < 8; i++) {
    const h = await hash();
    if (!h || h === "#/" || h === "#") break;
    await back(900);
    seen.push(await hash());
  }
  const h = await hash();
  if (h && h !== "#/" && h !== "#") throw new Error("did not reach the list: " + seen.join(" → "));
  await sleep(500);
  shot("home-one-family");
  return seen.join(" → ");
});

await step("backup → save on the phone, and it counts as backed up", async () => {
  await page.click("button[aria-label='خيارات العائلة']");
  await page.click(".menu button:has-text('تصدير البيانات')");
  await page.waitForSelector(".sheet button:has-text('حفظ في الجهاز')", { timeout: 60000 });
  await sleep(300);
  shot("backup-ready");
  const r = await saveOnPhone(".zip");
  await sleep(800);
  const recorded = await page.evaluate(async () => (await (await import("./js/store.js")).familySummaries()).every((x) => x.lastExport > 0));
  if (!recorded) throw new Error("saved, but not recorded as a backup (the reminder would keep asking)");
  return r;
});

await step("import the backup with the system file picker", async () => {
  if (!["", "#/", "#"].includes(await hash())) await go("#/");
  await page.click("button:has-text('استيراد من ملف')");
  await sleep(4000);
  const t = top(), i = intents();
  shot("system-picker");
  if (appInFront()) throw new Error("no file picker opened: " + t);
  let node = await findNode((n) => /\.zip$/.test(n.text), 2);
  if (!node) {
    // search the picker for today's files: their names contain the year
    const search = await findNode((n) => /search/i.test(n["resource-id"] + " " + n["content-desc"]), 2);
    if (search) {
      tap(search);
      await sleep(1500);
      sh(`adb shell input text ${new Date().getFullYear()}`);
      sh("adb shell input keyevent 66");
      await sleep(3000);
    }
    node = await findNode((n) => /\.zip$/.test(n.text), 3);
  }
  shot("picker-backup");
  if (!node) throw new Error(`the picker opened (${i}) but the backup file was not found on its screen`);
  tap(node);
  await page.waitForSelector(".dialog button:has-text('إضافة نسخة')", { timeout: 30000 });
  await sleep(300);
  shot("import-already-there");
  await page.click(".dialog button:has-text('إضافة نسخة')");
  await waitHash(/^#\/f\/[^/]+\/p\//, 30000);
  await sleep(900);
  shot("imported-copy");
  return `${t} || ${i}`;
}, { soft: true });

await step("import a 137-person family", async () => {
  await returnToApp();
  await go("#/");
  const buf = fs.readFileSync("tests/android/sample137.json");
  let how = "through the file chooser";
  try {
    const [fc] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10000 }),
      page.click("button:has-text('استيراد من ملف')"),
    ]);
    await fc.setFiles({ name: "sample137.json", mimeType: "application/json", buffer: buf });
  } catch (e) {
    how = "loaded directly (" + String(e.message).split("\n")[0] + ")";
    await returnToApp();
    await page.evaluate(async (txt) => {
      const s = await import("./js/store.js");
      const d = JSON.parse(txt);
      await s.db.putFamily(d);
      location.hash = "#/f/" + d.id;
    }, buf.toString("utf8"));
  }
  await waitHash(/^#\/f\/sample137\/p\//, 30000);
  await sleep(900);
  shot("big-family-root");
  return how;
});

await step("big tree: view, then PDF with dates → save", async () => {
  await page.click("button[aria-label='شجرة العائلة']");
  await page.waitForSelector(".stage svg", { timeout: 60000 });
  await sleep(1500);
  shot("big-tree");
  await page.click("button[aria-label='الشجرة كاملة']");
  await sleep(1200);
  shot("big-tree-whole");
  // dates are chosen in the design sheet; the export takes the tree as shown
  await page.click("header button:has-text('التصميم')");
  await page.waitForSelector(".sheet.design");
  for (const label of ["الميلاد", "الوفاة"]) {
    const b = page.locator(".sheet .tog", { hasText: label });
    if (!/\bon\b/.test((await b.getAttribute("class")) || "")) await b.click();
  }
  await page.click(".sheet.design button.btn.primary:has-text('تم')");
  await sleep(500);
  const secs = await exportFromTree("pdf");
  const r = await saveOnPhone(".pdf");
  return `ready in ${secs.toFixed(1)}s; ${r}`;
});

await step("add a photo (file chooser)", async () => {
  const root = await page.evaluate(async () => (await import("./js/store.js")).state.family.rootId);
  await go(`#/f/sample137/p/${root}/edit`);
  await page.waitForSelector("button.thumb.add");
  const [fc] = await Promise.all([page.waitForEvent("filechooser", { timeout: 10000 }), page.click("button.thumb.add")]);
  await fc.setFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync("tests/android/photo.jpg") });
  await page.waitForSelector("button.thumb img", { timeout: 30000 });
  await sleep(700);
  shot("photo-added");
  return "thumbnail shown";
}, { soft: true });

await step("pick a photo with the system picker", async () => {
  await returnToApp();
  const root = await page.evaluate(async () => (await import("./js/store.js")).state.family.rootId);
  if (!(await hash()).endsWith("/edit")) await go(`#/f/sample137/p/${root}/edit`);
  sh("adb push tests/android/photo.jpg /sdcard/Pictures/shajara-test.jpg");
  sh("adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/shajara-test.jpg");
  await sleep(2000);
  const before = await page.locator("button.thumb img").count();
  await page.click("button.thumb.add");
  await sleep(4000);
  const t = top(), i = intents();
  shot("system-photo-picker");
  if (appInFront()) throw new Error("no picker opened: " + t);
  const node = await findNode((n) => /shajara-test/.test(n.text) || /^(Photo|Image) (taken|shot)/i.test(n["content-desc"]), 3);
  if (!node) throw new Error(`the picker opened (${t}) but the test photo was not found`);
  tap(node);
  await waitFor((n) => document.querySelectorAll("button.thumb img").length > n, before, 30000, "the new photo");
  await sleep(700);
  shot("photo-from-picker");
  return `${t} || ${i}`;
}, { soft: true });

await step("Back on the family list closes the app", async () => {
  await returnToApp();
  await go("#/");
  await back(2500);
  const t = top();
  shot("after-back-on-list");
  if (appInFront()) throw new Error("the app is still in front: " + t);
  return t;
});

await step("reopen: everything is still there", async () => {
  sh(`adb shell am force-stop ${PKG}`);
  await sleep(1000);
  await launch();
  await sleep(900);
  const names = await page.locator("a.card.fam b").allTextContents();
  shot("reopened");
  if (names.length < 2) throw new Error(`only ${names.length} families after reopening`);
  return names.join("، ");
});

sh(`adb pull "${DOCS}" "${OUT}/files"`);
log(`saved files: ${docs().split("\n").map((l) => l.replace(/\s+/g, " ")).join(" | ")}`);
log(failures ? `${failures} step(s) failed, ${notes} note(s)` : `all required steps passed, ${notes} note(s)`);
save();
process.exit(failures ? 1 : 0);
