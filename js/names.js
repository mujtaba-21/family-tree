// Name normalisation and the "last gender used for a name" memory (shared across families).
import * as db from "./db.js";

const DIACRITICS = /[ً-ٰٟـ]/g; // harakat, superscript alef, tatweel

/** Clean a name for storage/display: trims and collapses spaces, removes tatweel. */
export function cleanName(s) {
  return String(s ?? "").replace(/ـ/g, "").replace(/\s+/g, " ").trim();
}

/** Key used for matching names: no diacritics, unified letter forms, no spaces (عبد الله = عبدالله). */
export function nameKey(s) {
  return String(s ?? "")
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, "")
    .trim();
}

let memory = null; // Map nameKey -> "m" | "f"

export async function loadGenderMemory() {
  const saved = await db.getMeta("genderMemory");
  memory = new Map(Object.entries(saved || {}));
}

export function guessGender(name) {
  if (!memory) return null;
  return memory.get(nameKey(name)) || null;
}

export function rememberGender(name, gender) {
  if (!memory || !name || !gender) return;
  const k = nameKey(name);
  if (!k) return;
  if (memory.get(k) === gender) return;
  memory.set(k, gender);
  db.setMeta("genderMemory", Object.fromEntries(memory));
}

/** Split typed text into search tokens (normalised). */
export function searchTokens(q) {
  return String(q ?? "")
    .replace(DIACRITICS, "")
    .split(/\s+/)
    .map((t) => nameKey(t))
    .filter(Boolean);
}
