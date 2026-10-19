// Entry point: routing between screens.
import * as store from "./store.js";
import * as nav from "./nav.js";
import * as M from "./model.js";
import { closeAllOverlays, toast } from "./ui/kit.js";
import { initPlatform, isNative } from "./platform.js";
import { applyTheme } from "./theme.js";
import { familiesScreen } from "./ui/families.js";
import { newFamilyScreen } from "./ui/newFamily.js";
import { personScreen } from "./ui/person.js";
import { addKidsScreen } from "./ui/addKids.js";
import { addSpouseScreen } from "./ui/addSpouse.js";
import { editScreen } from "./ui/edit.js";
import { searchScreen } from "./ui/search.js";
import { settingsScreen } from "./ui/settings.js";
import { treeScreen } from "./ui/tree.js";
import { fontsReady } from "./tree/measure.js";

const app = document.getElementById("app");
let renderSeq = 0;

async function withFamily(fid, fn) {
  const f = await store.openFamily(fid);
  if (!f) { toast("لم تُعثر على هذه العائلة"); nav.redirect("#/"); return null; }
  return fn(f);
}

const card = (fid, pid) => `#/f/${fid}/p/${pid}`;

const routes = [
  [/^#?\/?$/, () => familiesScreen(rerender)],
  [/^#\/new$/, () => newFamilyScreen()],
  [/^#\/settings$/, () => settingsScreen()],
  [/^#\/f\/([^/]+)$/, (fid) => withFamily(fid, (f) => {
    const last = store.state.lastPerson[fid];
    nav.redirect(card(fid, last && f.persons[last] ? last : f.rootId));
    return null;
  })],
  [/^#\/f\/([^/]+)\/search$/, (fid) => withFamily(fid, (f) => searchScreen(f))],
  [/^#\/f\/([^/]+)\/tree(?:\/([^/]+))?$/, (fid, pid) => withFamily(fid, (f) => treeScreen(f, pid))],
  [/^#\/f\/([^/]+)\/p\/([^/]+)(?:\/(edit|spouse|kids)(?:\/([^/]+))?)?$/, (fid, pid, sub, arg) => withFamily(fid, (f) => {
    if (!f.persons[pid]) { nav.redirect(card(fid, f.rootId)); return null; }
    if (sub === "edit") return editScreen(f, pid);
    if (sub === "spouse") return addSpouseScreen(f, pid);
    if (sub === "kids") {
      if (arg !== "new" && !f.unions[arg]) { nav.redirect(card(fid, pid)); return null; }
      return addKidsScreen(f, pid, arg);
    }
    return personScreen(f, pid, rerender);
  })],
];

/** Where Back climbs to from a screen (see nav.js). */
function upOf(hash) {
  let m;
  if ((m = hash.match(/^#\/f\/([^/]+)\/p\/([^/]+)\/(?:edit|spouse|kids)/))) return card(m[1], m[2]);
  if ((m = hash.match(/^#\/f\/([^/]+)\/tree\/([^/]+)$/))) return card(m[1], m[2]);
  if ((m = hash.match(/^#\/f\/([^/]+)\/(?:tree|search)$/))) return `#/f/${m[1]}`;
  if ((m = hash.match(/^#\/f\/([^/]+)\/p\/([^/]+)$/))) {
    const f = store.state.family;
    const [, fid, pid] = m;
    if (!f || f.id !== fid || !f.persons[pid] || pid === f.rootId) return "#/";
    if (M.kind(f, pid) === "spouse") {
      const partner = M.unionsOf(f, pid).map((u) => M.spouseIn(u, pid)).find((id) => id && M.isDesc(f, id));
      return card(fid, partner || f.rootId);
    }
    const pu = M.parentUnion(f, pid);
    return card(fid, pu ? M.hostOf(f, pu) : f.rootId);
  }
  return "#/";
}

async function render(hash = nav.currentHash(), { keepScroll = false } = {}) {
  const seq = ++renderSeq;
  const y = window.scrollY;
  closeAllOverlays();
  for (const [re, handler] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    let node;
    try { node = await handler(...m.slice(1).map((x) => (x ? decodeURIComponent(x) : x))); }
    catch (e) { console.error(e); toast("حدث خطأ غير متوقع"); node = null; }
    if (seq !== renderSeq || !node) return;
    app.replaceChildren(node);
    window.scrollTo(0, keepScroll ? y : 0);
    return;
  }
  nav.redirect("#/");
}
/** Redraws the current screen after a change made on it, staying where the reader was. */
function rerender() { return render(nav.currentHash(), { keepScroll: true }); }

async function boot() {
  applyTheme();
  await store.init();
  applyTheme();
  await fontsReady();
  initPlatform();
  await nav.start({ render, up: upOf });
  document.body.classList.add("ready");
  if (!isNative() && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
