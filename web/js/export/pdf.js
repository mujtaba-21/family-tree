// Tree -> PDF at the drawing's real size. The tree is rendered in tiles at print resolution and
// stored losslessly (Flate), so names stay sharp; no external library is needed.
import { drawCanvas } from "../tree/render.js";

const MM_TO_PT = 72 / 25.4;
const enc = new TextEncoder();

async function deflate(bytes) {
  const cs = new CompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function utf16Hex(s) {
  let out = "FEFF";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c > 0xffff) {
      const v = c - 0x10000;
      out += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
    } else out += c.toString(16).padStart(4, "0");
  }
  return `<${out.toUpperCase()}>`;
}

/**
 * scene: from layoutTree. images: Map(photoId -> ImageBitmap). onProgress(fraction).
 * Returns {blob, dpi, widthMM, heightMM}.
 */
export async function treeToPDF(scene, { images, title = "شجرة العائلة", onProgress } = {}) {
  const { x, y, w, h } = scene.bbox;
  // resolution: 300 dpi, lowered for very large drawings to keep memory reasonable on phones
  const maxPixels = 90e6;
  let dpi = 300;
  const areaIn2 = (w / 25.4) * (h / 25.4);
  if (areaIn2 * dpi * dpi > maxPixels) dpi = Math.max(120, Math.floor(Math.sqrt(maxPixels / areaIn2)));
  const pxPerMM = dpi / 25.4;
  const Wpx = Math.ceil(w * pxPerMM), Hpx = Math.ceil(h * pxPerMM);
  const TILE = 2048;
  const cols = Math.ceil(Wpx / TILE), rows = Math.ceil(Hpx / TILE);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const tiles = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tw = Math.min(TILE, Wpx - c * TILE), th = Math.min(TILE, Hpx - r * TILE);
      canvas.width = tw; canvas.height = th;
      const oxmm = x + (c * TILE) / pxPerMM, oymm = y + (r * TILE) / pxPerMM;
      drawCanvas(ctx, scene, { scale: pxPerMM, ox: oxmm, oy: oymm, wmm: tw / pxPerMM, hmm: th / pxPerMM, images });
      const rgba = ctx.getImageData(0, 0, tw, th).data;
      const rgb = new Uint8Array(tw * th * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]; }
      const data = await deflate(rgb);
      tiles.push({ c, r, tw, th, data });
      n++;
      if (onProgress) onProgress(n / (rows * cols));
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  canvas.width = canvas.height = 1;

  // ---- assemble the PDF
  let Wpt = w * MM_TO_PT, Hpt = h * MM_TO_PT;
  let unit = 1;
  if (Math.max(Wpt, Hpt) > 14400) unit = Math.ceil(Math.max(Wpt, Hpt) / 14400); // PDF size limit -> UserUnit
  Wpt /= unit; Hpt /= unit;
  const ptPerPx = Wpt / Wpx;
  const parts = [];
  let offset = 0;
  const offsets = [];
  const push = (chunk) => { const b = typeof chunk === "string" ? enc.encode(chunk) : chunk; parts.push(b); offset += b.length; };
  const obj = (num, body, stream) => {
    offsets[num] = offset;
    push(`${num} 0 obj\n${body}\n`);
    if (stream) { push("stream\n"); push(stream); push("\nendstream\n"); }
    push("endobj\n");
  };
  push("%PDF-1.6\n%\xE2\xE3\xCF\xD3\n");
  const firstImg = 6;
  let content = "";
  let xobjs = "";
  tiles.forEach((t, i) => {
    const name = `Im${i}`;
    xobjs += `/${name} ${firstImg + i} 0 R `;
    const pw = t.tw * ptPerPx, ph = t.th * ptPerPx;
    const px = t.c * 2048 * ptPerPx;
    const py = Hpt - t.r * 2048 * ptPerPx - ph;
    content += `q ${pw.toFixed(4)} 0 0 ${ph.toFixed(4)} ${px.toFixed(4)} ${py.toFixed(4)} cm /${name} Do Q\n`;
  });
  const contentBytes = await deflate(enc.encode(content));
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${Wpt.toFixed(3)} ${Hpt.toFixed(3)}]${unit > 1 ? ` /UserUnit ${unit}` : ""} /Resources << /XObject << ${xobjs}>> >> /Contents 4 0 R >>`);
  obj(4, `<< /Length ${contentBytes.length} /Filter /FlateDecode >>`, contentBytes);
  obj(5, `<< /Title ${utf16Hex(title)} /Producer (Shajara) >>`);
  tiles.forEach((t, i) => {
    obj(firstImg + i, `<< /Type /XObject /Subtype /Image /Width ${t.tw} /Height ${t.th} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${t.data.length} >>`, t.data);
  });
  const count = firstImg + tiles.length;
  const xref = offset;
  let xr = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) xr += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(xr);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return { blob: new Blob(parts, { type: "application/pdf" }), dpi, widthMM: w, heightMM: h };
}
