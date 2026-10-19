// Differences between the Android app (Capacitor) and the web/iPhone version.
import { h } from "./util.js";
import { sheet, toast, busy, hasOverlay } from "./ui/kit.js";
import * as nav from "./nav.js";

const Cap = () => window.Capacitor;
export const isNative = () => !!(Cap() && Cap().isNativePlatform && Cap().isNativePlatform());
const plugin = (name) => (Cap() && Cap().Plugins ? Cap().Plugins[name] : null);

export function initPlatform() {
  const App = plugin("App");
  if (isNative() && App) {
    App.addListener("backButton", () => {
      if (hasOverlay()) { history.back(); return; } // closes the topmost sheet, menu or dialog
      if (!nav.back()) App.exitApp();                // on the family list: leave the app
    });
  }
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

async function nativeWrite(blob, filename, directory) {
  const FS = plugin("Filesystem");
  const data = await blobToBase64(blob);
  if (directory === "DOCUMENTS" && FS.checkPermissions) {
    try {
      const p = await FS.checkPermissions();
      if (p && p.publicStorage && p.publicStorage !== "granted") await FS.requestPermissions();
    } catch (e) { /* newer Android needs no permission */ }
  }
  // A file left there by an earlier installation of the app can't be overwritten: save under a numbered name instead.
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename, ext = dot > 0 ? filename.slice(dot) : "";
  let lastError = null;
  for (let i = 1; i <= 5; i++) {
    const name = i === 1 ? filename : `${stem} (${i})${ext}`;
    const path = directory === "DOCUMENTS" ? `شجرة العائلة/${name}` : name;
    try {
      const r = await FS.writeFile({ path, data, directory, recursive: true });
      return r.uri;
    } catch (e) {
      lastError = e;
      if (directory !== "DOCUMENTS") break;
    }
  }
  throw lastError;
}

/**
 * Hands a generated file to the user. Resolves true once the file was saved or shared.
 * Android app: choose "save to the phone" (Documents/شجرة العائلة) or "share" (WhatsApp, email, Drive...).
 * Web/iPhone: the system share sheet (which includes "Save to Files"), or a normal download.
 */
export async function deliverFile(blob, filename, { title = "الملف جاهز", what = "الملف", note = "" } = {}) {
  if (isNative() && plugin("Filesystem")) {
    return new Promise((resolve) => {
      let chosen = false;
      sheet((close) => {
        const choose = (action) => async () => {
          if (chosen) return;
          chosen = true;
          await close();
          resolve(await action());
        };
        return h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h("h3", null, title),
          note ? h("p", null, note) : null,
          h("button", { class: "btn primary", onclick: choose(async () => {
            const b = busy("جارٍ الحفظ…");
            try {
              await nativeWrite(blob, filename, "DOCUMENTS");
              b.done();
              toast(`حُفظ ${what} في: Documents ← شجرة العائلة`, 4500);
              return true;
            } catch (e) {
              b.done();
              console.error(e);
              toast("تعذر الحفظ في الجهاز، جرّب «مشاركة»", 4500);
              return false;
            }
          }) }, "حفظ في الجهاز"),
          h("button", { class: "btn soft", onclick: choose(async () => {
            const b = busy("جارٍ التجهيز…");
            let uri;
            try { uri = await nativeWrite(blob, filename, "CACHE"); }
            catch (e) { b.done(); console.error(e); toast("تعذر تجهيز الملف للمشاركة"); return false; }
            b.done();
            try {
              await plugin("Share").share({ title: filename, files: [uri] });
              return true;
            } catch (e) {
              return false; // the share sheet was closed without choosing an app
            }
          }) }, "مشاركة (واتساب، البريد، Drive…)"),
        );
      }, { onClose: () => { if (!chosen) resolve(false); } });
    });
  }
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if (e && e.name === "AbortError") return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename, style: { display: "none" } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  toast(`نُزّل ${what}`);
  return true;
}

/** Lets the user pick one file. */
export function pickFile(accept) {
  // In the Android app an empty filter reaches the system picker as an empty type, which can hide every file.
  const filter = accept || (isNative() ? "*/*" : "");
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: filter, style: { position: "fixed", left: "-1000px", top: "0" } });
    document.body.appendChild(input);
    input.addEventListener("change", () => { resolve(input.files && input.files[0] ? input.files[0] : null); input.remove(); }, { once: true });
    input.click();
  });
}
