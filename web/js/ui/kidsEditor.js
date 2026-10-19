// Rows for typing several children at once, eldest first: name + ذكر/أنثى, a new row appears as you
// type, «سطر جديد» adds one, × removes one, and pressing and holding a row drags it to another place.
import { h, icon, ar } from "../util.js";
import { segmented } from "./kit.js";
import { guessGender } from "../names.js";
import { sortableRow } from "./sortable.js";

/**
 * existing: children already recorded (numbering continues after them).
 * initial: rows to show again ([{name, gender, manual}]). onChange(): after any change.
 */
export function kidsEditor({ existing = 0, initial = [], onChange = () => {} } = {}) {
  const rows = []; // {name, gender, auto, manual, el, input, num, seg}
  const list = h("div", { class: "kids-ed" });

  const renumber = () => rows.forEach((r, i) => { r.num.textContent = ar(existing + i + 1); });
  const changed = () => { renumber(); onChange(); };

  const move = (from, to) => {
    const [r] = rows.splice(from, 1);
    rows.splice(to, 0, r);
    list.replaceChildren(...rows.map((x) => x.el));
    changed();
  };

  const addRow = ({ name = "", gender = null, manual = false } = {}, focus = false) => {
    const r = { name, gender, auto: false, manual };
    const input = h("input", { class: "inp", value: name, placeholder: rows.length === 0 && !existing ? "الأكبر" : "الاسم", enterkeyhint: "next", autocomplete: "off", maxlength: 40 });
    const autoTag = h("span", { class: "auto", style: { display: "none" } }, "تلقائي");
    const seg = segmented([{ value: "m", label: "ذكر", cls: "m" }, { value: "f", label: "أنثى", cls: "f" }], gender, (g) => {
      r.gender = g; r.manual = true; r.auto = false; autoTag.style.display = "none"; r.el.classList.remove("need"); changed();
    }, { cls: "seg g" });
    const rm = h("button", { class: "rm", type: "button", "aria-label": "حذف السطر", onclick: () => {
      const i = rows.indexOf(r);
      if (rows.length === 1) { input.value = ""; r.name = ""; r.gender = null; r.manual = false; seg.setValue(null); changed(); return; }
      rows.splice(i, 1); r.el.remove(); changed();
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
      if (rows[rows.length - 1] === r && r.name.trim()) addRow();
      changed();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const i = rows.indexOf(r);
      if (!rows[i + 1]) addRow();
      rows[i + 1].input.focus();
    });
    r.input = input; r.seg = seg;
    r.el = h("div", { class: "brow" }, h("span", { class: "grip", "aria-hidden": "true" }, "⠿"), r.num, input, h("div", { class: "gwrap" }, autoTag, seg), rm);
    sortableRow(r.el, list, move);
    rows.push(r);
    list.appendChild(r.el);
    if (focus) setTimeout(() => input.focus(), 60);
    changed();
    return r;
  };

  for (const r of initial) addRow(r);
  if (!rows.length || rows[rows.length - 1].name.trim()) addRow();

  const filled = () => rows.filter((r) => r.name.trim());
  return {
    node: list,
    newRowButton: () => h("button", { class: "btn text addrow", type: "button", onclick: () => addRow({}, true) }, icon("plus"), "سطر جديد"),
    focus: () => { const r = rows.find((x) => !x.name.trim()) || rows[0]; if (r) setTimeout(() => r.input.focus(), 80); },
    /** Typed children in order: [{name, gender}] (gender may be null). */
    filled: () => filled().map((r) => ({ name: r.name.trim(), gender: r.gender })),
    /** Rows with a name but no gender yet; marks them so they stand out. */
    missing: () => {
      const m = filled().filter((r) => !r.gender);
      for (const r of m) r.el.classList.add("need");
      return m.map((r) => r.name.trim());
    },
    /** Everything typed, to show the rows again later. */
    state: () => filled().map((r) => ({ name: r.name, gender: r.gender, manual: r.manual })),
  };
}

/** «إضافة ٣ أبناء»-style label for what the rows hold. */
export function addLabel(rows) {
  const n = rows.length;
  if (!n) return "إضافة";
  const m = rows.filter((r) => r.gender === "m").length, fe = rows.filter((r) => r.gender === "f").length;
  if (m === n) return n === 1 ? "إضافة الابن" : n === 2 ? "إضافة الابنين" : n <= 10 ? `إضافة ${ar(n)} أبناء` : `إضافة ${ar(n)} ابنًا`;
  if (fe === n) return n === 1 ? "إضافة البنت" : n === 2 ? "إضافة البنتين" : n <= 10 ? `إضافة ${ar(n)} بنات` : `إضافة ${ar(n)} بنتًا`;
  return n === 2 ? "إضافة الاثنين" : n <= 10 ? `إضافة ${ar(n)} أبناء` : `إضافة ${ar(n)} ابنًا`;
}
