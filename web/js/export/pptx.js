// Tree -> PowerPoint (one slide, editable shapes). PowerPoint slides are at most 56 inches wide,
// so a larger tree is scaled down to fit.
import { boxColors, textColor, decoImage } from "../tree/render.js";

const MAX_IN = 56;
let loading = null;
function loadLib() {
  if (window.PptxGenJS) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "vendor/pptxgen.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return loading;
}

const hex = (c) => c.replace("#", "").toUpperCase();
const FONT = "thmanyah sans", TITLE_FONT = "thmanyah serif display";

function blobToDataURL(blob) {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
}

/** photos: Map(photoId -> Blob thumbnail). Returns {blob, scaled: factor (1 = real size)} */
export async function treeToPPTX(scene, { photos, title = "شجرة العائلة" } = {}) {
  await loadLib();
  const pptx = new window.PptxGenJS();
  const { x: X, y: Y, w: W, h: H } = scene.bbox;
  let s = 1 / 25.4; // mm -> inch
  const wIn = W * s, hIn = H * s;
  let scaled = 1;
  if (Math.max(wIn, hIn) > MAX_IN) { scaled = MAX_IN / Math.max(wIn, hIn); s *= scaled; }
  pptx.defineLayout({ name: "TREE", width: Math.max(1, W * s), height: Math.max(1, H * s) });
  pptx.layout = "TREE";
  pptx.title = title;
  pptx.rtlMode = true;
  const slide = pptx.addSlide();
  const T = scene.theme;
  slide.background = { color: hex(T.bg) };
  const ix = (v) => (v - X) * s, iy = (v) => (v - Y) * s;
  const pt = (mm) => Math.max(0.25, mm * scaled * 2.8346); // mm -> points (line widths, font sizes)
  const k = scene.k;
  const { genderStyle } = scene.opts;
  // decorated designs: background, frame and ornaments as one picture behind the tree; the title stays text
  if (scene.deco) {
    const data = await blobToDataURL(await decoImage(scene));
    slide.addImage({ data, x: 0, y: 0, w: W * s, h: H * s });
    for (const t of scene.deco.texts) {
      const tw = t.fs * Math.max(4, t.t.length * 0.62);
      slide.addText(t.t, {
        x: ix(t.x - tw / 2), y: iy(t.y - t.fs * 1.05), w: tw * s, h: t.fs * 1.5 * s,
        fontFace: TITLE_FONT, fontSize: pt(t.fs) * 0.98, bold: true, color: hex(t.fill),
        align: "center", valign: "middle", margin: 0, rtlMode: true, lang: "ar-SA", fit: "none", wrap: false,
      });
    }
  }

  const seg = (a, b, color, widthMM, dash) => {
    const x1 = ix(a[0]), y1 = iy(a[1]), x2 = ix(b[0]), y2 = iy(b[1]);
    slide.addShape(pptx.ShapeType.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(0.0001, Math.abs(x2 - x1)), h: Math.max(0.0001, Math.abs(y2 - y1)),
      flipV: (x2 - x1) * (y2 - y1) < 0,
      line: { color: hex(color), width: pt(widthMM), dashType: dash ? "dash" : "solid" },
    });
  };
  const poly = (pts, color, widthMM, dash) => { for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], color, widthMM, dash); };
  for (const l of scene.lines) poly(l, T.line, 0.32 * k);
  for (const l of scene.marr) poly(l, T.accent, 0.5 * k);
  for (const l of scene.links) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
      pts.push([a * l.p0[0] + b * l.c0[0] + c * l.c1[0] + d * l.p1[0], a * l.p0[1] + b * l.c0[1] + c * l.c1[1] + d * l.p1[1]]);
    }
    poly(pts, T.accent, 0.55 * k, true);
  }

  for (const b of scene.boxes) {
    const round = genderStyle && b.g === "f";
    const st = boxColors(scene, b);
    const fill = st.fill === "none" ? null : st.fill, stroke = st.stroke, sw = st.sw, text = st.text;
    const dash = st.dash ? "dash" : "solid";
    const textLeftPad = b.style === "ref" ? b.pad : 0, textRightPad = b.photo ? b.pad : 0;
    const runs = [];
    const shown = b.lines.filter((l) => l.t);
    shown.forEach((l, i) => {
      runs.push({ text: l.t, options: {
        fontFace: FONT, fontSize: pt(l.fs) * 0.98, bold: l.wt >= 700,
        color: hex(textColor(scene, l) || text),
        breakLine: i < shown.length - 1, rtlMode: true, lang: "ar-SA",
      } });
    });
    // the frame
    slide.addShape(round ? pptx.ShapeType.roundRect : genderStyle ? pptx.ShapeType.rect : pptx.ShapeType.roundRect, {
      x: ix(b.x), y: iy(b.y), w: b.w * s, h: b.h * s,
      fill: fill ? { color: hex(fill) } : { type: "none" },
      line: { color: hex(stroke), width: pt(sw), dashType: dash },
      rectRadius: round ? Math.min(b.w, b.h) * s / 2 : genderStyle ? undefined : 1.4 * k * s,
    });
    // the text (a separate text box so it can be edited directly)
    if (runs.length) {
      slide.addText(runs, {
        x: ix(b.x + textLeftPad), y: iy(b.y), w: (b.w - textLeftPad - textRightPad) * s, h: b.h * s,
        align: "center", valign: "middle", margin: 0, rtlMode: true, fit: "none", wrap: false,
      });
    }
    if (b.style === "ref") {
      const bx = b.x + (round ? 3.4 * k : 2.7 * k), by = b.y + b.h / 2, r = 1.85 * k;
      slide.addText(b.refNum || "", {
        shape: pptx.ShapeType.ellipse, x: ix(bx - r), y: iy(by - r), w: 2 * r * s, h: 2 * r * s,
        fill: { color: hex(T.accent) }, color: hex(T.onAccent), fontFace: FONT, fontSize: pt(2.7 * k), bold: true, align: "center", valign: "middle", margin: 0,
      });
    }
    if (b.photo && photos && photos.get(b.photo)) {
      const size = b.h - 1.6 * k;
      const data = await blobToDataURL(photos.get(b.photo));
      slide.addImage({ data, x: ix(b.x + b.w - 0.8 * k - size), y: iy(b.y + 0.8 * k), w: size * s, h: size * s, rounding: round });
    }
  }
  const blob = await pptx.write({ outputType: "blob", compression: true });
  return { blob, scaled };
}
