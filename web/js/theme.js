// App appearance: light, dark, or following the phone (the default).
import { state } from "./store.js";

const BAR = { light: "#F4EFE5", dark: "#171411" };
const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function scheme() {
  const a = (state.settings && state.settings.appearance) || "auto";
  if (a === "light" || a === "dark") return a;
  return mq && mq.matches ? "dark" : "light";
}

export function applyTheme() {
  const s = scheme();
  document.documentElement.dataset.theme = s;
  const bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute("content", BAR[s]);
  const cs = document.querySelector('meta[name="color-scheme"]');
  if (cs) cs.setAttribute("content", s);
}

if (mq && mq.addEventListener) mq.addEventListener("change", () => applyTheme());
