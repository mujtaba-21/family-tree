// Family data model: people, marriages (unions) and every rule about them.
// A family: {format, version, id, name, rootId, created, updated, seq, persons:{}, unions:{}}
// A person: {id, name, gender, nick, useNick, ancestors[], fam, birth, death, deceased,
//            photos[], mainPhoto, bio, note, blank}
// A union:  {id, h (husband id|null), w (wife id|null), kids[] (eldest first), order}
import { uid } from "./util.js";
import { cleanName, nameKey, rememberGender } from "./names.js";
import * as D from "./dates.js";

export const FORMAT = "shajara-family";
export const VERSION = 1;

// ------------------------------------------------------------------ creation
export function newPerson(data) {
  return {
    id: uid(),
    name: cleanName(data.name),
    gender: data.gender === "f" ? "f" : "m",
    nick: cleanName(data.nick || ""),
    useNick: !!data.useNick,
    ancestors: (data.ancestors || []).map(cleanName).filter(Boolean),
    fam: cleanName(data.fam || ""),
    birth: data.birth || null,
    death: data.death || null,
    deceased: !!data.deceased,
    photos: [],
    mainPhoto: null,
    bio: data.bio || "",
    note: data.note || "",
    blank: false,
  };
}

export function createFamily({ familyName, root }) {
  const r = newPerson(root);
  const now = Date.now();
  const f = {
    format: FORMAT, version: VERSION,
    id: uid(), name: cleanName(familyName) || (r.fam ? (r.fam.startsWith("آل") ? r.fam : "آل " + r.fam) : r.name),
    rootId: r.id, created: now, updated: now, seq: 0,
    persons: { [r.id]: r }, unions: {},
  };
  rememberGender(r.name, r.gender);
  touch(f);
  return f;
}

// ------------------------------------------------------------------ index (derived, cached per revision)
const cache = new WeakMap();
export function touch(f) { f._rev = (f._rev || 0) + 1; f.updated = Date.now(); }

export function index(f) {
  const c = cache.get(f);
  if (c && c.rev === f._rev) return c.I;
  const unionsOf = new Map(), parentUnion = new Map();
  const unions = Object.values(f.unions).sort((a, b) => a.order - b.order);
  for (const u of unions) {
    for (const pid of [u.h, u.w]) if (pid) { if (!unionsOf.has(pid)) unionsOf.set(pid, []); unionsOf.get(pid).push(u); }
    for (const k of u.kids) parentUnion.set(k, u);
  }
  const isDesc = new Set([f.rootId]);
  const gen = new Map([[f.rootId, 0]]);
  const queue = [f.rootId];
  while (queue.length) {
    const p = queue.shift();
    for (const u of unionsOf.get(p) || []) {
      for (const k of u.kids) if (!isDesc.has(k)) { isDesc.add(k); gen.set(k, gen.get(p) + 1); queue.push(k); }
    }
  }
  const I = { unionsOf, parentUnion, isDesc, gen, unions };
  cache.set(f, { rev: f._rev, I });
  return I;
}

export const person = (f, id) => (id ? f.persons[id] : null);
export const isRoot = (f, id) => id === f.rootId;
export const isDesc = (f, id) => index(f).isDesc.has(id);
export const genOf = (f, id) => index(f).gen.get(id);
export const parentUnion = (f, id) => index(f).parentUnion.get(id) || null;
export const unionsOf = (f, id) => index(f).unionsOf.get(id) || [];

/** The family member under whom a union's children are drawn (patrilineal when the husband is of the family). */
export function hostOf(f, u) {
  const I = index(f);
  if (u.h && I.isDesc.has(u.h)) return u.h;
  if (u.w && I.isDesc.has(u.w)) return u.w;
  return u.h || u.w;
}
export const spouseIn = (u, pid) => (u.h === pid ? u.w : u.h);
export const hostedUnions = (f, pid) => unionsOf(f, pid).filter((u) => hostOf(f, u) === pid);
export const isCousinUnion = (f, u) => !!(u.h && u.w && isDesc(f, u.h) && isDesc(f, u.w));

export function father(f, id) { const u = parentUnion(f, id); return u && u.h ? f.persons[u.h] : null; }
export function mother(f, id) { const u = parentUnion(f, id); return u && u.w ? f.persons[u.w] : null; }

/** Siblings through the parent the children are drawn under (includes half-siblings on that side), eldest first. */
export function siblings(f, id) {
  const pu = parentUnion(f, id);
  if (!pu) return [];
  const hp = hostOf(f, pu);
  const out = [];
  for (const u of hostedUnions(f, hp)) for (const k of u.kids) out.push(k);
  return out;
}

export function kind(f, id) {
  const p = f.persons[id];
  if (!p) return null;
  if (p.blank) return "blank";
  if (id === f.rootId) return "root";
  return isDesc(f, id) ? "desc" : "spouse";
}

// ------------------------------------------------------------------ names
/** Paternal chain: [name, father, grandfather, ...] plus the family name at the end of the chain. */
export function lineage(f, id) {
  const names = [];
  let fam = "";
  const seen = new Set();
  let cur = f.persons[id];
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    names.push(cur.blank ? "…" : cur.name);
    const u = parentUnion(f, cur.id);
    const fa = u && u.h ? f.persons[u.h] : null;
    if (!fa) {
      names.push(...(cur.ancestors || []));
      fam = cur.fam || "";
      break;
    }
    cur = fa;
  }
  return { names, fam };
}
export function fullName(f, id) {
  const { names, fam } = lineage(f, id);
  return [...names, fam].filter(Boolean).join(" ");
}
/** Name, father, grandfather, family name (as many as exist). */
export function quadName(f, id) {
  const { names, fam } = lineage(f, id);
  return [...names.slice(0, 3), fam].filter(Boolean).join(" ");
}
/** Short label used on chips and in the tree. */
export function shortName(f, id) {
  const p = f.persons[id];
  if (!p || p.blank) return "";
  const base = p.useNick && p.nick ? p.nick : p.name;
  if (id === f.rootId || !isDesc(f, id)) {
    const last = p.fam || (p.ancestors && p.ancestors.length ? p.ancestors[p.ancestors.length - 1] : "");
    return last ? `${base} ${last}` : base;
  }
  return base;
}
/** Big name on the card. */
export function headName(f, id) {
  const p = f.persons[id];
  if (!p || p.blank) return "";
  return p.useNick && p.nick ? p.nick : p.name;
}
/** Name + father, used to identify a cousin spouse in the tree ("فاطمة يزيد"). */
export function nameWithFather(f, id) {
  const { names } = lineage(f, id);
  return names.slice(0, 2).filter((n) => n && n !== "…").join(" ");
}

// ------------------------------------------------------------------ search
export function search(f, q, { exclude } = {}) {
  const key = nameKey(q);
  if (!key) return [];
  const I = index(f);
  const out = [];
  for (const p of Object.values(f.persons)) {
    if (p.blank || (exclude && exclude.has(p.id))) continue;
    const { names, fam } = lineage(f, p.id);
    const chain = [...names.filter((n) => n !== "…"), fam].map(nameKey).join("");
    const nick = nameKey(p.nick);
    let score = -1;
    if (nameKey(p.name) === key || (nick && nick === key)) score = 3;
    else if (chain.startsWith(key)) score = 2;
    else if (nick && nick.startsWith(key)) score = 1;
    if (score < 0) continue;
    out.push({ id: p.id, score, gen: I.isDesc.has(p.id) ? I.gen.get(p.id) : 99 });
  }
  out.sort((a, b) => b.score - a.score || a.gen - b.gen);
  return out.map((r) => r.id);
}

// ------------------------------------------------------------------ marriages and children
function nextOrder(f) { f.seq = (f.seq || 0) + 1; return f.seq; }

/** The union that holds a person's children whose other parent is not known yet (created if needed). */
export function unknownSpouseUnion(f, pid, create = true) {
  const p = f.persons[pid];
  const found = unionsOf(f, pid).find((u) => (p.gender === "m" ? u.h === pid && !u.w : u.w === pid && !u.h));
  if (found || !create) return found || null;
  const u = { id: uid(), h: p.gender === "m" ? pid : null, w: p.gender === "m" ? null : pid, kids: [], order: nextOrder(f) };
  f.unions[u.id] = u;
  touch(f);
  return u;
}

/** rows: [{name, gender}] in birth order (eldest first). Returns the new person ids. */
export function addChildren(f, unionId, rows) {
  const u = f.unions[unionId];
  const ids = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const p = newPerson({ name, gender: r.gender });
    f.persons[p.id] = p;
    u.kids.push(p.id);
    rememberGender(name, p.gender);
    ids.push(p.id);
  }
  touch(f);
  return ids;
}

/**
 * spouse: {existingId} or new person data {name, gender, ancestors, fam}.
 * assignKids: ids of this person's children with an unknown other parent that belong to this marriage.
 */
export function addSpouse(f, pid, spouse, assignKids = []) {
  const p = f.persons[pid];
  let sid;
  if (spouse.existingId) sid = spouse.existingId;
  else {
    const s = newPerson(spouse);
    f.persons[s.id] = s;
    rememberGender(s.name, s.gender);
    sid = s.id;
  }
  const s = f.persons[sid];
  let h = pid, w = sid;
  if (p.gender === "f" && s.gender === "m") { h = sid; w = pid; }
  const u = { id: uid(), h, w, kids: [], order: nextOrder(f) };
  f.unions[u.id] = u;
  if (assignKids.length) {
    const unk = unknownSpouseUnion(f, pid, false);
    if (unk) {
      const move = unk.kids.filter((k) => assignKids.includes(k));
      unk.kids = unk.kids.filter((k) => !move.includes(k));
      u.kids.push(...move);
      if (!unk.kids.length) delete f.unions[unk.id];
    }
  }
  touch(f);
  return u;
}

/** Remove a marriage that has no children (to correct a wrong entry). */
export function removeUnion(f, unionId) {
  const u = f.unions[unionId];
  if (!u || u.kids.length) return false;
  delete f.unions[unionId];
  touch(f);
  // a spouse from outside the family with no other link has nothing left to show
  for (const pid of [u.h, u.w]) {
    if (pid && !isDesc(f, pid) && unionsOf(f, pid).length === 0) delete f.persons[pid];
  }
  touch(f);
  return true;
}

export function moveChild(f, unionId, kidId, delta) {
  const u = f.unions[unionId];
  const i = u.kids.indexOf(kidId), j = i + delta;
  if (i < 0 || j < 0 || j >= u.kids.length) return;
  [u.kids[i], u.kids[j]] = [u.kids[j], u.kids[i]];
  touch(f);
}

/** After a birth date is entered or changed, move the person among dated siblings (undated stay put). */
export function repositionByBirth(f, id) {
  const u = parentUnion(f, id);
  const p = f.persons[id];
  if (!u || !p.birth) return;
  const list = u.kids.filter((k) => k !== id);
  const orig = u.kids.indexOf(id);
  let lastEarlier = -1, firstLater = -1;
  list.forEach((k, i) => {
    const b = f.persons[k].birth;
    if (!b) return;
    const c = D.compare(b, p.birth);
    if (c === -1) lastEarlier = i;
    else if (c === 1 && firstLater === -1) firstLater = i;
  });
  // current position is consistent: everyone certainly older is before, everyone certainly younger after
  const posInList = orig; // index it would take in `list` if reinserted where it is
  const consistent = (lastEarlier === -1 || lastEarlier < posInList) && (firstLater === -1 || firstLater >= posInList);
  if (consistent) return;
  let at;
  if (firstLater !== -1 && firstLater > lastEarlier) at = firstLater;
  else if (lastEarlier !== -1) at = lastEarlier + 1;
  else return;
  list.splice(at, 0, id);
  u.kids = list;
  touch(f);
}

export function updatePerson(f, id, patch) {
  const p = f.persons[id];
  const genderChanged = patch.gender && patch.gender !== p.gender;
  for (const [k, v] of Object.entries(patch)) {
    if (k === "name" || k === "nick" || k === "fam") p[k] = cleanName(v);
    else if (k === "ancestors") p[k] = (v || []).map(cleanName).filter(Boolean);
    else p[k] = v;
  }
  if (patch.name || patch.gender) rememberGender(p.name, p.gender);
  if (genderChanged) {
    // keep husband/wife slots consistent with the corrected gender
    for (const u of unionsOf(f, id)) {
      if ((p.gender === "m" && u.w === id) || (p.gender === "f" && u.h === id)) [u.h, u.w] = [u.w, u.h];
    }
  }
  if ("death" in patch && patch.death && patch.death.y) p.deceased = true;
  touch(f);
}

// ------------------------------------------------------------------ deletion
/**
 * Plan what deleting a person does. Each person is deleted alone:
 * - a family member whose children hang under them leaves an empty slot, so the children stay connected;
 * - a parent from outside the family is removed and the children simply have no recorded parent on that side;
 * - a spouse from outside the family left with no link at all is removed with them.
 */
export function planDelete(f, id) {
  const p = f.persons[id];
  const plan = { id, blank: false, remove: [id], alsoRemoved: [], kidsKept: 0, notAllowed: null };
  const hosted = hostedUnions(f, id);
  const hostedKids = hosted.reduce((a, u) => a + u.kids.length, 0);
  const allKids = unionsOf(f, id).reduce((a, u) => a + u.kids.length, 0);
  plan.kidsKept = allKids;
  if (id === f.rootId && hostedKids === 0) {
    plan.notAllowed = "لا يمكن حذف الجد الجامع وحده. إن أردت البدء من جديد فاحذف العائلة من قائمة العائلات.";
    return plan;
  }
  if (p.blank && hostedKids > 0) {
    plan.notAllowed = "هذه خانة فارغة تحفظ اتصال الأبناء بأجدادهم، ولا تُحذف ما دام تحتها أبناء.";
    return plan;
  }
  if (hostedKids > 0) { plan.blank = true; plan.remove = []; }
  // spouses from outside the family that would be left without any link
  for (const u of unionsOf(f, id)) {
    const other = spouseIn(u, id);
    if (!other || isDesc(f, other)) continue;
    const otherUnions = unionsOf(f, other).filter((x) => x.id !== u.id);
    const keepsLink = otherUnions.length > 0 || u.kids.length > 0;
    if (!keepsLink) plan.alsoRemoved.push(other);
  }
  return plan;
}

/** Applies a plan; returns photo ids that should be removed from storage. */
export function applyDelete(f, plan) {
  const photos = [];
  const p = f.persons[plan.id];
  const clearPerson = (q) => { photos.push(...(q.photos || [])); };
  if (plan.blank) {
    clearPerson(p);
    const keep = { id: p.id, gender: p.gender, fam: p.id === f.rootId ? p.fam : "" };
    Object.assign(p, newPerson({ name: "", gender: keep.gender, fam: keep.fam }), { id: keep.id, blank: true });
  }
  for (const rid of [...plan.remove, ...plan.alsoRemoved]) {
    const q = f.persons[rid];
    if (!q) continue;
    clearPerson(q);
    for (const u of Object.values(f.unions)) {
      u.kids = u.kids.filter((k) => k !== rid);
      if (u.h === rid) u.h = null;
      if (u.w === rid) u.w = null;
    }
    delete f.persons[rid];
  }
  // drop marriages that no longer hold anything
  for (const u of Object.values(f.unions)) {
    const hasH = u.h && f.persons[u.h], hasW = u.w && f.persons[u.w];
    if (!u.kids.length && (!hasH || !hasW)) delete f.unions[u.id];
  }
  touch(f);
  return photos;
}

// ------------------------------------------------------------------ copy
/** Deep copy with new ids. Returns {family, photoMap: oldPhotoId -> newPhotoId}. */
export function copyFamily(f, newName) {
  const pid = new Map(), photoMap = new Map();
  for (const id of Object.keys(f.persons)) pid.set(id, uid());
  const persons = {};
  for (const p of Object.values(f.persons)) {
    const q = JSON.parse(JSON.stringify(p));
    q.id = pid.get(p.id);
    q.photos = (p.photos || []).map((ph) => { const n = uid(); photoMap.set(ph, n); return n; });
    q.mainPhoto = p.mainPhoto ? photoMap.get(p.mainPhoto) : null;
    persons[q.id] = q;
  }
  const unions = {};
  for (const u of Object.values(f.unions)) {
    const nu = { id: uid(), h: u.h ? pid.get(u.h) : null, w: u.w ? pid.get(u.w) : null, kids: u.kids.map((k) => pid.get(k)), order: u.order };
    unions[nu.id] = nu;
  }
  const now = Date.now();
  const family = {
    format: FORMAT, version: VERSION, id: uid(), name: newName, rootId: pid.get(f.rootId),
    created: now, updated: now, seq: f.seq || 0, persons, unions,
  };
  touch(family);
  return { family, photoMap };
}

// ------------------------------------------------------------------ statistics
/** All descendants (each counted once), with their relative generation (1 = children). */
export function descendants(f, id) {
  const level = new Map();
  let frontier = [id];
  let g = 0;
  while (frontier.length) {
    g++;
    const next = [];
    for (const pid of frontier) {
      for (const u of unionsOf(f, pid)) {
        for (const k of u.kids) if (!level.has(k) && k !== id) { level.set(k, g); next.push(k); }
      }
    }
    frontier = next;
  }
  const byGen = [];
  for (const lv of level.values()) byGen[lv] = (byGen[lv] || 0) + 1;
  return { ids: [...level.keys()], total: level.size, byGen };
}

/**
 * "رأى منهم": descendants born during the person's lifetime.
 * Returns null when it does not apply (alive, or death date unknown).
 * Partial and approximate dates are compared as ranges; unresolved cases are inferred from relatives
 * and whatever is left is reported as unknown (never counted, never silently dropped).
 */
export function seenDescendants(f, id) {
  const p = f.persons[id];
  if (!p || !p.death || !p.death.y) return null;
  const { ids } = descendants(f, id);
  const st = new Map(); // id -> 1 seen, -1 not seen, 0 unknown
  for (const d of ids) {
    const q = f.persons[d];
    let s = 0;
    if (q.birth && q.birth.y) {
      const c = D.compare(q.birth, p.death);
      s = c === -1 ? 1 : c === 1 ? -1 : 0;
    }
    if (s === 0 && q.death && q.death.y && D.compare(q.death, p.death) === -1) s = 1; // died before him
    st.set(d, s);
  }
  const bornAfterDeath = (pid) => {
    if (!pid) return false;
    if (st.has(pid)) return st.get(pid) === -1;
    const q = f.persons[pid];
    return !!(q && q.birth && q.birth.y && D.compare(q.birth, p.death) === 1);
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of ids) {
      if (st.get(d) !== 0) continue;
      // one of his/her own children was born in the ancestor's lifetime
      const kids = unionsOf(f, d).flatMap((u) => u.kids);
      if (kids.some((k) => st.get(k) === 1)) { st.set(d, 1); changed = true; continue; }
      // a parent was born after the ancestor's death
      const u = parentUnion(f, d);
      if (u && (bornAfterDeath(u.h) || bornAfterDeath(u.w))) { st.set(d, -1); changed = true; continue; }
      // birth order among full siblings
      if (u) {
        const i = u.kids.indexOf(d);
        if (u.kids.slice(i + 1).some((k) => st.get(k) === 1)) { st.set(d, 1); changed = true; continue; }
        if (u.kids.slice(0, i).some((k) => st.get(k) === -1)) { st.set(d, -1); changed = true; continue; }
      }
    }
  }
  let seen = 0, unknown = 0, notSeen = 0;
  const unknownIds = [];
  for (const [d, s] of st) {
    if (s === 1) seen++;
    else if (s === -1) notSeen++;
    else { unknown++; unknownIds.push(d); }
  }
  return { seen, unknown, notSeen, unknownIds };
}

// ------------------------------------------------------------------ serialisation
export function toJSON(f) {
  const { _rev, ...rest } = f;
  return rest;
}
/** Validates an imported object; returns an Arabic error message or null. */
export function validateImport(obj) {
  if (!obj || obj.format !== FORMAT) return "هذا الملف ليس نسخة من بيانات شجرة العائلة.";
  if (typeof obj.version !== "number" || obj.version > VERSION) return "هذا الملف من إصدار أحدث من التطبيق. حدّث التطبيق ثم أعد المحاولة.";
  if (!obj.persons || !obj.unions || !obj.rootId || !obj.persons[obj.rootId]) return "الملف ناقص أو تالف.";
  for (const u of Object.values(obj.unions)) {
    for (const pid of [u.h, u.w, ...(u.kids || [])]) if (pid && !obj.persons[pid]) return "الملف ناقص أو تالف.";
  }
  return null;
}
