// Entry point: routing between screens.
import * as store from "./store.js";
import { closeAllOverlays, toast } from "./ui/kit.js";
import { initPlatform, isNative } from "./platform.js";
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

function goReplace(hash) {
  history.replaceState(null, "", hash);
  render();
}

async function withFamily(fid, fn) {
  const f = await store.openFamily(fid);
  if (!f) { toast("لم تُعثر على هذه العائلة"); goReplace("#/"); return null; }
  return fn(f);
}

const routes = [
  [/^#?\/?$/, () => familiesScreen(render)],
  [/^#\/new$/, () => newFamilyScreen()],
  [/^#\/settings$/, () => settingsScreen()],
  [/^#\/f\/([^/]+)$/, (fid) => withFamily(fid, (f) => {
    const last = store.state.lastPerson[fid];
    goReplace(`#/f/${fid}/p/${last && f.persons[last] ? last : f.rootId}`);
    return null;
  })],
  [/^#\/f\/([^/]+)\/search$/, (fid) => withFamily(fid, (f) => searchScreen(f))],
  [/^#\/f\/([^/]+)\/tree(?:\/([^/]+))?$/, (fid, pid) => withFamily(fid, (f) => treeScreen(f, pid))],
  [/^#\/f\/([^/]+)\/p\/([^/]+)(?:\/(edit|spouse|kids)(?:\/([^/]+))?)?$/, (fid, pid, sub, arg) => withFamily(fid, (f) => {
    if (!f.persons[pid]) { goReplace(`#/f/${fid}/p/${f.rootId}`); return null; }
    if (sub === "edit") return editScreen(f, pid);
    if (sub === "spouse") return addSpouseScreen(f, pid);
    if (sub === "kids") {
      if (arg !== "new" && !f.unions[arg]) { goReplace(`#/f/${fid}/p/${pid}`); return null; }
      return addKidsScreen(f, pid, arg);
    }
    return personScreen(f, pid, render);
  })],
];

async function render() {
  const seq = ++renderSeq;
  closeAllOverlays();
  const hash = location.hash || "#/";
  for (const [re, handler] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    let node;
    try { node = await handler(...m.slice(1).map((x) => (x ? decodeURIComponent(x) : x))); }
    catch (e) { console.error(e); toast("حدث خطأ غير متوقع"); node = null; }
    if (seq !== renderSeq || !node) return;
    app.replaceChildren(node);
    window.scrollTo(0, 0);
    return;
  }
  goReplace("#/");
}

async function boot() {
  await store.init();
  await fontsReady();
  initPlatform();
  window.addEventListener("hashchange", render);
  await render();
  document.body.classList.add("ready");
  if (!isNative() && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
