// Navigation: every screen change and every Back press goes through here.
//
// The browser history is kept at most two entries deep: the family list, and the current screen on
// top of it. So Back from any screen comes back here first, and Back on the family list leaves the app.
//
// Where Back goes:
//  - the first press returns to the previous screen;
//  - pressing again climbs the family: a card -> the parent's card -> ... -> the common ancestor ->
//    the family list, instead of replaying every screen visited before.
import { handlePop, setLinkHandler, setBackHandler, hasOverlay, closeOverlays } from "./ui/kit.js";

export const HOME = "#/";
const norm = (hash) => (!hash || hash === "#" ? HOME : hash);

let current = HOME;
let trail = [];          // screens visited before the current one (most recent last)
let backs = 0;           // Back presses in a row
let depth = 1;           // our entries in the browser history: 1 = family list only, 2 = list + screen
let expectPop = 0;       // history.back() calls we made ourselves
let renderFn = () => {};
let upOf = () => HOME;
let leaveHooks = [];

export const currentHash = () => current;

/** Runs once the current screen is left (any navigation). */
export function onLeave(fn) { leaveHooks.push(fn); }

function show(hash) {
  const hooks = leaveHooks;
  leaveHooks = [];
  for (const fn of hooks) { try { fn(); } catch (e) { console.error(e); } }
  current = hash;
  renderFn(hash);
}

function setUrl(hash) {
  if (hash === HOME) {
    if (depth === 2) { expectPop++; depth = 1; history.back(); }
  } else if (depth === 1) { history.pushState({ nav: 2 }, "", hash); depth = 2; }
  else history.replaceState({ nav: 2 }, "", hash);
}

/** Opens a screen. replace: the current screen is not kept as "previous" (e.g. a finished form). */
export function go(hash, { replace = false } = {}) {
  if (hasOverlay()) { closeOverlays().then(() => go(hash, { replace })); return; }
  hash = norm(hash);
  backs = 0;
  if (!replace && hash !== current) {
    trail.push(current);
    if (trail.length > 60) trail.shift();
  }
  setUrl(hash);
  show(hash);
}

/** A form is finished: return to the screen it was opened from (fallback when unknown). */
export function finish(fallback) {
  if (hasOverlay()) { closeOverlays().then(() => finish(fallback)); return; }
  while (trail.length && trail[trail.length - 1] === current) trail.pop();
  const target = trail.length ? trail.pop() : norm(fallback);
  backs = 0;
  setUrl(target);
  show(target);
}

/** Same screen under another address (redirects inside the router). */
export function redirect(hash) {
  hash = norm(hash);
  setUrl(hash);
  current = hash;
  renderFn(hash);
}

function backTarget() {
  backs++;
  while (trail.length && trail[trail.length - 1] === current) trail.pop();
  if (backs === 1 && trail.length) return trail.pop();
  return upOf(current) || HOME;
}

/** Back (app bar arrow, Android back button). Returns false when already on the family list. */
export function back() {
  if (hasOverlay()) { closeOverlays(); return true; }
  if (current === HOME) return false;
  const target = backTarget();
  setUrl(target);
  show(target);
  return true;
}

function onPop() {
  if (handlePop()) return;                       // an overlay (sheet, menu, dialog) was closed
  if (expectPop > 0) { expectPop--; return; }    // our own step back to the family list
  const st = history.state;
  if (st && st.nav === 1 && depth === 2) {       // Back pressed on a screen: decide where it goes
    depth = 1;
    const target = backTarget();
    if (target !== HOME) { history.pushState({ nav: 2 }, "", target); depth = 2; }
    show(target);
    return;
  }
  // forward button or older entries: show what the address says
  depth = st && st.nav === 2 ? 2 : 1;
  show(norm(location.hash));
}

function onHashChange() {
  // only reached when something changed the address directly
  const hash = norm(location.hash);
  if (hash === current) return;
  trail.push(current);
  backs = 0;
  depth = hash === HOME ? 1 : 2;
  history.replaceState({ nav: depth }, "", hash);
  show(hash);
}

function onLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest("a[href^='#']");
  if (!a || a.closest(".sheet, .menu, .dialog, .pop")) return; // overlays close first, then navigate
  e.preventDefault();
  go(a.getAttribute("href"));
}

/** render(hash) draws a screen; up(hash) is where Back climbs to from a screen. */
export function start({ render, up }) {
  renderFn = render;
  upOf = up;
  const first = norm(location.hash);
  history.replaceState({ nav: 1 }, "", HOME);
  depth = 1;
  if (first !== HOME) { history.pushState({ nav: 2 }, "", first); depth = 2; }
  current = first;
  window.addEventListener("popstate", onPop);
  window.addEventListener("hashchange", onHashChange);
  document.addEventListener("click", onLinkClick);
  setLinkHandler((href) => go(href));
  setBackHandler(() => back());
  return renderFn(current);
}
