// Screen 3: add several children at once, eldest first, like rows in a table.
import { h, icon, ar } from "../util.js";
import { appBar, screen, toast, segmented } from "./kit.js";
import { guessGender } from "../names.js";
import * as M from "../model.js";
import * as store from "../store.js";
import { personHash } from "./common.js";

function addLabel(rows) {
  const n = rows.length;
  if (!n) return "إضافة";
  const m = rows.filter((r) => r.gender === "m").length, fe = rows.filter((r) => r.gender === "f").length;
  if (m === n) return n === 1 ? "إضافة الابن" : n === 2 ? "إضافة الابنين" : n <= 10 ? `إضافة ${ar(n)} أبناء` : `إضافة ${ar(n)} ابنًا`;
  if (fe === n) return n === 1 ? "إضافة البنت" : n === 2 ? "إضافة البنتين" : n <= 10 ? `إضافة ${ar(n)} بنات` : `إضافة ${ar(n)} بنتًا`;
  return n === 2 ? "إضافة الاثنين" : n <= 10 ? `إضافة ${ar(n)} أبناء` : `إضافة ${ar(n)} ابنًا`;
}

export function addKidsScreen(f, pid, unionId) {
  const p = f.persons[pid];
  const u = unionId === "new" ? null : f.unions[unionId];
  const other = u ? M.spouseIn(u, pid) : null;
  const title = other && f.persons[other] ? `أبناء ${M.headName(f, pid)} و${M.headName(f, other)}` : `أبناء ${M.headName(f, pid) || "هذه الخانة"}`;
  const existing = u ? u.kids.length : 0;

  const rows = []; // {name, gender, auto, manual, el}
  const list = h("div", { class: "card", style: { padding: "6px 12px" } });
  const save = h("button", { class: "btn primary", disabled: true });
  const msg = h("div", { class: "err-t" });

  const filled = () => rows.filter((r) => r.name.trim());
  const refresh = () => {
    const fl = filled();
    const missing = fl.filter((r) => !r.gender);
    save.disabled = !fl.length || missing.length > 0;
    save.textContent = addLabel(fl);
    msg.textContent = missing.length ? "اختر ذكر أو أنثى للأسماء الجديدة" : "";
    rows.forEach((r, i) => { r.num.textContent = ar(existing + i + 1); });
  };

  const addRow = (focus) => {
    const r = { name: "", gender: null, auto: false, manual: false };
    const input = h("input", { class: "inp", placeholder: rows.length === 0 && !existing ? "الأكبر" : "الاسم", enterkeyhint: "next", autocomplete: "off", maxlength: 40 });
    const autoTag = h("span", { class: "auto", style: { display: "none" } }, "تلقائي");
    const seg = segmented([{ value: "m", label: "ذكر", cls: "m" }, { value: "f", label: "أنثى", cls: "f" }], null, (g) => {
      r.gender = g; r.manual = true; r.auto = false; autoTag.style.display = "none"; refresh();
    }, { cls: "seg g" });
    const rm = h("button", { class: "rm", "aria-label": "حذف السطر", onclick: () => {
      const i = rows.indexOf(r);
      if (rows.length === 1) { input.value = ""; r.name = ""; r.gender = null; seg.setValue(null); refresh(); return; }
      rows.splice(i, 1); r.el.remove(); refresh();
    } }, icon("close"));
    r.num = h("span", { class: "num" });
    input.addEventListener("input", () => {
      r.name = input.value;
      if (!r.manual) {
        const g = r.name.trim() ? guessGender(r.name) : null;
        r.gender = g; r.auto = !!g;
        seg.setValue(g);
        autoTag.style.display = g ? "" : "none";
      }
      if (rows[rows.length - 1] === r && r.name.trim()) addRow(false);
      refresh();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const i = rows.indexOf(r);
        if (!rows[i + 1]) addRow(false);
        rows[i + 1].input.focus();
      }
    });
    r.input = input;
    r.el = h("div", { class: "brow" }, r.num, input, h("div", { class: "gwrap" }, autoTag, seg), rm);
    rows.push(r);
    list.appendChild(r.el);
    if (focus) setTimeout(() => input.focus(), 60);
    refresh();
  };
  addRow(true);

  save.addEventListener("click", () => {
    const fl = filled();
    if (!fl.length || fl.some((r) => !r.gender)) return;
    const union = u || M.unknownSpouseUnion(f, pid, true);
    const ids = M.addChildren(f, union.id, fl.map((r) => ({ name: r.name, gender: r.gender })));
    store.changed();
    toast("تمت " + addLabel(fl));
    history.back();
  });

  return screen(
    appBar({ title, back: true }),
    h("main", { class: "body", style: { gap: "10px" } },
      existing ? h("div", { class: "hint" }, `سبق تسجيل ${ar(existing)} من ${other ? "أبنائهما" : p.gender === "f" ? "أبنائها" : "أبنائه"}. الجدد يُضافون بعدهم، وتستطيع ترتيبهم لاحقًا.`) : null,
      list,
      msg,
      h("div", { class: "hint" }, "اكتب الأكبر أولًا. «التالي» في لوحة المفاتيح ينقلك للسطر التالي، والجنس يُملأ تلقائيًا للأسماء المُدخلة سابقًا، وتستطيع تغييره."),
      !u ? h("div", { class: "hint" }, p.gender === "m" ? "لم تُحدَّد أمهم بعد. تستطيع تحديدها عند إضافة الزوجة." : "لم يُحدَّد أبوهم بعد. تستطيع تحديده عند إضافة الزوج.") : null,
      h("div", { class: "spacer" }),
      save,
    ),
  );
}
