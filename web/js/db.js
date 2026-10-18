// IndexedDB storage. Everything stays on the device.
const DB_NAME = "shajara";
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("families")) d.createObjectStore("families", { keyPath: "id" });
      if (!d.objectStoreNames.contains("photos")) {
        const s = d.createObjectStore("photos", { keyPath: "id" });
        s.createIndex("family", "familyId");
      }
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
}

// ---- families
export function listFamilies() { return tx("families", "readonly", (s) => reqP(s.getAll())); }
export function getFamily(id) { return tx("families", "readonly", (s) => reqP(s.get(id))); }
export function putFamily(f) { return tx("families", "readwrite", (s) => { s.put(f); }); }
export async function deleteFamily(id) {
  const photos = await listPhotoIds(id);
  await tx("photos", "readwrite", (s) => { for (const pid of photos) s.delete(pid); });
  await tx("families", "readwrite", (s) => { s.delete(id); });
}

// ---- photos  {id, familyId, full: Blob, thumb: Blob}
export function getPhoto(id) { return tx("photos", "readonly", (s) => reqP(s.get(id))); }
export function putPhoto(p) { return tx("photos", "readwrite", (s) => { s.put(p); }); }
export function deletePhotos(ids) { return tx("photos", "readwrite", (s) => { for (const id of ids) s.delete(id); }); }
export function listPhotoIds(familyId) {
  return tx("photos", "readonly", (s) => reqP(s.index("family").getAllKeys(familyId)));
}

// ---- meta (settings, gender memory, export dates)
export async function getMeta(key) {
  const r = await tx("meta", "readonly", (s) => reqP(s.get(key)));
  return r ? r.value : undefined;
}
export function setMeta(key, value) { return tx("meta", "readwrite", (s) => { s.put({ key, value }); }); }
