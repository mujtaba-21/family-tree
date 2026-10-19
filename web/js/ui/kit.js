// Reusable UI pieces: app bar, sheets, dialogs, menus, toasts, help popovers.
import { h, icon } from "../util.js";
import { HELP } from "./help.js";

// Set by nav.js: where links and the back arrow go (kept here to avoid a circular import).
let linkHandler = (href) => { location.hash = href; };
let backHandler = () => history.back();
export function setLinkHandler(fn) { linkHandler = fn; }
export function setBackHandler(fn) { backHandler = fn; }

export function appBar({ title, big, back, actions = [], extra }) {
  return h("header", { class: "appbar" },
    back ? h("button", { class: "ib", "aria-label": "رجوع", onclick: back === true ? () => backHandler() : back }, icon("back")) : null,
    big ? h("h1", null, title) : h("h2", null, title),
    extra || null,
    ...actions.map((a) => h("button", { class: "ib solid", "aria-label": a.label, title: a.label, onclick: a.onclick, dataset: a.data || {} }, icon(a.icon))),
  );
}

export function screen(...children) {
  return h("div", { class: "screen" }, ...children);
}

// ---------------------------------------------------------------- overlays
const layer = () => document.body;
let openOverlays = [];
let ignorePops = 0;
const pendingBack = []; // resolvers waiting for our own history.back() to finish

/**
 * Called by nav.js on every popstate. One back press closes the topmost overlay (sheet, dialog,
 * menu) instead of leaving the screen. Returns true when the event belonged to an overlay.
 */
export function handlePop() {
  if (ignorePops > 0) { ignorePops--; const r = pendingBack.shift(); if (r) r(); return true; }
  const top = openOverlays[openOverlays.length - 1];
  if (top) { close(top, true); return true; }
  return false;
}

function addOverlay(nodes, onClose) {
  const entry = { nodes, onClose };
  openOverlays.push(entry);
  for (const n of nodes) layer().appendChild(n);
  history.pushState({ overlay: true }, "");
  return entry;
}
/** Closes an overlay; the returned promise resolves once the history entry is gone (safe to navigate). */
function close(entry, fromPop) {
  if (!openOverlays.includes(entry)) return Promise.resolve();
  openOverlays = openOverlays.filter((e) => e !== entry);
  for (const n of entry.nodes) n.remove();
  let done = Promise.resolve();
  if (!fromPop) {
    ignorePops++;
    done = new Promise((res) => { pendingBack.push(res); setTimeout(res, 600); });
    history.back();
  }
  entry.onClose && entry.onClose(fromPop);
  return done;
}
/** Closes every open overlay properly (history included); resolves when done. */
export async function closeOverlays() {
  while (openOverlays.length) await close(openOverlays[openOverlays.length - 1], false);
}
export function closeAllOverlays() {
  for (const e of [...openOverlays]) {
    openOverlays = openOverlays.filter((x) => x !== e);
    for (const n of e.nodes) n.remove();
  }
}
export const hasOverlay = () => openOverlays.length > 0;

/** Bottom sheet. content: Node | (close) => Node */
export function sheet(content, { onClose, light = false, cls = "" } = {}) {
  // light: the page behind stays visible (no dimming), e.g. to watch the tree change while choosing
  const scrim = h("div", { class: "scrim" + (light ? " light" : "") });
  const box = h("div", { class: "sheet" + (cls ? " " + cls : ""), role: "dialog" }, h("div", { class: "grab" }));
  const entry = addOverlay([scrim, box], onClose);
  const done = () => close(entry, false);
  box.appendChild(typeof content === "function" ? content(done) : content);
  // links inside a sheet: close it first, then navigate
  box.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href^='#']");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    done().then(() => linkHandler(href));
  });
  scrim.addEventListener("click", done);
  return done;
}

/** Centered dialog with buttons. Resolves with the chosen value (or null when dismissed). */
export function dialog({ title, text, warn, body, buttons }) {
  return new Promise((resolve) => {
    let settled = false;
    const scrim = h("div", { class: "scrim" });
    const box = h("div", { class: "dialog", role: "alertdialog" });
    const entry = addOverlay([scrim, box], (fromPop) => { if (fromPop && !settled) { settled = true; resolve(null); } });
    const done = (v) => { if (settled) return; settled = true; close(entry, false).then(() => resolve(v)); };
    const row = buttons.length > 2
      ? h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" } }, ...buttons.map((b) => h("button", { class: "btn " + (b.cls || "plain"), onclick: () => done(b.value) }, b.label)))
      : h("div", { class: "btn-row" }, ...buttons.map((b) => h("button", { class: "btn " + (b.cls || "plain"), onclick: () => done(b.value) }, b.label)));
    for (const n of [h("h3", null, title), text ? h("p", null, text) : null, body || null, warn ? h("p", { class: "warn" }, warn) : null, row]) if (n) box.appendChild(n);
    scrim.addEventListener("click", () => done(null));
  });
}

export function confirm({ title, text, warn, ok = "موافق", cancel = "إلغاء", danger }) {
  return dialog({ title, text, warn, buttons: [{ label: ok, value: true, cls: danger ? "danger" : "primary" }, { label: cancel, value: false, cls: "plain" }] });
}

export function alertMsg(title, text) {
  return dialog({ title, text, buttons: [{ label: "حسنًا", value: true, cls: "primary" }] });
}

/** Text prompt dialog. */
export function prompt({ title, text, value = "", placeholder = "", ok = "حفظ" }) {
  const input = h("input", { class: "inp", value, placeholder, maxlength: 60 });
  setTimeout(() => { input.focus(); input.select(); }, 60);
  return dialog({ title, text, body: input, buttons: [{ label: ok, value: "ok", cls: "primary" }, { label: "إلغاء", value: null }] })
    .then((v) => (v === "ok" ? input.value.trim() : null));
}

/** Small menu anchored to a button. items: [{label, icon, onclick, danger, sep}] */
export function menu(anchor, items) {
  const scrim = h("div", { class: "scrim", style: { background: "transparent" } });
  const box = h("div", { class: "menu", role: "menu" });
  const entry = addOverlay([scrim, box]);
  const done = () => close(entry, false);
  for (const it of items) {
    if (it.sep) { box.appendChild(h("hr")); continue; }
    box.appendChild(h("button", { class: it.danger ? "d" : "", onclick: () => { done().then(() => it.onclick()); } }, it.icon ? icon(it.icon) : null, it.label));
  }
  const r = anchor.getBoundingClientRect();
  const w = 220;
  box.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, r.left)) + "px";
  const below = r.bottom + 6;
  box.style.top = below + "px";
  requestAnimationFrame(() => {
    const bh = box.offsetHeight;
    if (below + bh > window.innerHeight - 10) box.style.top = Math.max(10, r.top - bh - 6) + "px";
  });
  scrim.addEventListener("click", done);
}

let toastTimer = null;
export function toast(text, ms = 2200) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = h("div", { class: "toast", role: "status" }, text);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function busy(text) {
  const b = h("div", { class: "busy" }, h("div", null, h("div", { class: "spin" }), text));
  document.body.appendChild(b);
  return { set: (t) => { b.lastChild.lastChild.textContent = t; }, done: () => b.remove() };
}

/** "؟" button that explains a control in plain Arabic. */
export function help(key) {
  const btn = h("button", { class: "help", type: "button", "aria-label": "شرح" }, "؟");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = HELP[key] || key;
    const scrim = h("div", { class: "scrim", style: { background: "transparent" } });
    const pop = h("div", { class: "pop", role: "tooltip" }, text);
    const entry = addOverlay([scrim, pop]);
    const r = btn.getBoundingClientRect();
    const w = Math.min(window.innerWidth * 0.84, 320);
    pop.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, r.left + r.width / 2 - w / 2)) + "px";
    pop.style.top = r.bottom + 8 + "px";
    requestAnimationFrame(() => {
      if (r.bottom + 8 + pop.offsetHeight > window.innerHeight - 10) pop.style.top = Math.max(10, r.top - pop.offsetHeight - 8) + "px";
    });
    const done = () => close(entry, false);
    scrim.addEventListener("click", done);
    pop.addEventListener("click", done);
  });
  return btn;
}

/** Field wrapper with a label and optional help. */
export function field(label, control, { helpKey, error } = {}) {
  return h("div", { class: "field" },
    h("div", { class: "lbl" }, label, helpKey ? help(helpKey) : null),
    control,
    error ? h("div", { class: "err-t" }, error) : null,
  );
}

export function segmented(options, value, onchange, { cls = "seg" } = {}) {
  const wrap = h("div", { class: cls, role: "radiogroup" });
  const render = (v) => {
    wrap.replaceChildren(...options.map((o) => h("button", {
      type: "button", role: "radio", "aria-checked": String(o.value === v),
      class: (o.value === v ? "on " : "") + (o.cls || ""),
      onclick: () => { render(o.value); onchange(o.value); },
    }, o.label)));
  };
  render(value);
  wrap.setValue = render;
  return wrap;
}

export function toggle(on, onchange) {
  const t = h("button", { class: "sw" + (on ? " on" : ""), type: "button", role: "switch", "aria-checked": String(!!on) });
  t.addEventListener("click", () => {
    on = !on;
    t.classList.toggle("on", on);
    t.setAttribute("aria-checked", String(on));
    onchange(on);
  });
  t.setOn = (v) => { on = v; t.classList.toggle("on", v); t.setAttribute("aria-checked", String(v)); };
  return t;
}

export function checkbox(label, on, onchange) {
  const i = h("i", { class: on ? "on" : "" });
  const b = h("button", { class: "check", type: "button", role: "checkbox", "aria-checked": String(!!on) }, i, label);
  b.addEventListener("click", () => { on = !on; i.className = on ? "on" : ""; b.setAttribute("aria-checked", String(on)); onchange(on); });
  return b;
}
