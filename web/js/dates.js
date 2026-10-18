// Hijri (Umm al-Qura) and Gregorian dates with partial precision.
// A date is stored exactly as entered: {cal: "h"|"g", y, m|null, d|null, approx: bool}.
// Conversions are computed for display and comparison only; they are never stored as the true date.
import { ar } from "./util.js";

export const HIJRI_MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
export const GREG_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DAY = 86400000;
const APPROX_MARGIN_DAYS = 730; // "approximate" dates are compared with a two-year margin each side

const HFMT = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });

/** Gregorian y/m/d -> day number (days since 1970-01-01 UTC). */
export function gDay(y, m, d) {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return Math.round(dt.getTime() / DAY);
}
export function dayToG(day) {
  const dt = new Date(day * DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
/** Day number -> Hijri (Umm al-Qura) y/m/d. */
export function dayToH(day) {
  let y, m, d;
  for (const p of HFMT.formatToParts(new Date(day * DAY))) {
    if (p.type === "year") y = parseInt(p.value, 10);
    else if (p.type === "month") m = parseInt(p.value, 10);
    else if (p.type === "day") d = parseInt(p.value, 10);
  }
  return { y, m, d };
}

const EPOCH = gDay(622, 7, 19); // 1 Muharram 1 AH (approx., arithmetic)
const hMonthStartCache = new Map();

/** Day number of 1/m/y Hijri. */
function hMonthStart(y, m) {
  const key = y * 13 + m;
  if (hMonthStartCache.has(key)) return hMonthStartCache.get(key);
  let est = Math.floor(EPOCH + (y - 1) * 354.36667 + (m - 1) * 29.5306);
  for (let i = 0; i < 60; i++) {
    const h = dayToH(est);
    const cmp = (h.y - y) * 12 + (h.m - m);
    if (cmp === 0) {
      if (h.d === 1) { hMonthStartCache.set(key, est); return est; }
      est -= h.d - 1;
    } else if (cmp < 0) est += Math.max(1, Math.min(29, -cmp * 29));
    else est -= Math.max(1, Math.min(29, cmp * 29));
  }
  throw new Error("hijri conversion failed");
}

/** Hijri y/m/d -> day number, or null when the day does not exist in that month. */
export function hDay(y, m, d) {
  const start = hMonthStart(y, m);
  const day = start + d - 1;
  const h = dayToH(day);
  return h.y === y && h.m === m && h.d === d ? day : null;
}
export function hMonthLength(y, m) {
  const next = m === 12 ? hMonthStart(y + 1, 1) : hMonthStart(y, m + 1);
  return next - hMonthStart(y, m);
}
function gMonthLength(y, m) { return gDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - gDay(y, m, 1); }

export function precision(dt) {
  if (!dt || !dt.y) return null;
  if (dt.m && dt.d) return "day";
  if (dt.m) return "month";
  return "year";
}

/** Returns an error message (Arabic) or null. */
export function validate(dt) {
  if (!dt || dt.y == null) return null;
  const { cal, y, m, d } = dt;
  if (cal === "h" && (y < 1 || y > 1600)) return "السنة الهجرية غير صحيحة";
  if (cal === "g" && (y < 600 || y > 2200)) return "السنة الميلادية غير صحيحة";
  if (d && !m) return "اختر الشهر قبل اليوم";
  if (m && (m < 1 || m > 12)) return "الشهر غير صحيح";
  if (d) {
    const len = cal === "h" ? hMonthLength(y, m) : gMonthLength(y, m);
    if (d < 1 || d > len) return `هذا الشهر ${ar(len)} يومًا فقط`;
  }
  return null;
}

/** [firstDay, lastDay] covered by the (possibly partial) date. */
export function range(dt, withMargin = false) {
  if (!dt || !dt.y || validate(dt)) return null;
  const { cal, y, m, d } = dt;
  let a, b;
  if (cal === "h") {
    if (m && d) a = b = hDay(y, m, d);
    else if (m) { a = hMonthStart(y, m); b = a + hMonthLength(y, m) - 1; }
    else { a = hMonthStart(y, 1); b = hMonthStart(y + 1, 1) - 1; }
  } else {
    if (m && d) a = b = gDay(y, m, d);
    else if (m) { a = gDay(y, m, 1); b = a + gMonthLength(y, m) - 1; }
    else { a = gDay(y, 1, 1); b = gDay(y, 12, 31); }
  }
  if (withMargin && dt.approx) { a -= APPROX_MARGIN_DAYS; b += APPROX_MARGIN_DAYS; }
  return [a, b];
}

const suffix = (cal) => (cal === "h" ? "هـ" : "م");
function fmtParts(cal, y, m, d) {
  const months = cal === "h" ? HIJRI_MONTHS : GREG_MONTHS;
  let s = "";
  if (d) s += ar(d) + " ";
  if (m) s += months[m - 1] + " ";
  return s + ar(y) + suffix(cal);
}

/** The date as entered, e.g. "~١٣٥٥هـ" or "٣ رمضان ١٤٢٠هـ". */
export function formatOriginal(dt) {
  if (!dt || !dt.y) return "";
  return (dt.approx ? "~" : "") + fmtParts(dt.cal, dt.y, dt.m, dt.d);
}

/** The same date in the other calendar; partial dates become a clean approximation with "~". */
export function formatConverted(dt) {
  const r = range(dt);
  if (!r) return "";
  const other = dt.cal === "h" ? "g" : "h";
  const conv = (day) => (other === "h" ? dayToH(day) : dayToG(day));
  const p = precision(dt);
  if (p === "day") {
    const c = conv(r[0]);
    return (dt.approx ? "~" : "") + fmtParts(other, c.y, c.m, c.d);
  }
  const mid = Math.floor((r[0] + r[1]) / 2);
  const c = conv(mid);
  if (p === "month") return "~" + fmtParts(other, c.y, c.m, null);
  // a year spans parts of two years in the other calendar: show the year holding most of it
  return "~" + fmtParts(other, c.y, null, null);
}

/** [primary, secondary] strings following the user's calendar preference. */
export function formatPair(dt, pref = "h") {
  if (!dt || !dt.y) return ["", ""];
  if (dt.cal === pref) return [formatOriginal(dt), formatConverted(dt)];
  return [formatConverted(dt), formatOriginal(dt)];
}

/** Short year-only label for the tree, e.g. "١٣٥٥" or "~١٣٥٥", in the preferred calendar. */
export function yearLabel(dt, pref = "h") {
  if (!dt || !dt.y) return "";
  if (dt.cal === pref) return (dt.approx ? "~" : "") + ar(dt.y);
  const r = range(dt);
  if (!r) return "";
  const mid = Math.floor((r[0] + r[1]) / 2);
  const c = pref === "h" ? dayToH(mid) : dayToG(mid);
  const exact = precision(dt) === "day" && !dt.approx;
  // a full date maps to one exact day, so its year is exact too
  return (exact ? "" : "~") + ar(c.y);
}

/** Today's date as a full Hijri or Gregorian date object. */
export function today(cal = "h") {
  const day = Math.floor(Date.now() / DAY);
  const c = cal === "h" ? dayToH(day) : dayToG(day);
  return { cal, y: c.y, m: c.m, d: c.d, approx: false };
}

/**
 * Compare two dates as ranges: -1 if a is certainly before b, 1 if certainly after, 0 if unknown/overlapping.
 */
export function compare(a, b) {
  const ra = range(a, true), rb = range(b, true);
  if (!ra || !rb) return 0;
  if (ra[1] < rb[0]) return -1;
  if (ra[0] > rb[1]) return 1;
  return 0;
}

export function isEmpty(dt) { return !dt || !dt.y; }
