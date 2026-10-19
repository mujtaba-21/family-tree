// Family-tree layout: the first generations as top-down rows, then (from the "switch generation")
// every branch as a right-to-left list (generations as columns going left, eldest on top).
// Three ways to choose the switch generation (opts.layout):
//  - "balanced" (default): as many generations in rows as the width allows; the rest as lists;
//  - "vertical": every generation in rows;
//  - "flex": whatever brings the drawing closest to paper proportions.
// All geometry is in millimetres.
import * as M from "../model.js";
import * as D from "../dates.js";
import { ar } from "../util.js";
import { themeOf, decorate, plainTitle } from "./themes.js";

export const DEFAULT_OPTS = {
  fontMM: 3.5,              // ~10pt
  fields: { photo: false, birth: false, death: false, note: false },
  deathMark: "rahma",       // "rahma" (رحمه الله under the name) | "ribbon" (black corner ribbon) | "none"
  genderStyle: true,
  siblingOrder: "age",      // "age" | "gender"
  cousinStyle: "ref",       // "ref" | "line"
  calendar: "h",
  layout: "balanced",       // "balanced" | "vertical" | "flex"
  theme: "calm",            // see tree/themes.js
  title: "",                // the title at the top ("" = none)
};
export const LAYOUTS = ["balanced", "vertical", "flex"];
export const DEATH_MARKS = ["rahma", "ribbon", "none"];

// "balanced": generations stay in rows while the drawing is no wider than this many times its height
const WIDE_RATIO = 4.5;
// the middle of Arabic letters sits about this far (× font size) above the baseline
const MID = 0.25;
const isDead = (p) => !!(p && !p.blank && (p.deceased || (p.death && p.death.y)));

function datesText(p, cal, fields) {
  const b = fields.birth && p.birth && p.birth.y ? D.yearLabel(p.birth, cal) : "";
  const d = fields.death && p.death && p.death.y ? D.yearLabel(p.death, cal) : "";
  const suf = cal === "h" ? "هـ" : "م";
  if (b && d) return `${b}–${d}${suf}`;
  if (b) return `${b}${suf}`;
  if (d) return `ت ${d}${suf}`;
  return "";
}

/**
 * measure(text, weight) -> width in "em" (width of the text at font-size 1).
 * Returns a scene: {boxes, lines, marr, links, bbox, L}
 */
export function layoutTree(f, options, measure) {
  const opts = { ...DEFAULT_OPTS, ...options, fields: { ...DEFAULT_OPTS.fields, ...(options && options.fields) } };
  const k = opts.fontMM / 3.5;
  const FS = opts.fontMM;
  const PADX = 2.4 * k, MINW = 12 * k, CG = 3.2 * k;
  const SIB_H = 2.8 * k, UNION_H = 6 * k, ROWGAP = 12 * k, PANEL_TOP = 10 * k;
  const SIB_V = 2.0 * k, UNION_V = 4.0 * k, CONNECT = 10 * k, BAR = 3.6 * k, BRK = 5.0 * k, BAR_IN = 4.5 * k;
  const BADGE = 4.0 * k;
  const refMode = opts.cousinStyle === "ref";
  const P = f.persons;
  const theme = themeOf(opts.theme);
  const colors = { m: theme.m, f: theme.f, n: theme.n };

  // ---- which optional text lines exist anywhere (boxes share one height)
  const people = Object.values(P).filter((p) => !p.blank);
  const hasDates = people.some((p) => (opts.fields.birth && p.birth && p.birth.y) || (opts.fields.death && p.death && p.death.y));
  const hasRahma = opts.deathMark === "rahma" && people.some(isDead);
  const hasNote = opts.fields.note && people.some((p) => p.note);
  const smallFS = FS * 0.78;
  const lineSpecs = [{ role: "name", lh: FS * 1.32 }];
  if (hasDates) lineSpecs.push({ role: "dates", lh: smallFS * 1.3 });
  if (hasRahma) lineSpecs.push({ role: "rahma", lh: smallFS * 1.25 });
  if (hasNote) lineSpecs.push({ role: "note", lh: smallFS * 1.3 });
  const blockH = lineSpecs.reduce((a, s) => a + s.lh, 0);
  const BH = Math.max(7.6 * k, blockH + 2.4 * k);
  const photoSize = BH - 1.6 * k;

  const kindOf = (pid) => M.kind(f, pid); // root | desc | spouse | blank
  const orderKids = (kids) => {
    if (opts.siblingOrder !== "gender") return kids;
    return [...kids.filter((x) => P[x].gender === "m"), ...kids.filter((x) => P[x].gender !== "m")];
  };

  // ---- box content and width (cached per person + style)
  const specCache = new Map();
  function spec(pid, style) {
    const key = pid + ":" + style;
    if (specCache.has(key)) return specCache.get(key);
    const p = P[pid];
    let s;
    if (style === "blank" || (p && p.blank)) s = { w: MINW, lines: [], photo: null, pad: 0 };
    else if (style === "ref") {
      const t = M.nameWithFather(f, pid);
      s = { w: Math.max(MINW, measure(t, 500) * FS + 2 * PADX + BADGE), lines: [{ t, fs: FS, wt: 500, role: "name" }], photo: null, pad: BADGE };
    } else {
      const root = pid === f.rootId;
      const lines = [];
      const nameFS = root ? FS * 1.12 : FS;
      lines.push({ t: M.shortName(f, pid), fs: nameFS, wt: root ? 700 : 500, role: "name" });
      if (hasDates) lines.push({ t: datesText(p, opts.calendar, opts.fields), fs: smallFS, wt: 400, role: "dates" });
      if (hasRahma) lines.push({ t: isDead(p) ? (p.gender === "f" ? "رحمها الله" : "رحمه الله") : "", fs: smallFS * 0.96, wt: 700, role: "rahma" });
      if (hasNote) { let t = p.note || ""; if (t.length > 26) t = t.slice(0, 25) + "…"; lines.push({ t, fs: smallFS, wt: 400, role: "note" }); }
      let tw = 0;
      for (const l of lines) if (l.t) tw = Math.max(tw, measure(l.t, l.wt) * l.fs);
      const photo = opts.fields.photo && p.mainPhoto ? p.mainPhoto : null;
      const pad = photo ? photoSize + 1.4 * k : 0;
      s = { w: Math.max(MINW, tw + 2 * PADX + pad + (root ? 2 * k : 0)), lines, photo, pad, dead: isDead(p) };
    }
    // vertical text positions (baselines): the lines that have text are centred together in the box,
    // so a name alone sits in the middle even when other boxes have a second line
    const slot = (l) => (lineSpecs.find((x) => x.role === l.role) || lineSpecs[0]).lh;
    const shown = s.lines.filter((l) => l.t);
    let y = (BH - shown.reduce((a, l) => a + slot(l), 0)) / 2;
    s.lines = s.lines.map((l) => {
      if (!l.t) return { ...l, base: 0 };
      const lh = slot(l);
      const out = { ...l, base: y + lh / 2 + MID * l.fs };
      y += lh;
      return out;
    });
    specCache.set(key, s);
    return s;
  }
  const styleFor = (pid, isSpouseSlot) => {
    const kd = kindOf(pid);
    if (kd === "blank") return "blank";
    if (kd === "root") return "root";
    if (isSpouseSlot) return kd === "spouse" ? "sp" : "ref";
    return kd === "spouse" ? "sp" : "desc";
  };
  const bw = (pid, style) => spec(pid, style).w;

  // ---- what sits next to a person: spouse boxes (or references) and which of them have children here
  const slotCache = new Map();
  function slotsOf(n) {
    if (slotCache.has(n)) return slotCache.get(n);
    const out = [];
    for (const u of M.hostedUnions(f, n)) {
      const sp = M.spouseIn(u, n);
      const kids = orderKids(u.kids);
      if (!sp || !P[sp]) out.push({ u, sp: null, style: null, kids });
      else if (M.isDesc(f, sp)) out.push({ u, sp, style: refMode ? "ref" : null, kids });
      else out.push({ u, sp, style: P[sp].blank ? "blank" : "sp", kids });
    }
    if (refMode) {
      for (const u of M.unionsOf(f, n)) {
        if (M.isCousinUnion(f, u) && M.hostOf(f, u) !== n) out.push({ u, sp: M.spouseIn(u, n), style: "ref", kids: [] });
      }
    }
    slotCache.set(n, out);
    return out;
  }
  const slotW = (s) => (s.style ? bw(s.sp, s.style) : 0);

  // ---- scene
  function newScene() { return { boxes: [], lines: [], marr: [], pos: new Map() }; }
  function addBox(S, pid, style, x, y, extra) {
    const sp = spec(pid, style);
    S.boxes.push({ pid, style, g: P[pid].gender, x, y, w: sp.w, h: BH, lines: sp.lines, photo: sp.photo, pad: sp.pad, dead: !!sp.dead, ...extra });
    if (style !== "ref" && style !== "sp" && M.isDesc(f, pid)) S.pos.set(pid, { x, y, w: sp.w, h: BH });
  }
  const path = (S, pts, marriage) => (marriage ? S.marr : S.lines).push(pts);
  function unitWidthInline(n) {
    let w = bw(n, styleFor(n, false));
    for (const s of slotsOf(n)) if (s.style) w += CG + slotW(s);
    return w;
  }
  function placeUnitInline(S, n, right, y) {
    const hw = bw(n, styleFor(n, false));
    addBox(S, n, styleFor(n, false), right - hw, y);
    const drops = new Map();
    let cur = right - hw;
    for (const s of slotsOf(n)) {
      if (!s.style) { drops.set(s.u.id, right - hw / 2); continue; }
      const sw = slotW(s);
      addBox(S, s.sp, s.style, cur - CG - sw, y, { unionId: s.u.id });
      path(S, [[cur - CG, y + BH / 2], [cur, y + BH / 2]], true);
      drops.set(s.u.id, cur - CG - sw / 2);
      cur = cur - CG - sw;
    }
    return drops;
  }

  // ---- right-to-left tree for a set of siblings (first column)
  function buildRTL(firstIds, incoming) {
    const hm = new Map();
    const kidsH = (s) => (s.kids.length ? s.kids.reduce((a, c) => a + rH(c), 0) + SIB_V * (s.kids.length - 1) : 0);
    function rH(n) {
      if (hm.has(n)) return hm.get(n);
      const ss = slotsOf(n);
      const hgt = ss.length <= 1 ? Math.max(BH, ss.length ? kidsH(ss[0]) : 0)
        : ss.reduce((a, s) => a + Math.max(BH, kidsH(s)), 0) + UNION_V * (ss.length - 1);
      hm.set(n, hgt);
      return hgt;
    }
    const span = [];
    const walk = (n, d) => {
      const ss = slotsOf(n);
      const hw = bw(n, styleFor(n, false));
      let uw;
      if (ss.length <= 1) uw = hw + (ss[0] && ss[0].style ? CG + slotW(ss[0]) : 0);
      else uw = hw + BRK + Math.max(0, ...ss.map(slotW));
      span[d] = Math.max(span[d] || 0, uw);
      for (const s of ss) for (const c of s.kids) walk(c, d + 1);
    };
    firstIds.forEach((c) => walk(c, 0));
    const inX = incoming ? BAR_IN : 0;
    const colRight = [-inX];
    for (let d = 1; d < span.length; d++) colRight[d] = colRight[d - 1] - span[d - 1] - CONNECT;
    const w = -(colRight[span.length - 1] - span[span.length - 1]);
    const hgt = firstIds.reduce((a, c) => a + rH(c), 0) + SIB_V * (firstIds.length - 1);

    function place(S, right, top) {
      const connect = (fromX, fromY, d, centers) => {
        const R1 = right + colRight[d];
        const bx = R1 + BAR;
        path(S, [[fromX, fromY], [bx, fromY]]);
        path(S, [[bx, Math.min(fromY, ...centers)], [bx, Math.max(fromY, ...centers)]]);
        for (const c of centers) path(S, [[bx, c], [R1, c]]);
      };
      const rPlace = (n, d, t) => {
        const ss = slotsOf(n);
        const R0 = right + colRight[d];
        const st = styleFor(n, false);
        const hw = bw(n, st);
        const hgt2 = rH(n);
        if (ss.length <= 1) {
          const s = ss[0];
          const rowY = t + hgt2 / 2 - BH / 2;
          addBox(S, n, st, R0 - hw, rowY);
          let left = R0 - hw;
          if (s && s.style) {
            const sw = slotW(s);
            addBox(S, s.sp, s.style, R0 - hw - CG - sw, rowY, { unionId: s.u.id });
            path(S, [[R0 - hw - CG, rowY + BH / 2], [R0 - hw, rowY + BH / 2]], true);
            left = R0 - hw - CG - sw;
          }
          if (s && s.kids.length) {
            let c = t + (hgt2 - kidsH(s)) / 2;
            const cs = [];
            for (const kid of s.kids) { cs.push(rPlace(kid, d + 1, c)); c += rH(kid) + SIB_V; }
            connect(left, rowY + BH / 2, d + 1, cs);
          }
          return rowY + BH / 2;
        }
        let c = t;
        const sps = [];
        for (const s of ss) {
          const bh = Math.max(BH, kidsH(s));
          const cy = c + bh / 2;
          let left = R0 - hw;
          if (s.style) {
            const sw = slotW(s);
            addBox(S, s.sp, s.style, R0 - hw - BRK - sw, cy - BH / 2, { unionId: s.u.id });
            left = R0 - hw - BRK - sw;
            sps.push({ cy, right: R0 - hw - BRK });
          } else sps.push({ cy, right: R0 - hw - BRK / 2, none: true });
          if (s.kids.length) {
            let kc = c + (bh - kidsH(s)) / 2;
            const cs = [];
            for (const kid of s.kids) { cs.push(rPlace(kid, d + 1, kc)); kc += rH(kid) + SIB_V; }
            connect(left, cy, d + 1, cs);
          }
          c += bh + UNION_V;
        }
        const hy = (sps[0].cy + sps[sps.length - 1].cy) / 2;
        addBox(S, n, st, R0 - hw, hy - BH / 2);
        const xb = R0 - hw - BRK / 2;
        path(S, [[R0 - hw, hy], [xb, hy]], true);
        path(S, [[xb, sps[0].cy], [xb, sps[sps.length - 1].cy]], true);
        for (const s of sps) if (!s.none) path(S, [[xb, s.cy], [s.right, s.cy]], true);
        return hy;
      };
      let c = top;
      const centers = [];
      for (const kid of firstIds) { centers.push(rPlace(kid, 0, c)); c += rH(kid) + SIB_V; }
      if (incoming) {
        const bx = right - inX / 2;
        path(S, [[bx, top], [bx, Math.max(...centers)]]);
        for (const cy of centers) path(S, [[bx, cy], [right + colRight[0], cy]]);
      }
    }
    return { w, h: hgt, place, barX: (right) => right - inX / 2 };
  }

  // ---- top-down rows down to generation L-1; below that each union's children form a panel
  function buildTD(L) {
    const S = newScene();
    const memo = new Map();
    const rowTop = (g) => g * (BH + ROWGAP);
    const genOf = (n) => M.genOf(f, n) || 0;
    function measureTD(n) {
      const unitW = unitWidthInline(n);
      const blocks = [];
      for (const s of slotsOf(n)) {
        if (!s.kids.length) continue;
        if (genOf(n) < L - 1) {
          const ws = s.kids.map((c) => measureTD(c).w);
          blocks.push({ s, kind: "td", w: ws.reduce((a, b) => a + b, 0) + SIB_H * (ws.length - 1) });
        } else {
          const panel = buildRTL(s.kids, true);
          blocks.push({ s, kind: "panel", w: panel.w, panel });
        }
      }
      const kidsW = blocks.reduce((a, b) => a + b.w, 0) + UNION_H * Math.max(0, blocks.length - 1);
      const r = { unitW, blocks, kidsW, w: Math.max(unitW, kidsW) };
      memo.set(n, r);
      return r;
    }
    function place(n, xRight) {
      const m = memo.get(n), y = rowTop(genOf(n));
      const panelMode = m.blocks.length && m.blocks[0].kind === "panel";
      const unitRight = panelMode ? xRight : xRight - (m.w - m.unitW) / 2;
      const kidsRight = panelMode ? xRight : xRight - (m.w - m.kidsW) / 2;
      const drops = placeUnitInline(S, n, unitRight, y);
      let cur = kidsRight;
      m.blocks.forEach((b, bi) => {
        const dx = drops.get(b.s.u.id);
        if (b.kind === "td") {
          const xs = [];
          for (const c of b.s.kids) {
            place(c, cur);
            const kp = S.pos.get(c);
            xs.push(kp.x + kp.w / 2);
            cur -= memo.get(c).w + SIB_H;
          }
          cur += SIB_H;
          const ym = y + BH + ROWGAP / 2 + (bi - (m.blocks.length - 1) / 2) * 1.8 * k;
          path(S, [[dx, y + BH], [dx, ym]]);
          path(S, [[Math.min(dx, ...xs), ym], [Math.max(dx, ...xs), ym]]);
          for (const kx of xs) path(S, [[kx, ym], [kx, rowTop(genOf(n) + 1)]]);
        } else {
          const top = y + BH + PANEL_TOP;
          b.panel.place(S, cur, top);
          const bx = b.panel.barX(cur);
          const yj = top - 3.2 * k - bi * 1.8 * k;
          path(S, [[dx, y + BH], [dx, yj], [bx, yj], [bx, top]]);
          cur -= b.w;
        }
        cur -= UNION_H;
      });
    }
    const rm = measureTD(f.rootId);
    place(f.rootId, rm.w);
    return S;
  }

  function finish(S) {
    // reference numbers in reading order (top to bottom, right to left)
    const refs = S.boxes.filter((b) => b.style === "ref");
    const order = [...refs].sort((a, b) => a.y - b.y || b.x - a.x);
    const num = new Map();
    for (const b of order) if (!num.has(b.unionId)) num.set(b.unionId, num.size + 1);
    for (const b of refs) b.refNum = ar(num.get(b.unionId));
    // dashed lines for cousin marriages (line mode)
    const links = [];
    if (!refMode) {
      for (const u of Object.values(f.unions)) {
        if (!M.isCousinUnion(f, u)) continue;
        const a = S.pos.get(u.h), b = S.pos.get(u.w);
        if (!a || !b) continue;
        const ca = [a.x + a.w / 2, a.y + BH / 2], cb = [b.x + b.w / 2, b.y + BH / 2];
        const dx = cb[0] - ca[0], dy = cb[1] - ca[1];
        const edge = (c, box, vx, vy) => (Math.abs(vx) * BH > Math.abs(vy) * box.w ? [c[0] + Math.sign(vx) * box.w / 2, c[1]] : [c[0], c[1] + Math.sign(vy) * BH / 2]);
        const p0 = edge(ca, a, dx, dy), p1 = edge(cb, b, -dx, -dy);
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        let nx = -(p1[1] - p0[1]) / len, ny = (p1[0] - p0[0]) / len;
        if (ny > 0 || (Math.abs(ny) < 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
        const bow = Math.min(40 * k, 0.22 * len + 6 * k);
        const c0 = [p0[0] + (p1[0] - p0[0]) * 0.25 + nx * bow, p0[1] + (p1[1] - p0[1]) * 0.25 + ny * bow];
        const c1 = [p0[0] + (p1[0] - p0[0]) * 0.75 + nx * bow, p0[1] + (p1[1] - p0[1]) * 0.75 + ny * bow];
        links.push({ p0, c0, c1, p1 });
      }
    }
    // bounds
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const b of S.boxes) { grow(b.x, b.y); grow(b.x + b.w, b.y + b.h); }
    for (const l of S.lines.concat(S.marr)) for (const [x, y] of l) grow(x, y);
    for (const l of links) for (let i = 0; i <= 24; i++) {
      const t = i / 24, a = (1 - t) ** 3, bb = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
      grow(a * l.p0[0] + bb * l.c0[0] + c * l.c1[0] + d * l.p1[0], a * l.p0[1] + bb * l.c0[1] + c * l.c1[1] + d * l.p1[1]);
    }
    const pad = 10 * k;
    return { boxes: S.boxes, lines: S.lines, marr: S.marr, links, pos: S.pos, BH, k, opts, theme, colors,
      bbox: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad } };
  }

  let maxGen = 0;
  for (const id of Object.keys(P)) if (M.isDesc(f, id)) maxGen = Math.max(maxGen, M.genOf(f, id));
  const allRows = maxGen + 1;
  const build = (L) => { const sc = finish(buildTD(L)); sc.L = L; return sc; };
  let sc;
  if (opts.forceL) sc = build(opts.forceL);
  else if (opts.layout === "vertical" || allRows <= 2) sc = build(allRows); // two generations: always rows
  else if (opts.layout === "flex") {
    // the switch generation whose drawing is closest to √2 proportions
    for (let L = 1; L <= Math.max(1, maxGen); L++) {
      const c = build(L);
      const ratio = Math.max(c.bbox.w, c.bbox.h) / Math.max(1, Math.min(c.bbox.w, c.bbox.h));
      c.score = Math.abs(Math.log(ratio) - Math.log(Math.SQRT2));
      if (!sc || c.score < sc.score - 1e-9) sc = c;
    }
  } else if (opts._probe) {
    // balanced, decided on plain name boxes (see below)
    for (let L = allRows; L >= 1; L--) {
      sc = build(L);
      if (sc.bbox.w <= WIDE_RATIO * sc.bbox.h) break;
    }
    return sc;
  } else {
    // balanced: as many generations in rows as the width allows. The choice is made on plain name
    // boxes at the default size, so showing dates or photos, or a bigger font, never changes the shape.
    const probe = layoutTree(f, { ...DEFAULT_OPTS, siblingOrder: opts.siblingOrder, genderStyle: opts.genderStyle,
      fields: { photo: false, birth: false, death: false, note: false }, deathMark: "none", _probe: true }, measure);
    sc = build(probe.L);
  }
  sc.treeBox = { ...sc.bbox };
  // the title (a heading for plain designs; inside the decoration for decorated ones)
  const title = (opts.title || "").trim();
  const em = title ? measure(title, 700, "TD") : 0;
  sc.deco = theme.deco ? decorate(theme, sc.bbox, title, em) : plainTitle(theme, sc.bbox, title, em);
  if (sc.deco) sc.bbox = { ...sc.deco.bbox };
  return sc;
}
