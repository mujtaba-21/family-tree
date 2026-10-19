// Text measurement with the real font (needed so boxes fit their names exactly).
const cv = document.createElement("canvas");
const ctx = cv.getContext("2d");
const cache = new Map();

export function measure(text, weight = 500, family = "TS") {
  const key = family + "|" + weight + "|" + text;
  let w = cache.get(key);
  if (w === undefined) {
    ctx.font = `${weight} 100px ${family}`;
    w = ctx.measureText(text).width / 100;
    cache.set(key, w);
  }
  return w;
}

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('400 100px TS', "ابجد"),
      document.fonts.load('500 100px TS', "ابجد"),
      document.fonts.load('700 100px TS', "ابجد"),
      document.fonts.load('700 100px TD', "ابجد"),
    ]);
    await document.fonts.ready;
  } catch (e) { /* fonts are local; ignore */ }
  cache.clear();
}
