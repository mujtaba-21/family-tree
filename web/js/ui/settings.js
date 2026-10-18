// Settings.
import { h } from "../util.js";
import { appBar, screen, field, segmented, help } from "./kit.js";
import { state, saveSettings } from "../store.js";
import { APP_VERSION } from "../version.js";

export function settingsScreen() {
  const s = state.settings;
  return screen(
    appBar({ title: "الإعدادات", back: true }),
    h("main", { class: "body" },
      field("التقويم الأساسي", segmented([{ value: "h", label: "هجري" }, { value: "g", label: "ميلادي" }], s.calendar, (v) => { s.calendar = v; saveSettings(); }, { cls: "bigseg" }), { helpKey: "calendar" }),
      field("تذكير النسخ الاحتياطي", segmented([
        { value: 7, label: "أسبوع" }, { value: 30, label: "شهر" }, { value: 90, label: "٣ أشهر" }, { value: 0, label: "بلا تذكير" },
      ], s.reminderDays, (v) => { s.reminderDays = v; saveSettings(); }, { cls: "bigseg" }), { helpKey: "reminder" }),
      h("div", { class: "card about" },
        h("b", { style: { color: "var(--ink)", display: "block", fontSize: "16px", marginBottom: "4px" } }, "شجرة العائلة"),
        "يعمل التطبيق دون إنترنت. بياناتك محفوظة في هذا الجهاز فقط، ولا تخرج منه إلا بملف تصدّره أنت.",
        h("br"),
        `الإصدار ${APP_VERSION}`),
    ),
  );
}
