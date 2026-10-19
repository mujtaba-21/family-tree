// Screen: the family tree (pan/zoom), its design (layout, colours, what each box shows) and export.
// What is shown is exactly what gets exported: one set of options serves both.
import { h, icon, ar, todayISO } from "../util.js";
import { appBar, sheet, help, toggle, segmented, busy, toast, alertMsg } from "./kit.js";
import { layoutTree, DEFAULT_OPTS, LAYOUTS, DEATH_MARKS } from "../tree/layout.js";
import { THEMES, PLAIN, DECORATED } from "../tree/themes.js";
import { toSVG } from "../tree/render.js";
import { measure, fontsReady } from "../tree/measure.js";
import { treeToPDF } from "../export/pdf.js";
import { treeToPPTX } from "../export/pptx.js";
import { deliverFile } from "../platform.js";
import { exportBackup } from "../export/backup.js";
import { personHash, displayName } from "./common.js";
import { familySheet, spouseWord } from "./familySheet.js";
import * as nav from "../nav.js";
import * as store from "../store.js";
import * as M from "../model.js";

const PX_PER_MM = 96 / 25.4;
const PAPERS = [["A4", 210, 297], ["A3", 297, 420], ["A2", 420, 594], ["A1", 594, 841], ["A0", 841, 1189]];
export function paperFor(w, hh) {
  for (const [n, pw, ph] of PAPERS) if ((w <= pw && hh <= ph) || (w <= ph && hh <= pw)) return n;
  return null;
}
const cm = (mm) => ar((mm / 10).toFixed(1));

/** The tree options (shared by the view and the export), with defaults for anything new. */
function treeOpts() {
  const s = store.state.settings;
  const saved = s.export || {};
  const o = { ...DEFAULT_OPTS, ...saved, fields: { ...DEFAULT_OPTS.fields, ...(saved.fields || {}) }, calendar: s.calendar, format: saved.format || "pdf" };
  // «رحمه الله» used to be a switch among the box fields; it is now one of the death marks
  if (!DEATH_MARKS.includes(o.deathMark)) o.deathMark = saved.fields && saved.fields.rahma === false ? "none" : "rahma";
  delete o.fields.rahma;
  if (!LAYOUTS.includes(o.layout)) o.layout = DEFAULT_OPTS.layout;
  if (!THEMES[o.theme]) o.theme = DEFAULT_OPTS.theme;
  return o;
}
/** The title at the top of the tree: saved with the family, «شجرة آل …» unless changed, or none. */
export const defaultTitle = (f) => `شجرة ${f.name}`;
export const treeTitle = (f) => (f.hideTitle ? "" : (f.treeTitle || defaultTitle(f)).trim());
function saveTreeOpts(o) {
  const { calendar, title, ...rest } = o;
  store.state.settings.export = rest;
  store.saveSettings();
}

async function photoMaps(f, scene) {
  const ids = [...new Set(scene.boxes.map((b) => b.photo).filter(Boolean))];
  const urls = new Map(), bitmaps = new Map(), blobs = new Map();
  for (const id of ids) {
    const ph = await store.db.getPhoto(id);
    if (!ph) continue;
    urls.set(id, await store.thumbURL(id));
    blobs.set(id, ph.thumb);
    try { bitmaps.set(id, await createImageBitmap(ph.thumb)); } catch (e) { /* skip */ }
  }
  return { urls, bitmaps, blobs };
}

const LAYOUT_LABELS = [{ value: "balanced", label: "متوازن" }, { value: "vertical", label: "عمودي كامل" }, { value: "flex", label: "مرن" }];

/** A small picture of a design: its background, a male and a female box, and its name. */
function swatch(id, on, onPick) {
  const T = THEMES[id];
  const b = h("button", { class: "swatch" + (on ? " on" : ""), type: "button", "aria-pressed": String(on), "aria-label": T.name },
    h("span", { class: "sw-pic", style: { background: T.bg, borderColor: T.deco ? T.title || T.accent : T.line } },
      h("i", { style: { background: T.m.fill, borderColor: T.m.stroke } }),
      h("i", { class: "f", style: { background: T.f.fill, borderColor: T.f.stroke } }),
      T.deco ? h("b", { style: { borderColor: T.title || T.accent } }) : null),
    h("span", { class: "sw-name" }, T.name));
  b.addEventListener("click", onPick);
  return b;
}

export async function treeScreen(f, focusId) {
  await fontsReady();
  const opts = treeOpts();
  opts.title = treeTitle(f);
  let scene = null;
  let photos = { urls: new Map(), bitmaps: new Map(), blobs: new Map() };

  const viewport = h("div", { class: "viewport" });
  const stage = h("div", { class: "stage" });
  viewport.appendChild(stage);
  let tx = 0, ty = 0, zoom = 1;
  let svgW = 0, svgH = 0;
  let coveredBottom = 0; // height hidden under an open design sheet
  const apply = () => { stage.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`; };

  const draw = async (keepView) => {
    scene = layoutTree(f, opts, measure);
    if (opts.fields.photo) photos = await photoMaps(f, scene);
    stage.innerHTML = toSVG(scene, { photoURL: (id) => photos.urls.get(id), interactive: true });
    const svg = stage.firstChild;
    svgW = scene.bbox.w * PX_PER_MM; svgH = scene.bbox.h * PX_PER_MM;
    svg.setAttribute("width", svgW); svg.setAttribute("height", svgH);
    if (!keepView) centerOn(focusId);
  };
  const area = () => ({ vw: viewport.clientWidth || window.innerWidth, vh: Math.max(80, (viewport.clientHeight || window.innerHeight - 70) - coveredBottom) });
  const fit = () => {
    const { vw, vh } = area();
    zoom = Math.min(vw / svgW, vh / svgH) * 0.96;
    tx = (vw - svgW * zoom) / 2; ty = (vh - svgH * zoom) / 2;
    apply();
  };
  const centerOn = (pid) => {
    const { vw, vh } = area();
    const b = pid && scene.boxes.find((x) => x.pid === pid && x.style !== "ref" && x.style !== "sp");
    if (!b) { fit(); return; }
    zoom = 1;
    const cx = (b.x + b.w / 2 - scene.bbox.x) * PX_PER_MM, cy = (b.y + b.h / 2 - scene.bbox.y) * PX_PER_MM;
    tx = vw / 2 - cx * zoom; ty = vh / 3 - cy * zoom;
    apply();
  };
  const zoomAt = (factor, px, py) => {
    const nz = Math.max(0.05, Math.min(6, zoom * factor));
    const f2 = nz / zoom;
    tx = px - (px - tx) * f2; ty = py - (py - ty) * f2;
    zoom = nz;
    apply();
  };

  // ---- tapping a person: open the card, or add a spouse and children right from the tree
  function personActions(pid) {
    const p = f.persons[pid];
    if (!p) return;
    const k = M.kind(f, pid);
    const fem = p.gender === "f";
    const redraw = () => draw(true);
    sheet((close) => {
      const act = (label, fn, cls = "soft", ic = "plus") => h("button", { class: "btn " + cls, type: "button", onclick: async () => { await close(); fn(); } }, icon(ic), label);
      const items = [act("فتح البطاقة", () => nav.go(personHash(f, pid)), "primary", "person")];
      if (k !== "blank") {
        const unions = [...M.unionsOf(f, pid)].sort((a, b) => (M.spouseIn(a, pid) ? 0 : 1) - (M.spouseIn(b, pid) ? 0 : 1) || a.order - b.order);
        for (const u of unions) {
          const o = M.spouseIn(u, pid);
          const label = unions.length < 2 ? "إضافة أبناء"
            : o && f.persons[o] ? `إضافة أبناء من ${spouseWord(f, o, pid)}` : fem ? "أبناء لم يُسجَّل أبوهم" : "أبناء لم تُسجَّل أمهم";
          items.push(act(label, () => familySheet(f, pid, { unionId: u.id, onSaved: redraw })));
        }
        if (k !== "spouse") {
          const married = unions.some((u) => M.spouseIn(u, pid));
          items.push(act(married ? "زواج آخر" : fem ? "زوج وأبناء" : "زوجة وأبناء", () => familySheet(f, pid, { onSaved: redraw })));
        }
      }
      return h("div", { class: "acts" },
        h("div", null, h("h3", null, k === "blank" ? "خانة فارغة" : displayName(f, pid)),
          k !== "blank" ? h("div", { class: "acts-sub" }, M.fullName(f, pid)) : null),
        ...items);
    });
  }

  // ---- gestures: drag to move, pinch or buttons to zoom, tap a name for its actions
  const pointers = new Map();
  let start = null, moved = false, lastTap = 0;
  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".zoombar")) return; // let the zoom buttons work normally
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    start = { tx, ty, zoom, pts: [...pointers.values()].map((p) => ({ ...p })) };
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !start) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    const r = viewport.getBoundingClientRect();
    if (pts.length === 1 && start.pts.length === 1) {
      const dx = pts[0].x - start.pts[0].x, dy = pts[0].y - start.pts[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      tx = start.tx + dx; ty = start.ty + dy; apply();
    } else if (pts.length >= 2) {
      moved = true;
      if (start.pts.length < 2) start = { tx, ty, zoom, pts: pts.map((p) => ({ ...p })) };
      const d0 = Math.hypot(start.pts[0].x - start.pts[1].x, start.pts[0].y - start.pts[1].y) || 1;
      const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const m0 = { x: (start.pts[0].x + start.pts[1].x) / 2 - r.left, y: (start.pts[0].y + start.pts[1].y) / 2 - r.top };
      const m1 = { x: (pts[0].x + pts[1].x) / 2 - r.left, y: (pts[0].y + pts[1].y) / 2 - r.top };
      const nz = Math.max(0.05, Math.min(6, start.zoom * (d1 / d0)));
      tx = m1.x - (m0.x - start.tx) * (nz / start.zoom);
      ty = m1.y - (m0.y - start.ty) * (nz / start.zoom);
      zoom = nz; apply();
    }
  });
  const end = (e) => {
    const wasSingle = start && start.pts.length === 1 && pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size) { start = { tx, ty, zoom, pts: [...pointers.values()].map((p) => ({ ...p })) }; return; }
    if (wasSingle && !moved && e.type === "pointerup") {
      const now = Date.now();
      const r = viewport.getBoundingClientRect();
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const g = target && target.closest && target.closest("[data-pid]");
      if (now - lastTap < 300) { zoomAt(2, e.clientX - r.left, e.clientY - r.top); lastTap = 0; return; }
      lastTap = now;
      if (g) setTimeout(() => { if (lastTap === now) personActions(g.dataset.pid); }, 310);
    }
    start = null;
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const zoomBtn = (name, label, fn) => h("button", { class: "ib", "aria-label": label, title: label, onclick: fn }, icon(name));
  const center = () => ({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
  const zoombar = h("div", { class: "zoombar" },
    zoomBtn("zoomin", "تكبير", () => { const c = center(); zoomAt(1.4, c.x, c.y); }),
    zoomBtn("zoomout", "تصغير", () => { const c = center(); zoomAt(1 / 1.4, c.x, c.y); }),
    zoomBtn("fit", "الشجرة كاملة", fit));
  viewport.appendChild(zoombar);

  const sizeText = () => {
    const w = scene.bbox.w, hh = scene.bbox.h;
    const paper = paperFor(w, hh);
    let t = `المقاس: ${cm(w)} × ${cm(hh)} سم، ${paper ? `يكفيه ${paper}` : "أكبر من A0 فيُطبع بنرًا"}`;
    if (opts.format === "pptx" && Math.max(w, hh) > 1422) t += ". وسيُصغَّر ليناسب أقصى حجم لشريحة PowerPoint";
    return t;
  };

  // ---------------------------------------------------------------- design (what the tree looks like)
  function designSheet() {
    sheet((close) => {
      const sheetBox = () => document.querySelector(".sheet.design");
      const refit = () => {
        const sb = sheetBox();
        coveredBottom = sb ? Math.max(0, viewport.getBoundingClientRect().bottom - sb.getBoundingClientRect().top) : 0;
        fit();
      };
      const change = async (fn) => { fn(); saveTreeOpts(opts); await draw(true); refit(); };
      const tog = (key, label) => {
        const b = h("button", { class: "tog" + (opts.fields[key] ? " on" : ""), type: "button" }, (opts.fields[key] ? "✓ " : "") + label);
        b.addEventListener("click", () => change(() => { opts.fields[key] = !opts.fields[key]; b.className = "tog" + (opts.fields[key] ? " on" : ""); b.textContent = (opts.fields[key] ? "✓ " : "") + label; }));
        return b;
      };
      const themesRow = (ids) => {
        const row = h("div", { class: "swatches" });
        const drawRow = () => row.replaceChildren(...ids.map((id) => swatch(id, opts.theme === id, () => change(() => { opts.theme = id; }).then(() => { for (const r of document.querySelectorAll(".sheet.design .swatches")) r.redraw(); }))));
        row.redraw = drawRow;
        drawRow();
        return row;
      };
      setTimeout(refit, 260); // once the sheet has slid in
      // the title: saved with the family (so it travels with its backups)
      const titleIn = h("input", { class: "inp", name: "treeTitle", value: f.treeTitle || "", placeholder: defaultTitle(f), maxlength: 60, autocomplete: "off", enterkeyhint: "done" });
      titleIn.disabled = !!f.hideTitle;
      let typing = null;
      titleIn.addEventListener("input", () => {
        clearTimeout(typing);
        typing = setTimeout(() => change(() => { f.treeTitle = titleIn.value.trim(); store.changed(); opts.title = treeTitle(f); }), 350);
      });
      titleIn.addEventListener("keydown", (e) => { if (e.key === "Enter") titleIn.blur(); });
      const titleSw = toggle(!f.hideTitle, (v) => change(() => {
        f.hideTitle = !v;
        titleIn.disabled = !v;
        store.changed();
        opts.title = treeTitle(f);
      }));
      return h("div", { class: "design-body" },
        h("h3", null, "تصميم الشجرة"),
        h("div", null, h("div", { class: "opt-t" }, "طريقة الترتيب", help("treeLayout")),
          segmented(LAYOUT_LABELS, opts.layout, (v) => change(() => { opts.layout = v; }), { cls: "bigseg" })),
        h("div", null, h("div", { class: "opt-t" }, "الألوان"), themesRow(PLAIN)),
        h("div", null, h("div", { class: "opt-t" }, "تصاميم مزخرفة", help("decorated")), themesRow(DECORATED)),
        h("div", { class: "title-opt" },
          h("div", { class: "toggle-row" }, h("span", { class: "l" }, "العنوان", help("treeTitle")), titleSw),
          titleIn),
        h("div", null, h("div", { class: "opt-t" }, "ما يظهر في كل خانة"),
          h("div", { class: "row" }, h("span", { class: "tog on locked" }, "✓ الاسم"), tog("photo", "الصورة"), tog("birth", "الميلاد"), tog("death", "الوفاة"), tog("note", "الملاحظة"), help("treeNote"))),
        h("div", null, h("div", { class: "opt-t" }, "علامة الوفاة", help("deathMark")),
          segmented([{ value: "rahma", label: "رحمه الله" }, { value: "ribbon", label: "شريط أسود" }, { value: "none", label: "بدون" }], opts.deathMark, (v) => change(() => { opts.deathMark = v; }), { cls: "bigseg" })),
        h("div", { class: "toggle-row" }, h("span", { class: "l" }, "تمييز الذكور والإناث", help("genderStyle")), toggle(opts.genderStyle, (v) => change(() => { opts.genderStyle = v; }))),
        h("div", null, h("div", { class: "opt-t" }, "ترتيب الإخوة", help("siblingOrder")),
          segmented([{ value: "age", label: "حسب العمر" }, { value: "gender", label: "الذكور ثم الإناث" }], opts.siblingOrder, (v) => change(() => { opts.siblingOrder = v; }), { cls: "bigseg" })),
        h("div", null, h("div", { class: "opt-t" }, "زيجات الأقارب", help("cousinStyle")),
          segmented([{ value: "ref", label: "إحالة برقم" }, { value: "line", label: "خط بينهما" }], opts.cousinStyle, (v) => change(() => { opts.cousinStyle = v; }), { cls: "bigseg" })),
        h("div", null, h("div", { class: "opt-t" }, "حجم الخط", help("fontSize")),
          segmented([{ value: 3.5, label: "١٠ نقاط" }, { value: 4.23, label: "١٢ نقطة" }, { value: 4.94, label: "١٤ نقطة" }], opts.fontMM, (v) => change(() => { opts.fontMM = v; }), { cls: "bigseg" })),
        h("button", { class: "btn primary", type: "button", onclick: close }, "تم"),
      );
    }, { light: true, cls: "design", onClose: () => { coveredBottom = 0; fit(); } });
  }

  // ---------------------------------------------------------------- export: the tree as shown, or the data
  function exportSheet() {
    sheet((close) => {
      const info = h("div", { class: "hint", style: { padding: 0 } }, sizeText());
      const go = h("button", { class: "btn primary", type: "button" }, icon("download"), "تصدير الشجرة");
      go.addEventListener("click", async () => { await close(); await doExport(); });
      const data = h("button", { class: "btn soft", type: "button" }, icon("download"), "تصدير البيانات");
      data.addEventListener("click", async () => { await close(); await exportBackup(f.id); });
      return h("div", { class: "export-body" },
        h("section", { class: "ex-part" },
          h("h3", null, "الشجرة"),
          h("div", { class: "hint", style: { padding: 0 } }, "تُصدَّر كما تظهر الآن. لتغيير شكلها وألوانها استخدم «التصميم»."),
          h("div", null, h("div", { class: "opt-t" }, "الصيغة", help("format")),
            segmented([{ value: "pdf", label: "PDF للطباعة" }, { value: "pptx", label: "PowerPoint للتعديل" }], opts.format, (v) => { opts.format = v; saveTreeOpts(opts); info.textContent = sizeText(); }, { cls: "bigseg" })),
          info,
          go),
        h("section", { class: "ex-part" },
          h("h3", { class: "row", style: { gap: "8px" } }, "البيانات", help("exportData")),
          h("div", { class: "hint", style: { padding: 0 } }, "نسخة احتياطية فيها كل بيانات العائلة وصورها، تفتحها في هذا التطبيق على أي جهاز."),
          data),
      );
    });
  }

  async function doExport() {
    const b = busy("جارٍ رسم الشجرة…");
    try {
      await fontsReady();
      const sc = layoutTree(f, opts, measure);
      const ph = opts.fields.photo ? await photoMaps(f, sc) : photos;
      const base = `شجرة-${f.name.replace(/\s+/g, "-")}-${todayISO()}`;
      const docTitle = opts.title || defaultTitle(f);
      if (opts.format === "pptx") {
        b.set("جارٍ إنشاء ملف PowerPoint…");
        const { blob, scaled } = await treeToPPTX(sc, { photos: ph.blobs, title: docTitle });
        b.done();
        if (scaled < 1) toast("صُغّرت الشجرة لتناسب أقصى حجم لشريحة PowerPoint", 4000);
        await deliverFile(blob, base + ".pptx", { title: "ملف PowerPoint جاهز", what: "الملف" });
      } else {
        const { blob } = await treeToPDF(sc, { images: ph.bitmaps, title: docTitle, onProgress: (x) => b.set(`جارٍ رسم الشجرة… ${ar(Math.round(x * 100))}٪`) });
        b.done();
        await deliverFile(blob, base + ".pdf", { title: "ملف PDF جاهز", what: "الملف" });
      }
    } catch (e) {
      b.done();
      console.error(e);
      await alertMsg("تعذر التصدير", "حدث خطأ أثناء إنشاء الملف. جرّب حجم خط أصغر أو أعد المحاولة.");
    }
  }

  const designBtn = h("button", { class: "btn soft tb", type: "button" }, icon("palette"), "التصميم");
  designBtn.addEventListener("click", () => designSheet());
  const exportBtn = h("button", { class: "btn soft tb", type: "button" }, icon("download"), "تصدير");
  exportBtn.addEventListener("click", () => exportSheet());

  const scr = h("div", { class: "screen tree-screen" },
    appBar({ title: "الشجرة", back: true, extra: h("div", { class: "tb-group" }, designBtn, exportBtn) }),
    viewport,
  );
  // draw after the screen is in the page (sizes are known)
  requestAnimationFrame(() => draw(false));
  return scr;
}
