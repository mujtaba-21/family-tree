// Draw a laid-out tree as SVG (on screen) or onto a canvas (PDF and PowerPoint export).
// Colours come from the scene's design (sc.theme); sc.deco adds the title, and for decorated designs
// the frame and background.
import { esc } from "../util.js";
import { paperSheet, paperGrain, GRAIN_MM } from "./paper.js";

const f2 = (v) => (Math.round(v * 100) / 100).toString();

function boxStyle(sc, b) {
  const T = sc.theme;
  const { genderStyle } = sc.opts;
  const k = sc.k;
  const c = T[genderStyle ? b.g : "n"];
  const rx = !genderStyle ? 1.4 * k : b.g === "f" ? b.h / 2 : 0.9 * k;
  if (b.style === "blank") return { fill: "none", stroke: T.blank, sw: 0.35 * k, rx: 1.2 * k, text: c.text, dash: null };
  if (b.style === "ref") return { fill: T.spFill, stroke: c.stroke, sw: 0.4 * k, rx, text: c.stroke, dash: [1.3 * k, 0.8 * k] };
  if (b.style === "sp") return { fill: T.spFill, stroke: c.stroke, sw: 0.3 * k, rx, text: genderStyle ? c.stroke : c.text, dash: null };
  return { fill: c.fill, stroke: c.stroke, sw: (b.style === "root" ? 0.8 : 0.45) * k, rx, text: c.text, dash: null };
}
const lineColor = (sc, l) => (l.role === "rahma" ? sc.theme.accent : l.role === "note" || l.role === "dates" ? sc.theme.sub : null);
export const boxColors = boxStyle;
export const textColor = lineColor;

// ------------------------------------------------------------------ the mourning ribbon
export const RIBBON = "#1C1C1C";
function roundRectPoly(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const pts = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = a0 + (Math.PI / 2) * (i / 8); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(x + r, y + r, Math.PI);
  arc(x + w - r, y + r, 1.5 * Math.PI);
  arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, 0.5 * Math.PI);
  return pts;
}
/** Sutherland–Hodgman: the part of a polygon inside a convex polygon. */
function clipConvex(subject, clip) {
  let area = 0;
  for (let i = 0; i < clip.length; i++) { const [x1, y1] = clip[i], [x2, y2] = clip[(i + 1) % clip.length]; area += x1 * y2 - x2 * y1; }
  const sg = area > 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length], ex = B[0] - A[0], ey = B[1] - A[1];
    const side = (q) => sg * (ex * (q[1] - A[1]) - ey * (q[0] - A[0]));
    const cut = (P, Q) => { const sp = side(P), sq = side(Q), u = sp / (sp - sq); return [P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u]; };
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const S = inp[(j + inp.length - 1) % inp.length], E = inp[j];
      if (side(E) >= 0) { if (side(S) < 0) out.push(cut(S, E)); out.push(E); }
      else if (side(S) >= 0) out.push(cut(S, E));
    }
  }
  return out;
}
/**
 * The black ribbon across the top-left corner of a deceased person's box — or of the photo when one
 * is shown — kept inside the margin so it never touches the name. Returns a polygon (mm) or null.
 */
export function ribbonOf(sc, b) {
  if (!b.dead || sc.opts.deathMark !== "ribbon" || b.style === "ref" || b.style === "blank") return null;
  const k = sc.k;
  let x, y, w, h, r, a, t;
  if (b.photo) {
    const s = b.h - 1.6 * k;
    x = b.x + b.w - 0.8 * k - s; y = b.y + 0.8 * k; w = h = s;
    r = b.g === "f" && sc.opts.genderStyle ? s / 2 : 0.8 * k;
    a = s * (r >= s / 2 - 1e-6 ? 0.42 : 0.34); t = 0.8 * k;
  } else {
    x = b.x; y = b.y; w = b.w; h = b.h; r = boxStyle(sc, b).rx;
    a = (r >= h / 2 - 1e-6 ? 2.9 : 2.45) * k; t = 0.95 * k;
  }
  // a band along the line u + v = a (u, v measured from the corner), t thick, clipped to the shape
  const c1 = a - t / Math.SQRT2, c2 = a + t / Math.SQRT2;
  const band = [[x - 1, y + c1 + 1], [x - 1, y + c2 + 1], [x + c2 + 1, y - 1], [x + c1 + 1, y - 1]];
  const poly = clipConvex(band, roundRectPoly(x, y, w, h, r));
  return poly.length >= 3 ? poly : null;
}
const polyPath = (pts) => "M" + pts.map((q) => f2(q[0]) + " " + f2(q[1])).join("L") + "Z";

// ------------------------------------------------------------------ SVG
function decoPathsSVG(items) {
  return items.map((it) => `<path d="${it.d}" fill="${it.fill || "none"}"${it.rule ? ` fill-rule="${it.rule}"` : ""}${it.stroke ? ` stroke="${it.stroke}" stroke-width="${f2(it.sw)}" stroke-linejoin="round" stroke-linecap="round"` : ""}${it.alpha != null ? ` opacity="${it.alpha}"` : ""}/>`).join("");
}
function decoTextsSVG(texts) {
  return texts.map((t) => `<text x="${f2(t.x)}" y="${f2(t.y)}" font-size="${f2(t.fs)}" font-weight="${t.wt}" font-family="${t.font || "TS"}" text-anchor="middle" direction="rtl" fill="${t.fill}">${esc(t.t)}</text>`).join("");
}

/** SVG markup. photoURL(id) -> url or null (only used for on-screen drawing). */
export function toSVG(sc, { photoURL, interactive } = {}) {
  const { x, y, w, h } = sc.bbox;
  const k = sc.k, T = sc.theme, deco = sc.deco;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f2(x)} ${f2(y)} ${f2(w)} ${f2(h)}" width="${f2(w)}mm" height="${f2(h)}mm" font-family="TS">`);
  if (deco && deco.paper) {
    const sheet = paperSheet(w, h), grain = paperGrain();
    parts.push(`<defs><pattern id="grain" patternUnits="userSpaceOnUse" width="${GRAIN_MM}" height="${GRAIN_MM}"><image href="${grain.url()}" width="${GRAIN_MM}" height="${GRAIN_MM}"/></pattern></defs>`);
    parts.push(`<image href="${sheet.url()}" x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" preserveAspectRatio="none"/>`);
    parts.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="url(#grain)"/>`);
  } else parts.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="${T.bg}"/>`);
  if (deco) parts.push(decoPathsSVG(deco.under));
  const d = sc.lines.map((l) => "M" + l.map((q) => f2(q[0]) + " " + f2(q[1])).join("L")).join("");
  parts.push(`<path d="${d}" fill="none" stroke="${T.line}" stroke-width="${f2(0.32 * k)}" stroke-linejoin="round" stroke-linecap="round"/>`);
  for (const l of sc.links) {
    parts.push(`<path d="M${f2(l.p0[0])} ${f2(l.p0[1])}C${f2(l.c0[0])} ${f2(l.c0[1])} ${f2(l.c1[0])} ${f2(l.c1[1])} ${f2(l.p1[0])} ${f2(l.p1[1])}" fill="none" stroke="${T.accent}" stroke-width="${f2(0.55 * k)}" stroke-dasharray="${f2(1.6 * k)} ${f2(1.1 * k)}"/>`);
    for (const q of [l.p0, l.p1]) parts.push(`<circle cx="${f2(q[0])}" cy="${f2(q[1])}" r="${f2(0.9 * k)}" fill="${T.accent}"/>`);
  }
  const dm = sc.marr.map((l) => "M" + l.map((q) => f2(q[0]) + " " + f2(q[1])).join("L")).join("");
  parts.push(`<path d="${dm}" fill="none" stroke="${T.accent}" stroke-width="${f2(0.5 * k)}" stroke-linejoin="round"/>`);
  for (const b of sc.boxes) {
    const st = boxStyle(sc, b);
    const target = interactive ? ` data-pid="${esc(b.pid)}"` : "";
    parts.push(`<g${target}${interactive ? ' style="cursor:pointer"' : ""}>`);
    parts.push(`<rect x="${f2(b.x)}" y="${f2(b.y)}" width="${f2(b.w)}" height="${f2(b.h)}" rx="${f2(st.rx)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${f2(st.sw)}"${st.dash ? ` stroke-dasharray="${f2(st.dash[0])} ${f2(st.dash[1])}"` : ""}/>`);
    const textX0 = b.x + (b.style === "ref" ? b.pad : 0), textX1 = b.x + b.w - (b.photo ? b.pad : 0);
    const cx = (textX0 + textX1) / 2;
    for (const l of b.lines) {
      if (!l.t) continue;
      parts.push(`<text x="${f2(cx)}" y="${f2(b.y + l.base)}" font-size="${f2(l.fs)}" font-weight="${l.wt}" text-anchor="middle" direction="rtl" fill="${lineColor(sc, l) || st.text}">${esc(l.t)}</text>`);
    }
    if (b.style === "ref") {
      const bx = b.x + (b.g === "f" && sc.opts.genderStyle ? 3.4 * k : 2.7 * k), by = b.y + b.h / 2;
      parts.push(`<circle cx="${f2(bx)}" cy="${f2(by)}" r="${f2(1.85 * k)}" fill="${T.accent}"/>`);
      parts.push(`<text x="${f2(bx)}" y="${f2(by + 0.95 * k)}" font-size="${f2(2.7 * k)}" font-weight="700" text-anchor="middle" fill="${T.onAccent}">${esc(b.refNum || "")}</text>`);
    }
    if (b.photo) {
      const s = b.h - 1.6 * sc.k, px = b.x + b.w - 0.8 * sc.k - s, py = b.y + 0.8 * sc.k;
      const url = photoURL && photoURL(b.photo);
      const clip = `c${Math.random().toString(36).slice(2, 8)}`;
      const r = b.g === "f" && sc.opts.genderStyle ? s / 2 : 0.8 * k;
      if (url) parts.push(`<clipPath id="${clip}"><rect x="${f2(px)}" y="${f2(py)}" width="${f2(s)}" height="${f2(s)}" rx="${f2(r)}"/></clipPath><image href="${esc(url)}" x="${f2(px)}" y="${f2(py)}" width="${f2(s)}" height="${f2(s)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`);
      else parts.push(`<rect x="${f2(px)}" y="${f2(py)}" width="${f2(s)}" height="${f2(s)}" rx="${f2(r)}" fill="${T.blank}"/>`);
    }
    const rb = ribbonOf(sc, b);
    if (rb) parts.push(`<path d="${polyPath(rb)}" fill="${RIBBON}"/>`);
    parts.push(`</g>`);
  }
  if (deco) { parts.push(decoPathsSVG(deco.over)); parts.push(decoTextsSVG(deco.texts)); }
  parts.push(`</svg>`);
  return parts.join("");
}

// ------------------------------------------------------------------ canvas
function paintBackground(ctx, sc, ox, oy, wmm, hmm) {
  const deco = sc.deco;
  ctx.fillStyle = sc.theme.bg;
  ctx.fillRect(ox, oy, wmm, hmm);
  if (deco && deco.paper) {
    const { x, y, w, h } = sc.bbox;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(paperSheet(w, h).canvas, x, y, w, h);
    const g = paperGrain().canvas;
    const pat = ctx.createPattern(g, "repeat");
    if (pat && pat.setTransform) {
      pat.setTransform(new DOMMatrix([GRAIN_MM / g.width, 0, 0, GRAIN_MM / g.height, 0, 0]));
      ctx.fillStyle = pat;
      ctx.fillRect(ox, oy, wmm, hmm);
    }
  }
}
function paintItems(ctx, items) {
  for (const it of items) {
    const p = new Path2D(it.d);
    ctx.globalAlpha = it.alpha != null ? it.alpha : 1;
    if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(p, it.rule || "nonzero"); }
    if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.sw; ctx.stroke(p); }
  }
  ctx.globalAlpha = 1;
}
/** Text drawn without the scaling transform, so font sizes are real pixel sizes. */
function textAt(ctx, scale, ox, oy, t, x, y, fs, wt, color, family = "TS") {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.font = `${wt} ${fs * scale}px ${family}`;
  ctx.fillStyle = color;
  ctx.fillText(t, (x - ox) * scale, (y - oy) * scale);
  ctx.restore();
}

/**
 * Draw onto a 2D canvas context. `scale` = pixels per mm; (ox, oy) = top-left of the area in mm.
 * images: Map(photoId -> ImageBitmap). parts: "all" | "deco" (background, frame and title only).
 */
export function drawCanvas(ctx, sc, { scale, ox, oy, wmm, hmm, images, parts = "all" }) {
  const k = sc.k, T = sc.theme, deco = sc.deco;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
  paintBackground(ctx, sc, ox, oy, wmm, hmm);
  if (deco) paintItems(ctx, deco.under);
  if (parts === "deco") {
    if (deco) paintItems(ctx, deco.over);
    ctx.restore();
    return;
  }
  const vis = (x, y, w, h) => x + w >= ox && x <= ox + wmm && y + h >= oy && y <= oy + hmm;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  // connectors
  ctx.strokeStyle = T.line; ctx.lineWidth = 0.32 * k;
  ctx.beginPath();
  for (const l of sc.lines) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
  ctx.stroke();
  if (sc.links.length) {
    ctx.strokeStyle = T.accent; ctx.lineWidth = 0.55 * k; ctx.setLineDash([1.6 * k, 1.1 * k]);
    for (const l of sc.links) {
      ctx.beginPath(); ctx.moveTo(l.p0[0], l.p0[1]); ctx.bezierCurveTo(l.c0[0], l.c0[1], l.c1[0], l.c1[1], l.p1[0], l.p1[1]); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = T.accent;
    for (const l of sc.links) for (const q of [l.p0, l.p1]) { ctx.beginPath(); ctx.arc(q[0], q[1], 0.9 * k, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = T.accent; ctx.lineWidth = 0.5 * k;
  ctx.beginPath();
  for (const l of sc.marr) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
  ctx.stroke();
  const Tx = (t, x, y, fs, wt, color) => textAt(ctx, scale, ox, oy, t, x, y, fs, wt, color);
  for (const b of sc.boxes) {
    if (!vis(b.x - 2, b.y - 2, b.w + 4, b.h + 4)) continue;
    const st = boxStyle(sc, b);
    ctx.beginPath();
    roundRect(ctx, b.x, b.y, b.w, b.h, st.rx);
    if (st.fill !== "none") { ctx.fillStyle = st.fill; ctx.fill(); }
    ctx.strokeStyle = st.stroke; ctx.lineWidth = st.sw;
    if (st.dash) ctx.setLineDash(st.dash);
    ctx.stroke();
    ctx.setLineDash([]);
    const textX0 = b.x + (b.style === "ref" ? b.pad : 0), textX1 = b.x + b.w - (b.photo ? b.pad : 0);
    const cx = (textX0 + textX1) / 2;
    for (const l of b.lines) {
      if (!l.t) continue;
      Tx(l.t, cx, b.y + l.base, l.fs, l.wt, lineColor(sc, l) || st.text);
    }
    if (b.style === "ref") {
      const bx = b.x + (b.g === "f" && sc.opts.genderStyle ? 3.4 * k : 2.7 * k), by = b.y + b.h / 2;
      ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(bx, by, 1.85 * k, 0, Math.PI * 2); ctx.fill();
      Tx(b.refNum || "", bx, by + 0.95 * k, 2.7 * k, 700, T.onAccent);
    }
    if (b.photo) {
      const s = b.h - 1.6 * k, px = b.x + b.w - 0.8 * k - s, py = b.y + 0.8 * k;
      const r = b.g === "f" && sc.opts.genderStyle ? s / 2 : 0.8 * k;
      const img = images && images.get(b.photo);
      ctx.save();
      ctx.beginPath(); roundRect(ctx, px, py, s, s, r); ctx.clip();
      if (img) {
        const iw = img.width, ih = img.height, m = Math.min(iw, ih);
        ctx.drawImage(img, (iw - m) / 2, (ih - m) / 2, m, m, px, py, s, s);
      } else { ctx.fillStyle = T.blank; ctx.fillRect(px, py, s, s); }
      ctx.restore();
    }
    const rb = ribbonOf(sc, b);
    if (rb) {
      ctx.fillStyle = RIBBON;
      ctx.beginPath();
      rb.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fill();
    }
  }
  if (deco) {
    paintItems(ctx, deco.over);
    for (const t of deco.texts) textAt(ctx, scale, ox, oy, t.t, t.x, t.y, t.fs, t.wt, t.fill, t.font || "TS");
  }
  ctx.restore();
}

/** Background, frame and title of a decorated design as one PNG (for PowerPoint), longest side ≤ maxPx. */
export async function decoImage(sc, maxPx = 4096) {
  const { x, y, w, h } = sc.bbox;
  const scale = Math.min(maxPx / Math.max(w, h), 8);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
  const ctx = cv.getContext("2d");
  drawCanvas(ctx, sc, { scale, ox: x, oy: y, wmm: w, hmm: h, parts: "deco" });
  // old paper is a photograph-like texture: JPEG keeps the file small; drawn ornaments stay PNG
  const blob = await new Promise((res) => (sc.deco && sc.deco.paper ? cv.toBlob(res, "image/jpeg", 0.9) : cv.toBlob(res, "image/png")));
  cv.width = cv.height = 1;
  return blob;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
