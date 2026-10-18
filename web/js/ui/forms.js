// Form controls shared by several screens.
import { h, icon, ar, parseIntAny } from "../util.js";
import { field, segmented, checkbox, toggle, help } from "./kit.js";
import * as D from "../dates.js";
import { state } from "../store.js";

/** Several name boxes in a row (father, grandfather, ...) with a "+" to add more. */
export function namesInput(initial, onchange, { placeholders = ["اسم الأب", "اسم الجد", "الجد الثاني"] } = {}) {
  const wrap = h("div", { class: "names-row" });
  let values = initial && initial.length ? [...initial] : [""];
  const emit = () => onchange(values.map((v) => v.trim()).filter(Boolean));
  const render = (focusLast) => {
    wrap.replaceChildren();
    values.forEach((v, i) => {
      const inp = h("input", { class: "inp", value: v, placeholder: placeholders[i] || `الجد ${ar(i)}`, enterkeyhint: "next", autocomplete: "off" });
      inp.addEventListener("input", () => { values[i] = inp.value; emit(); });
      wrap.appendChild(inp);
      if (focusLast && i === values.length - 1) setTimeout(() => inp.focus(), 30);
    });
    wrap.appendChild(h("button", { class: "addname", type: "button", "aria-label": "اسم آخر", onclick: () => { values.push(""); render(true); } }, icon("plus")));
  };
  render(false);
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
