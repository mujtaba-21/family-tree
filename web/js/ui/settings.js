// Settings.
import { h } from "../util.js";
import { appBar, screen, field, segmented, toggle, help } from "./kit.js";
import { state, saveSettings } from "../store.js";
import { applyTheme } from "../theme.js";
import * as M from "../model.js";
import { APP_VERSION } from "../version.js";

export function settingsScreen() {
  const s = state.settings;
  return screen(
    appBar({ title: "الإعدادات", back: true }),
    h("main", { class: "body" },
      field("المظهر", segmented([{ value: "light", label: "فاتح" }, { value: "dark", label: "داكن" }, { value: "auto", label: "حسب الجوال" }],
        s.appearance || "auto", (v) => { s.appearance = v; saveSettings(); applyTheme(); }, { cls: "bigseg" }), { helpKey: "appearance" }),
      field("التقويم الأساسي", segmented([{ value: "h", label: "هجري" }, { value: "g", label: "ميلادي" }], s.calendar, (v) => { s.calendar = v; saveSettings(); }, { cls: "bigseg" }), { helpKey: "calendar" }),
      h("div", { class: "toggle-row" }, h("span", { class: "l" }, "إظهار «بن» و«بنت» في الأسماء", help("bin")),
        toggle(!!s.bin, (v) => { s.bin = v; M.setNameOptions({ bin: v }); saveSettings(); })),
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
