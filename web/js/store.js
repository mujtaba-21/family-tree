// App state: the open family, settings, photos. Saves automatically.
import * as db from "./db.js";
import * as M from "./model.js";
import { debounce } from "./util.js";
import { loadGenderMemory } from "./names.js";

export const state = {
  family: null,       // the open family (in memory)
  settings: { calendar: "h", reminderDays: 30, cousinStyle: "ref", appearance: "auto", bin: false },
  lastPerson: {},     // familyId -> last visited person id
};

export async function init() {
  await db.requestPersistence();
  await loadGenderMemory();
  const s = await db.getMeta("settings");
  if (s) Object.assign(state.settings, s);
  M.setNameOptions({ bin: !!state.settings.bin });
  state.lastPerson = (await db.getMeta("lastPerson")) || {};
}

export function saveSettings() { return db.setMeta("settings", state.settings); }

// ------------------------------------------------------------------ families
export async function familySummaries() {
  const all = await db.listFamilies();
  const exports = (await db.getMeta("lastExport")) || {};
  return all
    .map((f) => ({
      id: f.id, name: f.name, count: Object.values(f.persons).filter((p) => !p.blank).length,
      updated: f.updated, created: f.created, lastExport: exports[f.id] || 0,
    }))
    .sort((a, b) => b.updated - a.updated);
}

export async function openFamily(id) {
  if (state.family && state.family.id === id) return state.family;
  await flush();
  const f = await db.getFamily(id);
  if (f) f._rev = 1;
  state.family = f || null;
  return state.family;
}

const writeSoon = debounce(async (f) => { await db.putFamily(M.toJSON(f)); }, 350);
/** Call after every change to the open family. */
export function changed() {
  const f = state.family;
  if (!f) return;
  M.touch(f);
  writeSoon(f);
}
export async function flush() {
  writeSoon.flush(state.family);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
window.addEventListener("pagehide", () => flush());

export async function saveNewFamily(f) {
  await db.putFamily(M.toJSON(f));
  state.family = f;
}

export async function renameFamily(id, name) {
  const f = id === state.family?.id ? state.family : await db.getFamily(id);
  f.name = name;
  f.updated = Date.now();
  await db.putFamily(M.toJSON(f));
}

export async function deleteFamily(id) {
  if (state.family?.id === id) state.family = null;
  await db.deleteFamily(id);
  const ex = (await db.getMeta("lastExport")) || {};
  delete ex[id];
  await db.setMeta("lastExport", ex);
}

export async function duplicateFamily(id, name) {
  await flush();
  const src = id === state.family?.id ? state.family : await db.getFamily(id);
  const { family, photoMap } = M.copyFamily(src, name);
  for (const [oldId, newId] of photoMap) {
    const ph = await db.getPhoto(oldId);
    if (ph) await db.putPhoto({ ...ph, id: newId, familyId: family.id });
  }
  await db.putFamily(M.toJSON(family));
  return family;
}

export async function markExported(id) {
  const ex = (await db.getMeta("lastExport")) || {};
  ex[id] = Date.now();
  await db.setMeta("lastExport", ex);
}

export async function setLastPerson(fid, pid) {
  if (state.lastPerson[fid] === pid) return;
  state.lastPerson[fid] = pid;
  db.setMeta("lastPerson", state.lastPerson);
}

// ------------------------------------------------------------------ photos
const urlCache = new Map(); // photoId -> objectURL of the thumbnail
const fullUrlCache = new Map();

async function loadImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* fall back */ }
  }
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
function scaleTo(img, max, square) {
  const w = img.width, h = img.height;
  const c = document.createElement("canvas");
  if (square) {
    const s = Math.min(w, h), size = Math.min(max, s);
    c.width = c.height = size;
    c.getContext("2d").drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  } else {
    const k = Math.min(1, max / Math.max(w, h));
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  }
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
}

/** Stores a picked image (resized) and returns its id. */
export async function addPhoto(file, familyId) {
  const img = await loadImage(file);
  const full = await scaleTo(img, 1280, false);
  const thumb = await scaleTo(img, 240, true);
  const id = M.newPerson({ name: "x" }).id;
  await db.putPhoto({ id, familyId, full, thumb });
  return id;
}
export async function thumbURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const ph = await db.getPhoto(id);
  if (!ph) return null;
  const u = URL.createObjectURL(ph.thumb);
  urlCache.set(id, u);
  return u;
}
export async function fullURL(id) {
  if (fullUrlCache.has(id)) return fullUrlCache.get(id);
  const ph = await db.getPhoto(id);
  if (!ph) return null;
  const u = URL.createObjectURL(ph.full);
  fullUrlCache.set(id, u);
  return u;
}
export async function deletePhotos(ids) {
  if (!ids.length) return;
  for (const id of ids) {
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
    if (fullUrlCache.has(id)) { URL.revokeObjectURL(fullUrlCache.get(id)); fullUrlCache.delete(id); }
  }
  await db.deletePhotos(ids);
}
export { db };
