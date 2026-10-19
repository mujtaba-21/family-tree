// Backup file: a ZIP holding family.json (readable text, all relationships) and the photos.
// The same file restores the family on any device running the app.
import * as store from "../store.js";
import * as M from "../model.js";
import { deliverFile, pickFile } from "../platform.js";
import { busy, dialog, alertMsg, toast } from "../ui/kit.js";
import { todayISO } from "../util.js";

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "عائلة";

/** Exports a family; returns true when the file was handed to the user. */
export async function exportBackup(familyId) {
  const b = busy("جارٍ تجهيز النسخة الاحتياطية…");
  try {
    await store.flush();
    const f = store.state.family && store.state.family.id === familyId ? store.state.family : await store.db.getFamily(familyId);
    const zip = new window.JSZip();
    zip.file("family.json", JSON.stringify(M.toJSON(f), null, 1));
    const ids = await store.db.listPhotoIds(familyId);
    for (const id of ids) {
      const ph = await store.db.getPhoto(id);
      if (!ph) continue;
      zip.file(`photos/${id}.jpg`, ph.full);
      zip.file(`photos/${id}_t.jpg`, ph.thumb);
    }
    zip.file("README.txt", "نسخة احتياطية من تطبيق «شجرة العائلة».\nلاسترجاعها: افتح التطبيق ← العائلات ← استيراد من ملف، واختر هذا الملف كما هو دون فك ضغطه.\nملف family.json يحوي كل البيانات نصًّا، ومجلد photos يحوي الصور.\n");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/zip" });
    b.done();
    const ok = await deliverFile(blob, `شجرة-${safeName(f.name)}-${todayISO()}.zip`, { title: "النسخة الاحتياطية جاهزة", what: "الملف", note: "ملف واحد فيه كل بيانات العائلة وصورها. احفظه في مكان آمن، أو أرسله لجهاز آخر." });
    if (ok) await store.markExported(familyId);
    return ok;
  } catch (e) {
    b.done();
    console.error(e);
    await alertMsg("تعذر التصدير", "حدث خطأ أثناء تجهيز الملف. حاول مرة أخرى.");
    return false;
  }
}

/** Imports a backup file; returns the id of the family to open (or null). */
export async function importBackup() {
  const file = await pickFile("");
  if (!file) return null;
  const b = busy("جارٍ قراءة الملف…");
  let obj = null, zip = null;
  try {
    try {
      zip = await window.JSZip.loadAsync(file);
      const entry = zip.file("family.json");
      if (!entry) throw new Error("no family.json");
      obj = JSON.parse(await entry.async("string"));
    } catch (e) {
      zip = null;
      obj = JSON.parse(await file.text()); // a bare family.json also works
    }
  } catch (e) {
    b.done();
    await alertMsg("تعذر فتح الملف", "اختر ملف النسخة الاحتياطية (zip) الذي صدّرته من التطبيق، دون فك ضغطه.");
    return null;
  }
  const err = M.validateImport(obj);
  if (err) { b.done(); await alertMsg("تعذر الاستيراد", err); return null; }
  b.done();

  let family = obj;
  let photoMap = null;
  const existing = await store.db.getFamily(obj.id);
  if (existing) {
    const choice = await dialog({
      title: `«${existing.name}» موجودة`,
      text: "هذه العائلة موجودة في التطبيق. هل تستبدلها بما في الملف، أم تضيف الملف عائلة مستقلة؟",
      buttons: [{ label: "استبدال", value: "replace", cls: "danger" }, { label: "إضافة نسخة", value: "copy", cls: "primary" }],
    });
    if (!choice) return null;
    if (choice === "copy") {
      const res = M.copyFamily(obj, `${obj.name} (مستورد)`);
      family = res.family; photoMap = res.photoMap;
    } else {
      await store.deleteFamily(existing.id);
    }
  }
  const b2 = busy("جارٍ الاستيراد…");
  try {
    if (zip) {
      for (const p of Object.values(obj.persons)) {
        for (const pid of p.photos || []) {
          const full = zip.file(`photos/${pid}.jpg`), thumb = zip.file(`photos/${pid}_t.jpg`);
          if (!full) continue;
          const fullBlob = new Blob([await full.async("uint8array")], { type: "image/jpeg" });
          const thumbBlob = thumb ? new Blob([await thumb.async("uint8array")], { type: "image/jpeg" }) : fullBlob;
          const newId = photoMap ? photoMap.get(pid) : pid;
          await store.db.putPhoto({ id: newId, familyId: family.id, full: fullBlob, thumb: thumbBlob });
        }
      }
    }
    family.updated = Date.now();
    await store.db.putFamily(M.toJSON(family));
    await store.markExported(family.id); // the file it came from is itself a backup
    b2.done();
    toast(`استُوردت «${family.name}»`);
    return family.id;
  } catch (e) {
    b2.done();
    console.error(e);
    await alertMsg("تعذر الاستيراد", "حدث خطأ أثناء حفظ البيانات. حاول مرة أخرى.");
    return null;
  }
}
