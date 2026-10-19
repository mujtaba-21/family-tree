// Old paper for «الرَّق القديم»: the sheet itself (warm uneven tone and darker, irregular aged edges)
// as one picture stretched over the board, and a fine grain of fibres repeated over it.
// Both are made on the fly with gradient noise, and kept for the sizes already made.

const LONG_SIDE = 420;     // pixels along the longer side of the sheet picture (it is smooth, so it scales up well)
const GRAIN_PX = 192;      // the grain tile, in pixels
export const GRAIN_MM = 26; // …and its size on paper

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/** 2D gradient noise in about [-1, 1]; period (in lattice cells) makes it tile. */
function noise(seed) {
  const R = rng(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (hh, x, y) => {
    switch (hh & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y, period = 0) => {
    const X = Math.floor(x), Y = Math.floor(y);
    const xf = x - X, yf = y - Y;
    const w = (v) => (period ? ((v % period) + period) % period : v) & 255;
    const X0 = w(X), X1 = w(X + 1), Y0 = w(Y), Y1 = w(Y + 1);
    const u = fade(xf), v = fade(yf);
    const a = grad(p[p[X0] + Y0], xf, yf), b = grad(p[p[X1] + Y0], xf - 1, yf);
    const c = grad(p[p[X0] + Y1], xf, yf - 1), d = grad(p[p[X1] + Y1], xf - 1, yf - 1);
    return ((a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v) * 0.72;
  };
}
function fbm(n, x, y, oct, period = 0) {
  let s = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * n(x * f, y * f, period ? period * f : 0);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const sheets = new Map();
/** The sheet for a board of w × h mm: {canvas, url()} (url is made once, when first asked for). */
export function paperSheet(wmm, hmm) {
  const key = `${Math.round(wmm)}x${Math.round(hmm)}`;
  if (sheets.has(key)) return sheets.get(key);
  const sc = LONG_SIDE / Math.max(wmm, hmm);
  const W = Math.max(8, Math.round(wmm * sc)), H = Math.max(8, Math.round(hmm * sc));
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(W, H);
  const nTone = noise(11), nEdge = noise(23), nFine = noise(37), nStain = noise(53);
  const band = Math.max(14, Math.min(wmm, hmm) * 0.075);  // how far the aged edge reaches (mm)
  const base = [244, 232, 206], light = [249, 241, 222], dark = [229, 211, 175], aged = [176, 132, 74], burnt = [120, 84, 44];
  let i = 0;
  for (let j = 0; j < H; j++) {
    const ym = (j + 0.5) / sc;
    for (let k = 0; k < W; k++) {
      const xm = (k + 0.5) / sc;
      // the paper's own uneven tone, in soft patches
      const tone = fbm(nTone, xm / 110, ym / 110, 4);
      let r, g, b;
      if (tone > 0) { r = mix(base[0], light[0], tone); g = mix(base[1], light[1], tone); b = mix(base[2], light[2], tone); }
      else { r = mix(base[0], dark[0], -tone * 0.9); g = mix(base[1], dark[1], -tone * 0.9); b = mix(base[2], dark[2], -tone * 0.9); }
      // a few faint water stains
      const st = smooth(0.32, 0.6, fbm(nStain, xm / 70, ym / 70, 3));
      if (st > 0) { r = mix(r, dark[0], st * 0.5); g = mix(g, dark[1], st * 0.5); b = mix(b, dark[2], st * 0.5); }
      // the aged edge: darker towards the sides, reaching in unevenly
      const d = Math.min(xm, wmm - xm, ym, hmm - ym);
      const e = d / band + fbm(nEdge, xm / 38, ym / 38, 3) * 0.55 + fbm(nFine, xm / 7, ym / 7, 2) * 0.12;
      const age = Math.pow(1 - smooth(0, 1.15, e), 1.7);
      r = mix(r, aged[0], age * 0.62); g = mix(g, aged[1], age * 0.62); b = mix(b, aged[2], age * 0.62);
      const scorch = 1 - smooth(-0.1, 0.32, e);
      if (scorch > 0) { r = mix(r, burnt[0], scorch * 0.55); g = mix(g, burnt[1], scorch * 0.55); b = mix(b, burnt[2], scorch * 0.55); }
      img.data[i++] = r; img.data[i++] = g; img.data[i++] = b; img.data[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  let url = null;
  const sheet = { canvas: cv, url: () => url || (url = cv.toDataURL("image/jpeg", 0.9)) };
  if (sheets.size >= 8) sheets.delete(sheets.keys().next().value); // keep only the latest sizes
  sheets.set(key, sheet);
  return sheet;
}

let grainTile = null;
/** The repeating grain: fine specks and a few fibres, dark on transparent. {canvas, url()} */
export function paperGrain() {
  if (grainTile) return grainTile;
  const N = GRAIN_PX;
  const cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(N, N);
  const n1 = noise(71), n2 = noise(89);
  const R = rng(97);
  let i = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // soft mottle that tiles (period = cells across the tile), plus single-pixel specks
      const m = fbm(n1, (x / N) * 8, (y / N) * 8, 3, 8);
      const f = n2((x / N) * 32, (y / N) * 32, 32);
      let a = Math.max(0, m * 0.5 + f * 0.35) * 46;
      if (R() < 0.012) a += 40 + R() * 40;
      img.data[i++] = 92; img.data[i++] = 66; img.data[i++] = 36; img.data[i++] = Math.min(255, a);
    }
  }
  ctx.putImageData(img, 0, 0);
  // fibres: short thin curves, drawn on all sides so the tile repeats without seams
  ctx.lineCap = "round";
  for (let n = 0; n < 16; n++) {
    const x0 = R() * N, y0 = R() * N, ang = R() * Math.PI, len = 22 + R() * 40, bend = (R() - 0.5) * 7;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const mx = (x0 + x1) / 2 - Math.sin(ang) * bend, my = (y0 + y1) / 2 + Math.cos(ang) * bend;
    ctx.strokeStyle = `rgba(92,66,36,${0.04 + R() * 0.05})`;
    ctx.lineWidth = 0.4 + R() * 0.5;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      ctx.beginPath(); ctx.moveTo(x0 + ox, y0 + oy); ctx.quadraticCurveTo(mx + ox, my + oy, x1 + ox, y1 + oy); ctx.stroke();
    }
  }
  let url = null;
  grainTile = { canvas: cv, url: () => url || (url = cv.toDataURL("image/png")) };
  return grainTile;
}
