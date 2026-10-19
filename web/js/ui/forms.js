// Form controls shared by several screens.
import { h, icon, ar, parseIntAny } from "../util.js";
import { field, segmented, checkbox, toggle, help } from "./kit.js";
import * as D from "../dates.js";
import { state } from "../store.js";

const ANCESTOR = ["اسم الأب", "اسم الجد", "اسم أبي الجد", "اسم جد الجد"];
const ORDINAL = ["", "", "", "", "", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
export const ancestorLabel = (i) => ANCESTOR[i] || `اسم الجد ${ORDINAL[i + 1] || ar(i + 1)}`;

/**
 * Fathers' names, nearest first, one box each. Writing in the last box opens the next one
 * (labelled «اسم الجد», «اسم أبي الجد», ...); a box emptied in the middle closes.
 */
export function namesInput(initial, onchange) {
  const wrap = h("div", { class: "names-row" });
  const inputs = [];
  const emit = () => onchange(inputs.map((i) => i.value.trim()).filter(Boolean));
  const relabel = () => inputs.forEach((inp, i) => { inp.placeholder = ancestorLabel(i); inp.setAttribute("aria-label", ancestorLabel(i)); });
  const tidy = () => {
    for (const inp of [...inputs]) {
      if (inp.value.trim() || inp === inputs[inputs.length - 1] || inp === document.activeElement) continue;
      inputs.splice(inputs.indexOf(inp), 1);
      inp.remove();
    }
    relabel();
  };
  const add = (value = "") => {
    const inp = h("input", { class: "inp", name: "ancestor", value, enterkeyhint: "next", autocomplete: "off", maxlength: 40 });
    inp.addEventListener("input", () => {
      if (inp === inputs[inputs.length - 1] && inp.value.trim()) { add(); relabel(); }
      emit();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = inputs[inputs.indexOf(inp) + 1];
      if (next) next.focus();
    });
    inp.addEventListener("blur", () => setTimeout(tidy, 0));
    inputs.push(inp);
    wrap.appendChild(inp);
    return inp;
  };
  for (const v of (initial || []).filter(Boolean)) add(v);
  add();
  relabel();
  return wrap;
}

export function genderInput(value, onchange) {
  return segmented([{ value: "m", label: "ذكر", cls: "m" }, { value: "f", label: "أنثى", cls: "f" }], value, onchange, { cls: "seg g" });
}

/**
 * Date entry: year, month, day + calendar switch + "approximate".
 * value: date object or null. onchange(dateOrNull)
 */
export function dateInput(value, onchange) {
  let dt = value && value.y ? { ...value } : { cal: state.settings.calendar, y: null, m: null, d: null, approx: false };
  const yIn = h("input", { class: "inp y", inputmode: "numeric", placeholder: "السنة", value: dt.y ? ar(dt.y) : "", "aria-label": "السنة" });
  const mSel = h("select", { class: "inp mo", "aria-label": "الشهر" });
  const dIn = h("input", { class: "inp d", inputmode: "numeric", placeholder: "اليوم", value: dt.d ? ar(dt.d) : "", "aria-label": "اليوم" });
  const conv = h("span", null);
  const err = h("div", { class: "err-t" });
  const fillMonths = () => {
    const names = dt.cal === "h" ? D.HIJRI_MONTHS : D.GREG_MONTHS;
    mSel.replaceChildren(h("option", { value: "" }, "الشهر"), ...names.map((n, i) => h("option", { value: String(i + 1), selected: dt.m === i + 1 }, n)));
  };
  fillMonths();
  const update = () => {
    dt.y = parseIntAny(yIn.value);
    dt.m = mSel.value ? parseInt(mSel.value, 10) : null;
    dt.d = parseIntAny(dIn.value);
    if (!dt.m) dt.d = null;
    dIn.disabled = !dt.m;
    mSel.classList.toggle("ph", !dt.m);
    const e = dt.y ? D.validate(dt) : null;
    err.textContent = e || "";
    yIn.classList.toggle("err", !!e);
    conv.textContent = dt.y && !e ? "يقابله " + D.formatConverted(dt) : "";
    onchange(dt.y && !e ? { cal: dt.cal, y: dt.y, m: dt.m || null, d: dt.d || null, approx: !!dt.approx } : dt.y ? undefined : null);
  };
  yIn.addEventListener("input", update);
  yIn.addEventListener("blur", () => { const n = parseIntAny(yIn.value); if (n) yIn.value = ar(n); });
  dIn.addEventListener("input", update);
  dIn.addEventListener("blur", () => { const n = parseIntAny(dIn.value); if (n) dIn.value = ar(n); });
  mSel.addEventListener("change", update);
  const cal = segmented([{ value: "h", label: "هـ" }, { value: "g", label: "م" }], dt.cal, (c) => { dt.cal = c; const m = mSel.value; fillMonths(); mSel.value = m; update(); });
  const approx = checkbox("تقريبي", dt.approx, (v) => { dt.approx = v; update(); });
  dIn.disabled = !dt.m;
  mSel.classList.toggle("ph", !dt.m);
  setTimeout(() => { conv.textContent = dt.y && !D.validate(dt) ? "يقابله " + D.formatConverted(dt) : ""; }, 0);
  return h("div", { class: "field-date", style: { display: "flex", flexDirection: "column", gap: "6px" } },
    h("div", { class: "date-row" }, yIn, mSel, dIn, cal),
    h("div", { class: "under" }, conv, h("span", { class: "row", style: { gap: "6px", flexWrap: "nowrap" } }, approx, help("approx"))),
    err,
  );
}

export { field, toggle, help };
