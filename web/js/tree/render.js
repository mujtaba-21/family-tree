// Draw a laid-out tree as SVG (on screen) or onto a canvas (for PDF export).
import { LINE, ACCENT } from "./layout.js";
import { esc } from "../util.js";

const f2 = (v) => (Math.round(v * 100) / 100).toString();

function boxStyle(sc, b) {
  const { genderStyle } = sc.opts;
  const k = sc.k;
  const c = sc.colors[genderStyle ? b.g : "n"];
  const rx = !genderStyle ? 1.4 * k : b.g === "f" ? b.h / 2 : 0.9 * k;
  if (b.style === "blank") return { fill: "none", stroke: "#BDB2A3", sw: 0.35 * k, rx: 1.2 * k, text: c.text, dash: null };
  if (b.style === "ref") return { fill: "#FFFFFF", stroke: c.stroke, sw: 0.4 * k, rx, text: c.stroke, dash: [1.3 * k, 0.8 * k] };
  if (b.style === "sp") return { fill: "#FFFFFF", stroke: c.stroke, sw: 0.3 * k, rx, text: genderStyle ? c.stroke : c.text, dash: null };
  return { fill: c.fill, stroke: c.stroke, sw: (b.style === "root" ? 0.8 : 0.45) * k, rx, text: c.text, dash: null };
}
const lineColor = (sc, l) => (l.role === "rahma" ? ACCENT : l.role === "note" || l.role === "dates" ? "#6F655B" : null);

/** SVG markup. photoURL(id) -> url or null (only used for on-screen drawing). */
export function toSVG(sc, { photoURL, highlight, interactive } = {}) {
  const { x, y, w, h } = sc.bbox;
  const k = sc.k;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f2(x)} ${f2(y)} ${f2(w)} ${f2(h)}" width="${f2(w)}mm" height="${f2(h)}mm" font-family="TS">`);
  parts.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="#FFFFFF"/>`);
  const d = sc.lines.map((l) => "M" + l.map((q) => f2(q[0]) + " " + f2(q[1])).join("L")).join("");
  parts.push(`<path d="${d}" fill="none" stroke="${LINE}" stroke-width="${f2(0.32 * k)}" stroke-linejoin="round" stroke-linecap="round"/>`);
  for (const l of sc.links) {
    parts.push(`<path d="M${f2(l.p0[0])} ${f2(l.p0[1])}C${f2(l.c0[0])} ${f2(l.c0[1])} ${f2(l.c1[0])} ${f2(l.c1[1])} ${f2(l.p1[0])} ${f2(l.p1[1])}" fill="none" stroke="${ACCENT}" stroke-width="${f2(0.55 * k)}" stroke-dasharray="${f2(1.6 * k)} ${f2(1.1 * k)}"/>`);
    for (const q of [l.p0, l.p1]) parts.push(`<circle cx="${f2(q[0])}" cy="${f2(q[1])}" r="${f2(0.9 * k)}" fill="${ACCENT}"/>`);
  }
  const dm = sc.marr.map((l) => "M" + l.map((q) => f2(q[0]) + " " + f2(q[1])).join("L")).join("");
  parts.push(`<path d="${dm}" fill="none" stroke="${ACCENT}" stroke-width="${f2(0.5 * k)}" stroke-linejoin="round"/>`);
  for (const b of sc.boxes) {
    const st = boxStyle(sc, b);
    const target = interactive ? ` data-pid="${esc(b.style === "ref" ? b.pid : b.pid)}"` : "";
    parts.push(`<g${target}${interactive ? ' style="cursor:pointer"' : ""}>`);
    if (highlight && b.pid === highlight && b.style !== "ref") {
      parts.push(`<rect x="${f2(b.x - 1.6 * k)}" y="${f2(b.y - 1.6 * k)}" width="${f2(b.w + 3.2 * k)}" height="${f2(b.h + 3.2 * k)}" rx="${f2(st.rx + 1.6 * k)}" fill="none" stroke="${ACCENT}" stroke-width="${f2(0.9 * k)}"/>`);
    }
    parts.push(`<rect x="${f2(b.x)}" y="${f2(b.y)}" width="${f2(b.w)}" height="${f2(b.h)}" rx="${f2(st.rx)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${f2(st.sw)}"${st.dash ? ` stroke-dasharray="${f2(st.dash[0])} ${f2(st.dash[1])}"` : ""}/>`);
    const textX0 = b.x + (b.style === "ref" ? b.pad : 0), textX1 = b.x + b.w - (b.photo ? b.pad : 0);
    const cx = (textX0 + textX1) / 2;
    for (const l of b.lines) {
      if (!l.t) continue;
      parts.push(`<text x="${f2(cx)}" y="${f2(b.y + l.base)}" font-size="${f2(l.fs)}" font-weight="${l.wt}" text-anchor="middle" direction="rtl" fill="${lineColor(sc, l) || st.text}">${esc(l.t)}</text>`);
    }
    if (b.style === "ref") {
      const bx = b.x + (b.g === "f" && sc.opts.genderStyle ? 3.4 * k : 2.7 * k), by = b.y + b.h / 2;
      parts.push(`<circle cx="${f2(bx)}" cy="${f2(by)}" r="${f2(1.85 * k)}" fill="${ACCENT}"/>`);
      parts.push(`<text x="${f2(bx)}" y="${f2(by + 0.95 * k)}" font-size="${f2(2.7 * k)}" font-weight="700" text-anchor="middle" fill="#FFFFFF">${esc(b.refNum || "")}</text>`);
    }
    if (b.photo) {
      const s = b.h - 1.6 * sc.k, px = b.x + b.w - 0.8 * sc.k - s, py = b.y + 0.8 * sc.k;
      const url = photoURL && photoURL(b.photo);
      const clip = `c${Math.random().toString(36).slice(2, 8)}`;
      const r = b.g === "f" && sc.opts.genderStyle ? s / 2 : 0.8 * k;
      if (url) parts.push(`<clipPath id="${clip}"><rect x="${f2(px)}" y="${f2(py)}" width="${f2(s)}" height="${f2(s)}" rx="${f2(r)}"/></clipPath><image href="${esc(url)}" x="${f2(px)}" y="${f2(py)}" width="${f2(s)}" height="${f2(s)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`);
      else parts.push(`<rect x="${f2(px)}" y="${f2(py)}" width="${f2(s)}" height="${f2(s)}" rx="${f2(r)}" fill="#DDD3C3"/>`);
    }
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}

/**
 * Draw onto a 2D canvas context. `scale` = pixels per mm; (ox, oy) = top-left of the area in mm.
 * images: Map(photoId -> ImageBitmap)
 */
export function drawCanvas(ctx, sc, { scale, ox, oy, wmm, hmm, images }) {
  const k = sc.k;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(ox, oy, wmm, hmm);
  const vis = (x, y, w, h) => x + w >= ox && x <= ox + wmm && y + h >= oy && y <= oy + hmm;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  // connectors
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.32 * k;
  ctx.beginPath();
  for (const l of sc.lines) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
  ctx.stroke();
  if (sc.links.length) {
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 0.55 * k; ctx.setLineDash([1.6 * k, 1.1 * k]);
    for (const l of sc.links) {
      ctx.beginPath(); ctx.moveTo(l.p0[0], l.p0[1]); ctx.bezierCurveTo(l.c0[0], l.c0[1], l.c1[0], l.c1[1], l.p1[0], l.p1[1]); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = ACCENT;
    for (const l of sc.links) for (const q of [l.p0, l.p1]) { ctx.beginPath(); ctx.arc(q[0], q[1], 0.9 * k, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 0.5 * k;
  ctx.beginPath();
  for (const l of sc.marr) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
  ctx.stroke();
  // boxes. Text is drawn without the scaling transform so font sizes are real pixel sizes.
  const T = (t, x, y, fs, wt, color) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = `${wt} ${fs * scale}px TS`;
    ctx.fillStyle = color;
    ctx.fillText(t, (x - ox) * scale, (y - oy) * scale);
    ctx.restore();
  };
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
      T(l.t, cx, b.y + l.base, l.fs, l.wt, lineColor(sc, l) || st.text);
    }
    if (b.style === "ref") {
      const bx = b.x + (b.g === "f" && sc.opts.genderStyle ? 3.4 * k : 2.7 * k), by = b.y + b.h / 2;
      ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(bx, by, 1.85 * k, 0, Math.PI * 2); ctx.fill();
      T(b.refNum || "", bx, by + 0.95 * k, 2.7 * k, 700, "#FFFFFF");
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
      } else { ctx.fillStyle = "#DDD3C3"; ctx.fillRect(px, py, s, s); }
      ctx.restore();
    }
  }
  ctx.restore();
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
