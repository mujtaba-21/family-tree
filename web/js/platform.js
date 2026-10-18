// Differences between the Android app (Capacitor) and the web/iPhone version.
import { h } from "./util.js";
import { sheet, toast, hasOverlay } from "./ui/kit.js";

const Cap = () => window.Capacitor;
export const isNative = () => !!(Cap() && Cap().isNativePlatform && Cap().isNativePlatform());
const plugin = (name) => (Cap() && Cap().Plugins ? Cap().Plugins[name] : null);

export function initPlatform() {
  const App = plugin("App");
  if (isNative() && App) {
    App.addListener("backButton", () => {
      if (hasOverlay()) { history.back(); return; }
      const atHome = !location.hash || location.hash === "#/" || location.hash === "#";
      if (atHome) App.exitApp(); else history.back();
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
  const path = directory === "DOCUMENTS" ? `شجرة العائلة/${filename}` : filename;
  if (directory === "DOCUMENTS" && FS.checkPermissions) {
    try {
      const p = await FS.checkPermissions();
      if (p && p.publicStorage && p.publicStorage !== "granted") await FS.requestPermissions();
    } catch (e) { /* newer Android needs no permission */ }
  }
  const r = await FS.writeFile({ path, data, directory, recursive: true });
  return r.uri;
}

/**
 * Hands a generated file to the user.
 * Android app: choose "save to the phone" (Documents/شجرة العائلة) or "share" (WhatsApp, email, Drive...).
 * Web/iPhone: the system share sheet (which includes "Save to Files"), or a normal download.
 */
export async function deliverFile(blob, filename, { title = "الملف جاهز", what = "الملف", note = "" } = {}) {
  if (isNative() && plugin("Filesystem")) {
    return new Promise((resolve) => {
      sheet((close) => h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h("h3", null, title),
        note ? h("p", null, note) : null,
        h("button", { class: "btn primary", onclick: async () => {
          close();
          try { await nativeWrite(blob, filename, "DOCUMENTS"); toast(`حُفظ ${what} في المستندات/شجرة العائلة`, 4200); resolve(true); }
          catch (e) { toast("تعذر الحفظ في الجهاز، جرّب «مشاركة»"); resolve(false); }
        } }, "حفظ في الجهاز"),
        h("button", { class: "btn soft", onclick: async () => {
          close();
          try {
            const uri = await nativeWrite(blob, filename, "CACHE");
            await plugin("Share").share({ title: filename, files: [uri] });
            resolve(true);
          } catch (e) { resolve(false); }
        } }, "مشاركة (واتساب، البريد، Drive…)"),
      ), { onClose: () => resolve(false) });
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
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: accept || "", style: { position: "fixed", left: "-1000px", top: "0" } });
    document.body.appendChild(input);
    input.addEventListener("change", () => { resolve(input.files && input.files[0] ? input.files[0] : null); input.remove(); }, { once: true });
    input.click();
  });
}
