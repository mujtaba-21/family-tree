// Tree designs: colour palettes, and decorated designs (frame, title, background) drawn by code so
// they stay sharp at any print size. The same shapes are used on screen, in the PDF and in PowerPoint.
// Every design can carry a title; plain designs show it as a heading above the tree.
// Everything is in millimetres.

const P = (fill, stroke, text) => ({ fill, stroke, text });

/** id -> design. deco: decorated designs (title + frame); others are plain palettes. */
export const THEMES = {
  calm: { name: "أساسي", bg: "#FFFFFF", line: "#8C8174", accent: "#2F5D50", onAccent: "#FFFFFF", sub: "#6F655B", blank: "#BDB2A3", spFill: "#FFFFFF",
    m: P("#E5EBF2", "#3B5878", "#2E4763"), f: P("#F4E4E0", "#9E4D45", "#83392F"), n: P("#EFEAE1", "#7C7166", "#2A2420"), title: "#2A2420" },
  blue: { name: "أزرق", bg: "#FAFCFE", line: "#8D99AA", accent: "#2C5282", onAccent: "#FFFFFF", sub: "#5B6B80", blank: "#B8C2D0", spFill: "#FFFFFF",
    m: P("#E2EBF6", "#2C5282", "#1F3D66"), f: P("#ECEFFA", "#6676BA", "#46559A"), n: P("#EDF1F6", "#64748B", "#1E293B"), title: "#1F3D66" },
  green: { name: "أخضر", bg: "#FAFBF6", line: "#8E9A8A", accent: "#2F5D50", onAccent: "#FFFFFF", sub: "#5E6B60", blank: "#B9C2B5", spFill: "#FFFFFF",
    m: P("#E2EDE6", "#2F5D50", "#224439"), f: P("#EEF2E0", "#76893F", "#52602B"), n: P("#EDF1EA", "#6B7A6E", "#24302A"), title: "#224439" },
  sand: { name: "رملي", bg: "#FCF8F1", line: "#A3927C", accent: "#8A5A2B", onAccent: "#FFFFFF", sub: "#7A6A58", blank: "#CBBBA5", spFill: "#FFFDF9",
    m: P("#F1E5D3", "#7A5230", "#5A3B20"), f: P("#F8EADD", "#B0784F", "#875332"), n: P("#F2EBDF", "#8C7A66", "#3B2F24"), title: "#5A3B20" },
  burgundy: { name: "عنابي", bg: "#FDF9F8", line: "#A39090", accent: "#7A2E3B", onAccent: "#FFFFFF", sub: "#7C6466", blank: "#CDB9BB", spFill: "#FFFFFF",
    m: P("#F1E2E4", "#6E2A36", "#521E28"), f: P("#F9EAEE", "#B0566C", "#8A3B4F"), n: P("#F3ECEC", "#806A6C", "#2E2224"), title: "#521E28" },
  charcoal: { name: "فحمي", bg: "#FFFFFF", line: "#9C9C9C", accent: "#3A3A3A", onAccent: "#FFFFFF", sub: "#6A6A6A", blank: "#C4C4C4", spFill: "#FFFFFF",
    m: P("#EAEAEA", "#33363B", "#202226"), f: P("#F7F7F7", "#7A7A82", "#45454C"), n: P("#F0F0F0", "#6E6E6E", "#222222"), title: "#202226" },
  // decorated
  sadu: { name: "السدو", deco: "sadu", bg: "#F6EEE1", line: "#7D6A58", accent: "#2B2522", onAccent: "#F6EEE1", sub: "#7A6655", blank: "#C9B8A3", spFill: "#FFF9F0",
    m: P("#F4E1D8", "#8B2B2B", "#6B1E1E"), f: P("#F8EBDD", "#B0672C", "#83481B"), n: P("#F1E7DA", "#7D6A58", "#2B2522"), title: "#8B2B2B" },
  islamic: { name: "زخرفة إسلامية", deco: "islamic", bg: "#FBF7EE", line: "#9A8F7A", accent: "#1F5C57", onAccent: "#FFFFFF", sub: "#7A705E", blank: "#CFC5B0", spFill: "#FFFDF8",
    m: P("#E1EEEC", "#1F5C57", "#164441"), f: P("#F6EDDA", "#A8803A", "#775820"), n: P("#F1ECE0", "#857B68", "#2A261E"), title: "#1F5C57" },
  parchment: { name: "الرَّق القديم", deco: "parchment", bg: "#F2E6CC", line: "#7A6247", accent: "#6B2E1F", onAccent: "#F5EAD3", sub: "#6E5A43", blank: "#BFA67F", spFill: "#F7EEDA",
    m: P("#EBDDBE", "#5A4632", "#3E2F20"), f: P("#F2E5C8", "#8C5A3C", "#6A4027"), n: P("#EEE2C6", "#6E5A43", "#3B2D1F"), title: "#3E2C1B" },
  botanical: { name: "نباتي", deco: "botanical", bg: "#F7F8F2", line: "#9AA392", accent: "#4F6B47", onAccent: "#FFFFFF", sub: "#6B7466", blank: "#C3CBBC", spFill: "#FFFFFF",
    m: P("#E5EEE1", "#4F6B47", "#3A5034"), f: P("#F6E7E0", "#B5735A", "#8E523D"), n: P("#EEF1EA", "#6F7A69", "#2B3328"), title: "#3A5034" },
};
export const PLAIN = ["calm", "blue", "green", "sand", "burgundy", "charcoal"];
export const DECORATED = ["sadu", "islamic", "parchment", "botanical"];
export const themeOf = (id) => THEMES[id] || THEMES.calm;

// the middle of the title letters sits about this far (× font size) above the baseline
const TITLE_MID = 0.27;

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

/**
 * Walk the four sides of a band of thickness t lying inside the outer box O.
 * For each side: map(u, v) -> page point, where u runs along the side (0..len) and v goes inward (0..t).
 */
function sides(O) {
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

/** A pointed leaf from local point (u, v) towards angle ang (local axes), len long, wid wide; map: local -> page. */
function leafD(map, u, v, ang, len, wid) {
  const tu = u + Math.cos(ang) * len, tv = v + Math.sin(ang) * len;
  const nu = -Math.sin(ang) * wid, nv = Math.cos(ang) * wid;
  const mu = (u + tu) / 2, mv = (v + tv) / 2;
  return `M${pt(...map(u, v))}Q${pt(...map(mu + nu, mv + nv))} ${pt(...map(tu, tv))}Q${pt(...map(mu - nu, mv - nv))} ${pt(...map(u, v))}Z`;
}
/**
 * A scroll in local units: a gentle S along +u from (u0, v0), L long and a deep, ending in a curl of
 * radius R that turns inward (+v) and tightens over `turns` turns.
 */
function scrollPts(u0, v0, L, a, R, turns) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const x = i / 48;
    pts.push([u0 + L * x, v0 + a * Math.sin(2 * Math.PI * x) * Math.sin(Math.PI * x)]);
  }
  for (let i = 1; i <= 72; i++) {
    const x = i / 72, phi = -Math.PI / 2 + x * turns * 2 * Math.PI, r = R * Math.pow(0.2, x);
    pts.push([u0 + L + r * Math.cos(phi), v0 + R + r * Math.sin(phi)]);
  }
  return pts;
}

// ------------------------------------------------------------------ title for the plain designs
/**
 * A heading centred above the tree (plain designs). em: the title's width at font size 1 (title font).
 * Returns the same shape as decorate(), with only a text.
 */
export function plainTitle(theme, box, title, em) {
  if (!title) return null;
  let fs = Math.max(7, Math.min(24, Math.max(box.w, box.h * 0.6) * 0.038));
  fs = Math.min(fs, (box.w * 0.9) / Math.max(1, em));
  const th = fs * 1.8;
  const O = { x: box.x, y: box.y - th, w: box.w, h: box.h + th };
  const y = O.y + th * 0.6 + TITLE_MID * fs;
  return { bbox: O, under: [], over: [], texts: [{ t: title, x: box.x + box.w / 2, y, fs, wt: 700, fill: theme.title || theme.n.text, font: "TD" }], paper: false };
}

// ------------------------------------------------------------------ decorated designs
/**
 * Adds the frame (and the title, when there is one) around a laid-out tree. box: the tree's bounds;
 * em: the title's width at font size 1. Returns {bbox, under, over, texts, paper} — under is drawn
 * before the tree (background patterns), over after it (frame); paper: an old-paper background.
 */
export function decorate(theme, box, title, em = 4) {
  if (!theme.deco) return null;
  const S = Math.max(box.w, box.h);
  const t = Math.max(9, Math.min(30, S * 0.03));          // band thickness
  const gap = t * 0.7;
  const th = title ? Math.max(20, Math.min(70, Math.max(box.w, box.h * 0.6) * 0.075)) : 0; // title area
  const O = { x: box.x - t - gap, y: box.y - t - gap - th, w: box.w + 2 * (t + gap), h: box.h + 2 * (t + gap) + th };
  const under = [], over = [], texts = [];
  // the title fits inside the frame with room for the ornaments beside it
  const fs = title ? Math.min(th * 0.52, Math.max(8, O.w * 0.06), (O.w - 2 * t) * 0.62 / Math.max(1, em)) : 0;
  const titleY = O.y + t + gap * 0.4 + th * 0.5 + TITLE_MID * fs; // baseline
  const midY = titleY - TITLE_MID * fs;                         // the middle of the letters
  const cx = O.x + O.w / 2;
  const tw = em * fs;                                           // the title's width
  const out = { bbox: O, under, over, texts, paper: false };
  const titleText = (color) => { if (title) texts.push({ t: title, x: cx, y: titleY, fs, wt: 700, fill: color, font: "TD" }); };
  DRAW[theme.deco]({ O, t, gap, th, fs, cx, titleY, midY, tw, title, under, over, texts, theme, titleText, out, box });
  return out;
}

const DRAW = {
  // Sadu: a red woven band with cream teeth along its edges and diamonds in the middle.
  sadu({ O, t, over, theme, titleText, cx, midY, fs, tw, title }) {
    const red = "#8B2B2B", black = "#2B2522", cream = "#F6EEE1", ochre = "#C98A3A";
    over.push({ d: ring(O, t), fill: red, rule: "evenodd" });
    let teeth = "", dia = "", core = "", dots = "";
    for (const sd of sides(O)) {
      const tw2 = t * 0.42, tdepth = t * 0.24;
      for (let u = t + tw2 / 2; u < sd.len - t - tw2 / 2 + 0.01; u += tw2) {
        teeth += polyD([sd.map(u - tw2 / 2, 0), sd.map(u + tw2 / 2, 0), sd.map(u, tdepth)]);
        teeth += polyD([sd.map(u - tw2 / 2, t), sd.map(u + tw2 / 2, t), sd.map(u, t - tdepth)]);
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
    if (!title) return;
    // title flanked by small woven bars
    titleText(theme.title);
    const bw = fs * 2.6, bh = fs * 0.34, gapX = tw / 2 + fs * 0.6;
    let bars = "", barDia = "";
    for (const sgn of [-1, 1]) {
      const x0 = sgn < 0 ? cx - gapX - bw : cx + gapX;
      const y0 = midY - bh / 2;
      bars += rectD(x0, y0, bw, bh);
      for (let i = 0; i < 4; i++) barDia += diamond(x0 + bw * (i + 0.5) / 4, y0 + bh / 2, bh * 0.42, bh * 0.36);
    }
    over.push({ d: bars, fill: red }, { d: barDia, fill: cream });
  },

  // Islamic geometry: an ivory band of eight-pointed stars between gold lines, star rosettes in the
  // corners, a faint star lattice behind the tree, and the title in a cartouche.
  islamic({ O, t, under, over, theme, titleText, cx, midY, fs, tw, title }) {
    const gold = "#B08D43", teal = "#1F5C57", ivory = "#F3EAD3";
    const tile = t * 2.4;
    let lattice = "";
    for (let y = O.y + t + tile / 2; y < O.y + O.h - t; y += tile) {
      for (let x = O.x + t + tile / 2; x < O.x + O.w - t; x += tile) lattice += starD(x, y, tile * 0.34);
    }
    under.push({ d: lattice, stroke: teal, sw: t * 0.035, alpha: 0.12 });
    over.push({ d: ring(O, t), fill: ivory, rule: "evenodd" });
    let stars = "", dots = "";
    for (const sd of sides(O)) {
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
    if (!title) return;
    // cartouche
    const cw = tw + fs * 2.4, ch = fs * 1.75;
    const x0 = cx - cw / 2, y0 = midY - ch / 2, rr = ch / 2;
    const pill = (x, y, w, h, r) => `M${pt(x + r, y)}L${pt(x + w - r, y)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x + w - r, y + h)}L${pt(x + r, y + h)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x + r, y)}Z`;
    over.push({ d: pill(x0, y0, cw, ch, rr), fill: theme.bg, stroke: gold, sw: lw * 1.2 });
    over.push({ d: pill(x0 + ch * 0.12, y0 + ch * 0.12, cw - ch * 0.24, ch * 0.76, rr * 0.76), stroke: gold, sw: lw * 0.6 });
    over.push({ d: starD(x0, y0 + ch / 2, ch * 0.32) + starD(x0 + cw, y0 + ch / 2, ch * 0.32), fill: teal, stroke: gold, sw: lw * 0.6 });
    titleText(theme.title);
  },

  // Old parchment: real paper (a fine grain, uneven tone, darker aged edges — see paper.js), a
  // hand-inked double frame with scalloped corners and fine flourishes, and the title on a ribbon.
  parchment({ O, t, over, texts, theme, cx, midY, fs, tw, title, out }) {
    out.paper = true;
    const ink = "#4A3826", inkSoft = "#6B5236";
    const s = t / 12;
    const a1 = t * 0.42, a2 = t * 0.68, rc = t * 0.95; // outer line, inner line, corner scallop radius
    // outer line
    over.push({ d: rectD(O.x + a1, O.y + a1, O.w - 2 * a1, O.h - 2 * a1), stroke: ink, sw: 0.62 * s });
    // inner line with scalloped (inward-curving) corners
    const x0 = O.x + a2, y0 = O.y + a2, x1 = O.x + O.w - a2, y1 = O.y + O.h - a2;
    const inner = `M${pt(x0 + rc, y0)}L${pt(x1 - rc, y0)}A${r2(rc)} ${r2(rc)} 0 0 0 ${pt(x1, y0 + rc)}`
      + `L${pt(x1, y1 - rc)}A${r2(rc)} ${r2(rc)} 0 0 0 ${pt(x1 - rc, y1)}`
      + `L${pt(x0 + rc, y1)}A${r2(rc)} ${r2(rc)} 0 0 0 ${pt(x0, y1 - rc)}`
      + `L${pt(x0, y0 + rc)}A${r2(rc)} ${r2(rc)} 0 0 0 ${pt(x0 + rc, y0)}Z`;
    over.push({ d: inner, stroke: ink, sw: 0.3 * s });
    // corner ornaments: a fleuron pointing inward on the diagonal, and on each side a fine scroll
    // (a gentle S ending in a curl) with two small leaves and two dots
    let lines = "", fills = "";
    const scroll = scrollPts(1.7, 0.9, 1.85, 0.12, 0.2, 1.15);
    const cornerPts = [[O.x, O.y, 1, 1], [O.x + O.w, O.y, -1, 1], [O.x, O.y + O.h, 1, -1], [O.x + O.w, O.y + O.h, -1, -1]];
    for (const [cxo, cyo, sx, sy] of cornerPts) {
      // local units (in t): u along the top edge, v down the side, both from the outer corner
      const at = (u, v) => [cxo + sx * u * t, cyo + sy * v * t];
      fills += leafD(at, 1.4, 1.4, Math.PI / 4, 0.62, 0.13);
      fills += leafD(at, 1.5, 1.5, Math.PI / 4 - 0.95, 0.34, 0.08);
      fills += leafD(at, 1.5, 1.5, Math.PI / 4 + 0.95, 0.34, 0.08);
      fills += circleD(...at(1.36, 1.36), 0.06 * t);
      for (const swap of [false, true]) {
        const q = swap ? (u, v) => at(v, u) : at;
        lines += "M" + scroll.map(([u, v]) => pt(...q(u, v))).join("L");
        fills += leafD(q, 2.12, 0.98, 0.95, 0.36, 0.085);
        fills += leafD(q, 2.72, 0.86, 1.1, 0.26, 0.07);
        fills += circleD(...q(3.98, 0.93), 0.045 * t) + circleD(...q(4.2, 0.93), 0.03 * t);
      }
      fills += diamond(...at(a1 / t, a1 / t), 0.14 * t);
    }
    // a small fleuron in the middle of each side (between the two lines)
    const mids = [[cx, O.y + (a1 + a2) / 2, 0], [cx, O.y + O.h - (a1 + a2) / 2, 0], [O.x + (a1 + a2) / 2, O.y + O.h / 2, 1], [O.x + O.w - (a1 + a2) / 2, O.y + O.h / 2, 1]];
    for (const [mx, my, vert] of mids) {
      if (!vert && my < O.y + O.h / 2 && title) continue; // the ribbon takes the top middle
      fills += vert ? diamond(mx, my, 0.12 * t, 0.3 * t) : diamond(mx, my, 0.3 * t, 0.12 * t);
    }
    over.push({ d: lines, stroke: inkSoft, sw: 0.36 * s });
    over.push({ d: fills, fill: inkSoft });
    if (!title) return;
    // the title on a ribbon banner: a gently arched band in front, folded tails behind with notched ends
    const W = tw + fs * 2.2, Hb = fs * 1.62, arch = Hb * 0.16;
    const bx0 = cx - W / 2, bx1 = cx + W / 2, yT = midY - Hb / 2 + arch / 2, yB = yT + Hb;
    const drop = Hb * 0.36, fold = Hb * 0.36, Lt = fs * 1.45, notch = fs * 0.42;
    const paperLight = "#F6ECD3", paperMid = "#E7D4AC", paperDark = "#C7A979";
    let tails = "", folds = "";
    for (const sgn of [-1, 1]) {
      const e = sgn < 0 ? bx0 : bx1;                 // the band's end
      const inX = e - sgn * fold;                    // where the tail goes under the band
      const outX = e + sgn * Lt;                     // the tail's far end
      tails += polyD([[inX, yT + drop], [outX, yT + drop], [outX - sgn * notch, yT + drop + Hb / 2], [outX, yT + drop + Hb], [inX, yT + drop + Hb]]);
      folds += polyD([[e, yB], [inX, yB], [inX, yB + drop]]);
    }
    over.push({ d: tails, fill: paperMid, stroke: ink, sw: 0.36 * s });
    over.push({ d: folds, fill: paperDark, stroke: ink, sw: 0.3 * s });
    const band = `M${pt(bx0, yT)}Q${pt(cx, yT - arch * 2)} ${pt(bx1, yT)}L${pt(bx1, yB)}Q${pt(cx, yB - arch * 2)} ${pt(bx0, yB)}Z`;
    over.push({ d: band, fill: paperLight, stroke: ink, sw: 0.42 * s });
    // fine inner lines along the band
    const inset = Hb * 0.13;
    over.push({ d: `M${pt(bx0 + inset * 0.6, yT + inset)}Q${pt(cx, yT + inset - arch * 2)} ${pt(bx1 - inset * 0.6, yT + inset)}M${pt(bx0 + inset * 0.6, yB - inset)}Q${pt(cx, yB - inset - arch * 2)} ${pt(bx1 - inset * 0.6, yB - inset)}`, stroke: inkSoft, sw: 0.18 * s });
    // the letters' middle on the band's middle (the band is raised by half the arch at its centre)
    texts.push({ t: title, x: cx, y: midY - arch / 2 + 0.32 * fs, fs, wt: 700, fill: theme.title, font: "TD" });
  },

  // Botanical: olive branches growing from the corners, a thin sage frame, sprigs beside the title.
  botanical({ O, t, over, theme, titleText, cx, midY, fs, tw, title }) {
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
    };
    const L = Math.min(O.w, O.h) * 0.22, size = t * 0.9;
    const cs = [[O.x, O.y, 1, 1], [O.x + O.w, O.y, -1, 1], [O.x, O.y + O.h, 1, -1], [O.x + O.w, O.y + O.h, -1, -1]];
    for (const [x, y, sx, sy] of cs) {
      const bx = x + sx * t * 0.7, by = y + sy * t * 0.7;
      branch(bx, by, bx + sx * L, by + sy * t * 0.35, [0, sy * t * 0.5], 7, size);
      branch(bx, by, bx + sx * t * 0.35, by + sy * L, [sx * t * 0.5, 0], 7, size);
    }
    if (title) {
      // sprigs by the title
      const gx = tw / 2 + fs * 0.6;
      branch(cx - gx, midY, cx - gx - fs * 2.2, midY - fs * 0.25, [0, fs * 0.25], 4, fs * 0.55);
      branch(cx + gx, midY, cx + gx + fs * 2.2, midY - fs * 0.25, [0, fs * 0.25], 4, fs * 0.55);
    }
    over.push({ d: stems, stroke: stem, sw: 0.5 * s });
    over.push({ d: leaves, fill: sage, alpha: 0.9 });
    titleText(theme.title);
  },
};
