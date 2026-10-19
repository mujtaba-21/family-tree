// Tree designs: colour palettes, and decorated designs (frame, title, background) drawn by code so
// they stay sharp at any print size. The same shapes are used on screen, in the PDF and in PowerPoint.
// Everything is in millimetres.

const P = (fill, stroke, text) => ({ fill, stroke, text });

/** id -> design. deco: decorated designs (title + frame); others are plain palettes. */
export const THEMES = {
  calm: { name: "هادئ", bg: "#FFFFFF", line: "#8C8174", accent: "#2F5D50", onAccent: "#FFFFFF", sub: "#6F655B", blank: "#BDB2A3", spFill: "#FFFFFF",
    m: P("#E5EBF2", "#3B5878", "#2E4763"), f: P("#F4E4E0", "#9E4D45", "#83392F"), n: P("#EFEAE1", "#7C7166", "#2A2420") },
  blue: { name: "أزرق", bg: "#FAFCFE", line: "#8D99AA", accent: "#2C5282", onAccent: "#FFFFFF", sub: "#5B6B80", blank: "#B8C2D0", spFill: "#FFFFFF",
    m: P("#E2EBF6", "#2C5282", "#1F3D66"), f: P("#ECEFFA", "#6676BA", "#46559A"), n: P("#EDF1F6", "#64748B", "#1E293B") },
  green: { name: "أخضر", bg: "#FAFBF6", line: "#8E9A8A", accent: "#2F5D50", onAccent: "#FFFFFF", sub: "#5E6B60", blank: "#B9C2B5", spFill: "#FFFFFF",
    m: P("#E2EDE6", "#2F5D50", "#224439"), f: P("#EEF2E0", "#76893F", "#52602B"), n: P("#EDF1EA", "#6B7A6E", "#24302A") },
  sand: { name: "رملي", bg: "#FCF8F1", line: "#A3927C", accent: "#8A5A2B", onAccent: "#FFFFFF", sub: "#7A6A58", blank: "#CBBBA5", spFill: "#FFFDF9",
    m: P("#F1E5D3", "#7A5230", "#5A3B20"), f: P("#F8EADD", "#B0784F", "#875332"), n: P("#F2EBDF", "#8C7A66", "#3B2F24") },
  burgundy: { name: "عنابي", bg: "#FDF9F8", line: "#A39090", accent: "#7A2E3B", onAccent: "#FFFFFF", sub: "#7C6466", blank: "#CDB9BB", spFill: "#FFFFFF",
    m: P("#F1E2E4", "#6E2A36", "#521E28"), f: P("#F9EAEE", "#B0566C", "#8A3B4F"), n: P("#F3ECEC", "#806A6C", "#2E2224") },
  charcoal: { name: "فحمي", bg: "#FFFFFF", line: "#9C9C9C", accent: "#3A3A3A", onAccent: "#FFFFFF", sub: "#6A6A6A", blank: "#C4C4C4", spFill: "#FFFFFF",
    m: P("#EAEAEA", "#33363B", "#202226"), f: P("#F7F7F7", "#7A7A82", "#45454C"), n: P("#F0F0F0", "#6E6E6E", "#222222") },
  night: { name: "ليلي", bg: "#151A21", line: "#5E6B7A", accent: "#C9A35B", onAccent: "#151A21", sub: "#9AA6B4", blank: "#3C4654", spFill: "#1C232C",
    m: P("#1E2A38", "#7FA6CF", "#D6E4F2"), f: P("#2C2230", "#C99AB0", "#F0DDE6"), n: P("#232A33", "#8C97A5", "#E4E8EE") },
  // decorated (drafts: the user judges them)
  sadu: { name: "السدو", deco: "sadu", bg: "#F6EEE1", line: "#7D6A58", accent: "#2B2522", onAccent: "#F6EEE1", sub: "#7A6655", blank: "#C9B8A3", spFill: "#FFF9F0",
    m: P("#F4E1D8", "#8B2B2B", "#6B1E1E"), f: P("#F8EBDD", "#B0672C", "#83481B"), n: P("#F1E7DA", "#7D6A58", "#2B2522"), title: "#8B2B2B" },
  islamic: { name: "زخرفة إسلامية", deco: "islamic", bg: "#FBF7EE", line: "#9A8F7A", accent: "#1F5C57", onAccent: "#FFFFFF", sub: "#7A705E", blank: "#CFC5B0", spFill: "#FFFDF8",
    m: P("#E1EEEC", "#1F5C57", "#164441"), f: P("#F6EDDA", "#A8803A", "#775820"), n: P("#F1ECE0", "#857B68", "#2A261E"), title: "#1F5C57" },
  parchment: { name: "الرَّق القديم", deco: "parchment", bg: "#F1E3C6", line: "#7A6247", accent: "#6B2E1F", onAccent: "#F5EAD3", sub: "#6E5A43", blank: "#BFA67F", spFill: "#F6ECD6",
    m: P("#EADBBB", "#5A4632", "#3E2F20"), f: P("#F0E2C4", "#8C5A3C", "#6A4027"), n: P("#ECDFC3", "#6E5A43", "#3B2D1F"), title: "#4A3826" },
  botanical: { name: "نباتي", deco: "botanical", bg: "#F7F8F2", line: "#9AA392", accent: "#4F6B47", onAccent: "#FFFFFF", sub: "#6B7466", blank: "#C3CBBC", spFill: "#FFFFFF",
    m: P("#E5EEE1", "#4F6B47", "#3A5034"), f: P("#F6E7E0", "#B5735A", "#8E523D"), n: P("#EEF1EA", "#6F7A69", "#2B3328"), title: "#3A5034" },
  gold: { name: "ليلي ذهبي", deco: "gold", bg: "#121821", line: "#6C7686", accent: "#C8A45D", onAccent: "#121821", sub: "#A7ADB8", blank: "#3A4352", spFill: "#18202B",
    m: P("#1B2531", "#D8C08A", "#F3E9D2"), f: P("#251E25", "#E2B6A3", "#F6E4DB"), n: P("#1E2530", "#B9A27A", "#F0E8D8"), title: "#D9B970" },
};
export const PLAIN = ["calm", "blue", "green", "sand", "burgundy", "charcoal", "night"];
export const DECORATED = ["sadu", "islamic", "parchment", "botanical", "gold"];
export const themeOf = (id) => THEMES[id] || THEMES.calm;

// ------------------------------------------------------------------ geometry helpers
const r2 = (v) => Math.round(v * 100) / 100;
const pt = (x, y) => `${r2(x)} ${r2(y)}`;
const polyD = (pts) => "M" + pts.map(([x, y]) => pt(x, y)).join("L") + "Z";
const rectD = (x, y, w, h) => polyD([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const diamond = (cx, cy, rx, ry = rx) => polyD([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]]);
const circleD = (cx, cy, r) => `M${pt(cx - r, cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
function starD(cx, cy, R) { // eight-pointed star (two squares), as one outline
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const rr = i % 2 ? R * 0.7654 : R;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return polyD(pts);
}
/** An irregular rounded blob (smooth curve through points at random distances around a centre). */
function blobD(cx, cy, r, R) {
  const n = 9, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r * (0.7 + R() * 0.5);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.8]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${pt(...mid(pts[n - 1], pts[0]))}`;
  for (let i = 0; i < n; i++) d += `Q${pt(...pts[i])} ${pt(...mid(pts[i], pts[(i + 1) % n]))}`;
  return d + "Z";
}
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/**
 * Walk the four sides of a band of thickness t lying inside the outer box O.
 * For each side: map(u, v) -> page point, where u runs along the side (0..len) and v goes inward (0..t).
 */
function sides(O, t) {
  return [
    { len: O.w, map: (u, v) => [O.x + u, O.y + v] },
    { len: O.w, map: (u, v) => [O.x + O.w - u, O.y + O.h - v] },
    { len: O.h, map: (u, v) => [O.x + O.w - v, O.y + u] },
    { len: O.h, map: (u, v) => [O.x + v, O.y + O.h - u] },
  ];
}
const corners = (O, t) => [[O.x, O.y], [O.x + O.w - t, O.y], [O.x, O.y + O.h - t], [O.x + O.w - t, O.y + O.h - t]];
/** Motif centres along a side between the corner squares. */
function stations(len, t, pitch) {
  const n = Math.max(1, Math.round((len - 2 * t) / pitch));
  const step = (len - 2 * t) / n;
  return Array.from({ length: n }, (_, i) => ({ u: t + step * (i + 0.5), step }));
}
const ring = (O, t) => rectD(O.x, O.y, O.w, O.h) + rectD(O.x + t, O.y + t, O.w - 2 * t, O.h - 2 * t);

// ------------------------------------------------------------------ decorated designs
/**
 * Adds the frame and title around a laid-out tree. box: the tree's bounds; title: text.
 * Returns {bbox, under: [...], over: [...], texts: [...], bgGradient} — under is drawn before the
 * tree (background patterns), over after it (frame).
 */
export function decorate(theme, box, title) {
  if (!theme.deco) return null;
  const S = Math.max(box.w, box.h);
  const t = Math.max(9, Math.min(30, S * 0.03));          // band thickness
  const gap = t * 0.7;
  const th = Math.max(20, Math.min(70, Math.max(box.w, box.h * 0.6) * 0.075)); // title area
  const O = { x: box.x - t - gap, y: box.y - t - gap - th, w: box.w + 2 * (t + gap), h: box.h + 2 * (t + gap) + th };
  const under = [], over = [], texts = [];
  const fs = Math.min(th * 0.52, Math.max(8, O.w * 0.06));
  const titleY = O.y + t + gap * 0.4 + th * 0.62;
  const cx = O.x + O.w / 2;
  const out = { bbox: O, under, over, texts, bgGradient: null };
  const titleText = (color) => texts.push({ t: title, x: cx, y: titleY, fs, wt: 700, fill: color, font: "TD" });
  DRAW[theme.deco]({ O, t, gap, th, fs, cx, titleY, under, over, theme, titleText, out, box });
  return out;
}

const DRAW = {
  // Sadu: a red woven band with cream teeth along its edges and diamonds in the middle.
  sadu({ O, t, over, theme, titleText, cx, titleY, fs }) {
    const red = "#8B2B2B", black = "#2B2522", cream = "#F6EEE1", ochre = "#C98A3A";
    over.push({ d: ring(O, t), fill: red, rule: "evenodd" });
    let teeth = "", dia = "", core = "", dots = "";
    for (const sd of sides(O, t)) {
      const tw = t * 0.42, tdepth = t * 0.24;
      for (let u = t + tw / 2; u < sd.len - t - tw / 2 + 0.01; u += tw) {
        teeth += polyD([sd.map(u - tw / 2, 0), sd.map(u + tw / 2, 0), sd.map(u, tdepth)]);
        teeth += polyD([sd.map(u - tw / 2, t), sd.map(u + tw / 2, t), sd.map(u, t - tdepth)]);
      }
      for (const { u, step } of stations(sd.len, t, t * 1.6)) {
        const c = sd.map(u, t / 2);
        const horiz = sd.map(u + 1, t / 2)[1] === c[1];
        const [rx, ry] = horiz ? [t * 0.42, t * 0.2] : [t * 0.2, t * 0.42];
        dia += diamond(c[0], c[1], rx, ry);
        core += diamond(c[0], c[1], rx * 0.45, ry * 0.45);
        const d2 = sd.map(u + step / 2, t / 2);
        if (u + step / 2 < sd.len - t) dots += diamond(d2[0], d2[1], t * 0.07);
      }
    }
    over.push({ d: teeth, fill: cream });
    over.push({ d: dia, fill: cream });
    over.push({ d: core, fill: black });
    over.push({ d: dots, fill: ochre });
    let cs = "", ci = "", cc = "";
    for (const [x, y] of corners(O, t)) {
      cs += rectD(x, y, t, t);
      ci += diamond(x + t / 2, y + t / 2, t * 0.38);
      cc += diamond(x + t / 2, y + t / 2, t * 0.16);
    }
    over.push({ d: cs, fill: black }, { d: ci, fill: cream }, { d: cc, fill: red });
    over.push({ d: rectD(O.x, O.y, O.w, O.h), stroke: black, sw: t * 0.06 });
    over.push({ d: rectD(O.x + t, O.y + t, O.w - 2 * t, O.h - 2 * t), stroke: black, sw: t * 0.06 });
    // title flanked by small woven bars
    titleText(theme.title);
    const bw = fs * 2.6, bh = fs * 0.34, gapX = fs * 0.6 + fs * title_len_guess * 1.12;
    let bars = "", barDia = "";
    for (const sgn of [-1, 1]) {
      const x0 = sgn < 0 ? cx - gapX - bw : cx + gapX;
      const y0 = titleY - fs * 0.36 - bh / 2;
      bars += rectD(x0, y0, bw, bh);
      for (let i = 0; i < 4; i++) barDia += diamond(x0 + bw * (i + 0.5) / 4, y0 + bh / 2, bh * 0.42, bh * 0.36);
    }
    over.push({ d: bars, fill: red }, { d: barDia, fill: cream });
  },

  // Islamic geometry: an ivory band of eight-pointed stars between gold lines, star rosettes in the
  // corners, a faint star lattice behind the tree, and the title in a cartouche.
  islamic({ O, t, under, over, theme, titleText, cx, titleY, fs, box }) {
    const gold = "#B08D43", teal = "#1F5C57", ivory = "#F3EAD3";
    // faint lattice behind the tree
    const tile = t * 2.4;
    let lattice = "";
    for (let y = O.y + t + tile / 2; y < O.y + O.h - t; y += tile) {
      for (let x = O.x + t + tile / 2; x < O.x + O.w - t; x += tile) lattice += starD(x, y, tile * 0.34);
    }
    under.push({ d: lattice, stroke: teal, sw: t * 0.035, alpha: 0.12 });
    over.push({ d: ring(O, t), fill: ivory, rule: "evenodd" });
    let stars = "", dots = "";
    for (const sd of sides(O, t)) {
      for (const { u, step } of stations(sd.len, t, t * 1.25)) {
        const c = sd.map(u, t / 2);
        stars += starD(c[0], c[1], t * 0.36);
        const d2 = sd.map(u + step / 2, t / 2);
        if (u + step / 2 < sd.len - t) dots += diamond(d2[0], d2[1], t * 0.08);
      }
    }
    over.push({ d: stars, fill: teal, stroke: gold, sw: t * 0.04 });
    over.push({ d: dots, fill: gold });
    let cs = "", cr = "", cdot = "";
    for (const [x, y] of corners(O, t)) {
      cs += rectD(x, y, t, t);
      cr += starD(x + t / 2, y + t / 2, t * 0.44);
      cdot += circleD(x + t / 2, y + t / 2, t * 0.12);
    }
    over.push({ d: cs, fill: teal }, { d: cr, fill: ivory, stroke: gold, sw: t * 0.04 }, { d: cdot, fill: gold });
    const lw = t * 0.06;
    over.push({ d: rectD(O.x, O.y, O.w, O.h), stroke: gold, sw: lw * 1.4 });
    over.push({ d: rectD(O.x + t, O.y + t, O.w - 2 * t, O.h - 2 * t), stroke: gold, sw: lw });
    over.push({ d: rectD(O.x + t * 1.18, O.y + t * 1.18, O.w - 2.36 * t, O.h - 2.36 * t), stroke: gold, sw: lw * 0.6 });
    // cartouche
    const cw = Math.min(box.w * 0.9, fs * (1.2 + title_len_guess * 2.2)), ch = fs * 1.75;
    const x0 = cx - cw / 2, y0 = titleY - fs * 0.36 - ch / 2, rr = ch / 2;
    const pill = (x, y, w, h, r) => `M${pt(x + r, y)}L${pt(x + w - r, y)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x + w - r, y + h)}L${pt(x + r, y + h)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x + r, y)}Z`;
    over.push({ d: pill(x0, y0, cw, ch, rr), fill: theme.bg, stroke: gold, sw: lw * 1.2 });
    over.push({ d: pill(x0 + ch * 0.12, y0 + ch * 0.12, cw - ch * 0.24, ch * 0.76, rr * 0.76), stroke: gold, sw: lw * 0.6 });
    over.push({ d: starD(x0, y0 + ch / 2, ch * 0.32) + starD(x0 + cw, y0 + ch / 2, ch * 0.32), fill: teal, stroke: gold, sw: lw * 0.6 });
    titleText(theme.title);
  },

  // Old parchment: warm paper with a soft vignette and stains, inked double frame and corner scrolls.
  parchment({ O, t, under, over, theme, titleText, cx, titleY, fs, out }) {
    const ink = "#4A3826";
    out.bgGradient = { inner: "#F6ECD6", outer: "#D8BE90" };
    // a few large, soft, irregular stains (not spots)
    const R = rng(1234);
    const n = Math.min(14, Math.round((O.w * O.h) / 60000) + 5);
    let stains = "";
    for (let i = 0; i < n; i++) {
      const r = Math.min(O.w, O.h) * (0.06 + R() * 0.1);
      stains += blobD(O.x + R() * O.w, O.y + R() * O.h, r, R);
    }
    under.push({ d: stains, fill: "#A8814E", alpha: 0.045 });
    const s = t / 12;
    over.push({ d: rectD(O.x + t * 0.25, O.y + t * 0.25, O.w - t * 0.5, O.h - t * 0.5), stroke: ink, sw: 0.7 * s });
    over.push({ d: rectD(O.x + t * 0.55, O.y + t * 0.55, O.w - t * 1.1, O.h - t * 1.1), stroke: ink, sw: 0.35 * s });
    let scroll = "", knots = "";
    const cornerPts = [[O.x, O.y, 1, 1], [O.x + O.w, O.y, -1, 1], [O.x, O.y + O.h, 1, -1], [O.x + O.w, O.y + O.h, -1, -1]];
    for (const [x, y, sx, sy] of cornerPts) {
      const m = (u, v) => pt(x + sx * u * s, y + sy * v * s);
      scroll += `M${m(7, 7)}C${m(18, 5)} ${m(20, 14)} ${m(30, 9)}C${m(36, 6)} ${m(40, 9)} ${m(44, 7)}`;
      scroll += `M${m(7, 7)}C${m(5, 18)} ${m(14, 20)} ${m(9, 30)}C${m(6, 36)} ${m(9, 40)} ${m(7, 44)}`;
      scroll += `M${m(7, 7)}C${m(12, 12)} ${m(16, 11)} ${m(16, 16)}`;
      knots += circleD(x + sx * 7 * s, y + sy * 7 * s, 1.5 * s) + circleD(x + sx * 16.5 * s, y + sy * 16.5 * s, 0.9 * s);
    }
    over.push({ d: scroll, stroke: ink, sw: 0.45 * s });
    over.push({ d: knots, fill: ink });
    titleText(theme.title);
    const w = fs * (1.6 + title_len_guess * 2.4), y = titleY + fs * 0.42;
    over.push({ d: `M${pt(cx - w / 2, y)}C${pt(cx - w / 4, y - fs * 0.18)} ${pt(cx - w / 8, y + fs * 0.18)} ${pt(cx, y)}C${pt(cx + w / 8, y - fs * 0.18)} ${pt(cx + w / 4, y + fs * 0.18)} ${pt(cx + w / 2, y)}`, stroke: ink, sw: 0.4 * s });
    over.push({ d: diamond(cx, y, fs * 0.12), fill: ink });
  },

  // Botanical: olive branches growing from the corners, a thin sage frame, sprigs beside the title.
  botanical({ O, t, over, theme, titleText, cx, titleY, fs }) {
    const sage = "#7E9473", stem = "#61765A";
    const s = t / 12;
    over.push({ d: rectD(O.x + t * 0.3, O.y + t * 0.3, O.w - t * 0.6, O.h - t * 0.6), stroke: sage, sw: 0.45 * s });
    let stems = "", leaves = "";
    const branch = (x0, y0, x1, y1, bend, count, size) => {
      // a gently curving stem with leaves on alternate sides
      const mx = (x0 + x1) / 2 + bend[0], my = (y0 + y1) / 2 + bend[1];
      stems += `M${pt(x0, y0)}Q${pt(mx, my)} ${pt(x1, y1)}`;
      for (let i = 1; i <= count; i++) {
        const tt = i / (count + 1);
        const bx = (1 - tt) ** 2 * x0 + 2 * (1 - tt) * tt * mx + tt * tt * x1;
        const by = (1 - tt) ** 2 * y0 + 2 * (1 - tt) * tt * my + tt * tt * y1;
        const dx = 2 * (1 - tt) * (mx - x0) + 2 * tt * (x1 - mx), dy = 2 * (1 - tt) * (my - y0) + 2 * tt * (y1 - my);
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len, side = i % 2 ? 1 : -1;
        const nx = -uy * side, ny = ux * side;
        const L = size * (1 - tt * 0.35);
        const tipx = bx + (nx * 0.8 + ux * 0.6) * L, tipy = by + (ny * 0.8 + uy * 0.6) * L;
        const w = L * 0.32;
        leaves += `M${pt(bx, by)}Q${pt((bx + tipx) / 2 + uy * w * side, (by + tipy) / 2 - ux * w * side)} ${pt(tipx, tipy)}Q${pt((bx + tipx) / 2 - uy * w * side, (by + tipy) / 2 + ux * w * side)} ${pt(bx, by)}Z`;
      }
      leaves += `M${pt(x1, y1)}m0 0` ;
    };
    const L = Math.min(O.w, O.h) * 0.22, size = t * 0.9;
    const cs = [[O.x, O.y, 1, 1], [O.x + O.w, O.y, -1, 1], [O.x, O.y + O.h, 1, -1], [O.x + O.w, O.y + O.h, -1, -1]];
    for (const [x, y, sx, sy] of cs) {
      const bx = x + sx * t * 0.7, by = y + sy * t * 0.7;
      branch(bx, by, bx + sx * L, by + sy * t * 0.35, [0, sy * t * 0.5], 7, size);
      branch(bx, by, bx + sx * t * 0.35, by + sy * L, [sx * t * 0.5, 0], 7, size);
    }
    // sprigs by the title
    const gx = fs * (0.6 + title_len_guess * 1.1);
    branch(cx - gx, titleY - fs * 0.35, cx - gx - fs * 2.2, titleY - fs * 0.6, [0, fs * 0.25], 4, fs * 0.55);
    branch(cx + gx, titleY - fs * 0.35, cx + gx + fs * 2.2, titleY - fs * 0.6, [0, fs * 0.25], 4, fs * 0.55);
    over.push({ d: stems, stroke: stem, sw: 0.5 * s });
    over.push({ d: leaves, fill: sage, alpha: 0.9 });
    titleText(theme.title);
  },

  // Night gold: navy ground, a double gold frame with diamonds on its sides and in the corners.
  gold({ O, t, over, theme, titleText, cx, titleY, fs }) {
    const gold = "#C8A45D";
    const s = t / 12;
    const a = t * 0.3, b = t * 0.62;
    over.push({ d: rectD(O.x + a, O.y + a, O.w - 2 * a, O.h - 2 * a), stroke: gold, sw: 0.7 * s });
    over.push({ d: rectD(O.x + b, O.y + b, O.w - 2 * b, O.h - 2 * b), stroke: gold, sw: 0.3 * s });
    let marks = "", dots = "";
    const mids = [[O.x + O.w / 2, O.y + a], [O.x + O.w / 2, O.y + O.h - a], [O.x + a, O.y + O.h / 2], [O.x + O.w - a, O.y + O.h / 2]];
    for (const [x, y] of mids) { marks += diamond(x, y, t * 0.28); dots += diamond(x, y, t * 0.1); }
    for (const [x, y] of [[O.x + a, O.y + a], [O.x + O.w - a, O.y + a], [O.x + a, O.y + O.h - a], [O.x + O.w - a, O.y + O.h - a]]) {
      marks += diamond(x, y, t * 0.36);
      dots += diamond(x, y, t * 0.12);
    }
    over.push({ d: marks, fill: theme.bg, stroke: gold, sw: 0.45 * s });
    over.push({ d: dots, fill: gold });
    titleText(theme.title);
    const w = fs * (1.4 + title_len_guess * 2.3), y = titleY + fs * 0.45;
    over.push({ d: `M${pt(cx - w / 2, y)}L${pt(cx - fs * 0.25, y)}M${pt(cx + fs * 0.25, y)}L${pt(cx + w / 2, y)}`, stroke: gold, sw: 0.35 * s });
    over.push({ d: diamond(cx, y, fs * 0.13), fill: gold });
  },
};

// The title's width is only known once the font measures it; the drawings around it use this guess,
// which decorate() callers update through setTitleLength (in "em" of the title font).
let title_len_guess = 4;
export function setTitleLength(em) { title_len_guess = Math.max(1.5, em / 2); }
