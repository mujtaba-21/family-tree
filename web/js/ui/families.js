// Screen 1: the list of families.
import { h, icon, ar } from "../util.js";
import { appBar, screen, menu, confirm, prompt, toast, help } from "./kit.js";
import * as store from "../store.js";
import { exportBackup, importBackup } from "../export/backup.js";

export function countPeople(n) {
  if (n === 1) return "شخص واحد";
  if (n === 2) return "شخصان";
  if (n >= 3 && n <= 10) return `${ar(n)} أشخاص`;
  return `${ar(n)} شخصًا`;
}

export function relTime(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days === 2) return "قبل يومين";
  if (days <= 10) return `قبل ${ar(days)} أيام`;
  if (days < 14) return `قبل ${ar(days)} يومًا`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return weeks === 2 ? "قبل أسبوعين" : `قبل ${ar(weeks)} أسابيع`;
  const months = Math.floor(days / 30);
  if (days < 365) return months === 2 ? "قبل شهرين" : months <= 10 ? `قبل ${ar(months)} أشهر` : `قبل ${ar(months)} شهرًا`;
  const years = Math.floor(days / 365);
  if (years === 1) return "قبل سنة";
  if (years === 2) return "قبل سنتين";
  return years <= 10 ? `قبل ${ar(years)} سنوات` : `قبل ${ar(years)} سنة`;
}

function daysWord(days) {
  if (days === 1) return "يوم";
  if (days === 2) return "يومين";
  if (days <= 10) return `${ar(days)} أيام`;
  return `${ar(days)} يومًا`;
}

export async function familiesScreen(rerender) {
  const list = await store.familySummaries();
  const { reminderDays } = store.state.settings;

  // backup reminder: a family changed since its last export, and the last export is old
  let reminder = null;
  if (reminderDays > 0) {
    const due = list.filter((x) => x.count > 1 && x.updated > x.lastExport && Date.now() - (x.lastExport || x.created) > reminderDays * 86400000);
    if (due.length) {
      const x = due[0];
      const days = Math.floor((Date.now() - (x.lastExport || x.created)) / 86400000);
      const text = x.lastExport ? `آخر نسخة احتياطية من «${x.name}» قبل ${daysWord(days)}` : `لا توجد نسخة احتياطية من «${x.name}» بعد`;
      reminder = h("div", { class: "banner", role: "note" }, h("span", null, text),
        h("button", { class: "go", onclick: async () => { if (await exportBackup(x.id)) rerender(); } }, "تصدير الآن"));
    }
  }

  const cards = list.map((x) => {
    const more = h("button", { class: "ib", "aria-label": "خيارات العائلة" }, icon("more"));
    more.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      menu(more, [
        { label: "نسخ العائلة", icon: "copy", onclick: async () => {
          const name = await prompt({ title: "نسخ العائلة", text: "تُنشأ عائلة مستقلة مطابقة، وتعديلها لا يغيّر الأصلية.", value: `${x.name} (نسخة)`, ok: "نسخ" });
          if (!name) return;
          await store.duplicateFamily(x.id, name);
          toast("نُسخت العائلة");
          rerender();
        } },
        { label: "تصدير البيانات", icon: "download", onclick: async () => { if (await exportBackup(x.id)) rerender(); } },
        { label: "إعادة تسمية", icon: "edit", onclick: async () => {
          const name = await prompt({ title: "اسم العائلة", value: x.name });
          if (!name) return;
          await store.renameFamily(x.id, name);
          rerender();
        } },
        { sep: true },
        { label: "حذف العائلة", icon: "trash", danger: true, onclick: async () => {
          const ok = await confirm({
            title: `حذف «${x.name}»؟`,
            text: `ستُحذف العائلة (${countPeople(x.count)}) وكل صورها من هذا الجهاز.`,
            warn: "لا يمكن التراجع. إن لم تكن عندك نسخة احتياطية فصدّرها أولًا.",
            ok: "حذف", danger: true,
          });
          if (!ok) return;
          await store.deleteFamily(x.id);
          toast("حُذفت العائلة");
          rerender();
        } },
      ]);
    });
    return h("a", { class: "card fam", href: `#/f/${x.id}` },
      h("div", { class: "ic" }, icon("sprout")),
      h("div", { class: "t" }, h("b", null, x.name), h("span", null, `${countPeople(x.count)}، آخر تعديل ${relTime(x.updated)}`)),
      more,
    );
  });

  const empty = h("div", { class: "card empty" },
    h("b", null, "لا توجد عائلات بعد"),
    "ابدأ بإنشاء عائلة جديدة، وأول من تضيفه هو الجد الجامع ", help("root"), ".",
    h("br"), "أو افتح نسخة محفوظة من «استيراد من ملف».");

  return screen(
    appBar({ title: "العائلات", big: true, actions: [{ icon: "settings", label: "الإعدادات", onclick: () => (location.hash = "#/settings") }] }),
    h("main", { class: "body" },
      reminder,
      list.length ? cards : empty,
      h("div", { class: "spacer" }),
      h("a", { class: "btn primary", href: "#/new" }, icon("plus"), "عائلة جديدة"),
      h("div", { class: "row", style: { flexWrap: "nowrap", gap: "8px" } },
        h("button", { class: "btn soft", onclick: async () => { const id = await importBackup(); if (id) location.hash = `#/f/${id}`; } }, icon("upload"), "استيراد من ملف"),
        help("exportData")),
    ),
  );
}
