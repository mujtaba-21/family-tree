// Screen 5: search the family by name (quad names in results).
import { h, icon, ar } from "../util.js";
import { appBar, screen } from "./kit.js";
import { personHash } from "./common.js";
import { thumbURL, state } from "../store.js";
import * as M from "../model.js";
import * as D from "../dates.js";

const GEN = ["الجد الجامع", "الجيل الأول", "الجيل الثاني", "الجيل الثالث", "الجيل الرابع", "الجيل الخامس", "الجيل السادس", "الجيل السابع", "الجيل الثامن", "الجيل التاسع", "الجيل العاشر"];

function resultRow(f, id) {
  const p = f.persons[id];
  const { names, fam } = M.lineage(f, id);
  const nick = M.nickOf(f, id);
  const first = names[0] === "…" ? nick || (p.gender === "f" ? "غير معروفة" : "غير معروف") : names[0];
  const three = [first, ...names.slice(1, 3)];
  const typed = id === f.rootId || !M.isDesc(f, id);
  const given = typed ? M.typedFullName(three, "", p.gender) : three.join(" ");
  let sub;
  if (M.isDesc(f, id)) {
    const g = M.genOf(f, id);
    sub = GEN[g] || `الجيل ${ar(g)}`;
    if (p.birth && p.birth.y) sub += `، مواليد ${D.formatPair(p.birth, state.settings.calendar)[0]}`;
  } else {
    const sp = M.unionsOf(f, id).map((u) => M.spouseIn(u, id)).filter(Boolean)[0];
    sub = sp ? `${p.gender === "f" ? "زوجة" : "زوج"} ${M.quadName(f, sp)}` : "من خارج العائلة";
  }
  if (nick && names[0] !== "…") sub = `${nick}، ${sub}`;
  const dot = h("div", { class: "dot " + p.gender });
  if (p.mainPhoto) thumbURL(p.mainPhoto).then((u) => { if (u) dot.replaceChildren(h("img", { src: u, alt: "" })); });
  return h("a", { class: "res", href: personHash(f, id) }, dot,
    h("div", { class: "t" }, h("b", null, given, fam ? h("i", null, " " + fam) : null), h("span", null, sub)));
}

export function searchScreen(f) {
  const q = h("input", { placeholder: "اكتب الاسم، ثم اسم الأب إن أردت", autocomplete: "off", enterkeyhint: "search", "aria-label": "بحث" });
  const count = h("div", { class: "sec-t" });
  const list = h("div", { class: "card", style: { padding: "2px 12px", display: "none" } });
  const run = () => {
    const ids = M.search(f, q.value).slice(0, 80);
    list.style.display = ids.length ? "" : "none";
    count.textContent = !q.value.trim() ? "" : ids.length ? (ids.length === 1 ? "نتيجة واحدة" : ids.length === 2 ? "نتيجتان" : `${ar(ids.length)} ${ids.length <= 10 ? "نتائج" : "نتيجة"}`) : "لا يوجد أحد بهذا الاسم.";
    list.replaceChildren(...ids.map((id) => resultRow(f, id)));
    try { sessionStorage.setItem("search:" + f.id, q.value); } catch (e) { /* ignore */ }
  };
  q.addEventListener("input", run);
  try { q.value = sessionStorage.getItem("search:" + f.id) || ""; } catch (e) { /* ignore */ }
  run();
  setTimeout(() => q.focus(), 80);
  return screen(
    appBar({ title: `البحث في ${f.name}`, back: true }),
    h("main", { class: "body" },
      h("div", { class: "sbar" }, icon("search"), q),
      count, list,
      !q.value ? h("div", { class: "hint" }, "مثال: «محمد» لكل من اسمه محمد، أو «محمد علي» لمن اسمه محمد واسم أبيه علي، أو «أبو محمد» بالكنية.") : null,
    ),
  );
}
