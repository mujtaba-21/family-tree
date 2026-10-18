// UI pieces about people: chips, photos, date lines.
import { h, icon } from "../util.js";
import * as M from "../model.js";
import * as D from "../dates.js";
import { state, thumbURL } from "../store.js";

export const personHash = (f, pid) => `#/f/${f.id}/p/${pid}`;

/** Clickable name chip (square = male, round = female, white = from outside the family, dashed = empty slot). */
export function chip(f, pid, { current, label } = {}) {
  const p = f.persons[pid];
  if (!p) return null;
  const k = M.kind(f, pid);
  const cls = "chip " + (k === "blank" ? "blank" : p.gender) + (k === "spouse" ? " out" : "") + (current ? " cur" : "");
  return h("a", { class: cls, href: personHash(f, pid), "aria-current": current ? "true" : null },
    k === "blank" ? "—" : label || M.headName(f, pid));
}

/** Photo square/circle; loads the stored thumbnail if any. */
export function photoBox(f, pid, cls = "photo") {
  const p = f.persons[pid];
  const k = M.kind(f, pid);
  const box = h("div", { class: `${cls} ${k === "blank" ? "blank" : p.gender}` }, icon("person"));
  if (p.mainPhoto) thumbURL(p.mainPhoto).then((u) => { if (u) box.replaceChildren(h("img", { src: u, alt: "" })); });
  return box;
}

export function miniPhoto(f, pid) {
  const p = f.persons[pid];
  const box = h("div", { class: "mini-photo " + (p ? p.gender : "none") });
  if (p && p.mainPhoto) thumbURL(p.mainPhoto).then((u) => { if (u) box.replaceChildren(h("img", { src: u, alt: "" })); });
  return box;
}

/** Lines like "وُلد ~١٣٥٥هـ  ~١٩٣٦م". */
export function dateLines(p) {
  const pref = state.settings.calendar;
  const out = [];
  const line = (label, dt) => {
    const [a, b] = D.formatPair(dt, pref);
    return h("div", { class: "pdates" }, `${label} `, h("bdi", null, a), " ", h("span", null, h("bdi", null, b)));
  };
  const fem = p.gender === "f";
  if (p.birth && p.birth.y) out.push(line(fem ? "وُلدت" : "وُلد", p.birth));
  if (p.death && p.death.y) out.push(line(fem ? "توفيت" : "توفي", p.death));
  return out;
}

export function rahmaText(p) { return p.gender === "f" ? "رحمها الله" : "رحمه الله"; }

export function isDeceased(p) { return !!(p.deceased || (p.death && p.death.y)); }

/** Mother/father wording that respects gender. */
export const spouseWord = (gender) => (gender === "f" ? "زوجة" : "زوج");
export const spousesWord = (hostGender) => (hostGender === "m" ? "الزوجات والأبناء" : "الأزواج والأبناء");
