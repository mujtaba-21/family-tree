// Screen 2: the person card — the centre of the app.
import { h, icon, ar } from "../util.js";
import { appBar, screen, sheet, help, menu, confirm, toast } from "./kit.js";
import { chip, photoBox, miniPhoto, dateLines, rahmaText, isDeceased, personHash } from "./common.js";
import * as M from "../model.js";
import * as store from "../store.js";

function countWord(n, forms) {
  const [one, two, few, many] = forms;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${ar(n)} ${few}`;
  return `${ar(n)} ${many}`;
}
const SONS = ["ابن", "ابنان", "أبناء", "ابنًا"];
const DAUGHTERS = ["بنت", "بنتان", "بنات", "بنتًا"];
const GRAND = ["حفيد", "حفيدان", "أحفاد", "حفيدًا"];
const ORD = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const joinAnd = (parts) => parts.join(" و");

function descSummary(f, pid, ds) {
  const kids = M.unionsOf(f, pid).flatMap((u) => u.kids).filter((id) => f.persons[id] && !f.persons[id].blank);
  const sons = kids.filter((id) => f.persons[id].gender === "m").length;
  const daughters = kids.length - sons;
  const parts = [];
  if (sons) parts.push(countWord(sons, SONS));
  if (daughters) parts.push(countWord(daughters, DAUGHTERS));
  if (ds.byGen[2]) parts.push(countWord(ds.byGen[2], GRAND));
  let s = joinAnd(parts);
  if (ds.byGen.length > 3) s += " وذريتهم";
  return s;
}

function statsBlock(f, pid) {
  const p = f.persons[pid];
  const ds = M.descendants(f, pid);
  if (!ds.total) return null;
  const tiles = [];
  tiles.push(h("button", { class: "st", onclick: () => descSheet(f, pid, ds) },
    h("b", null, ar(ds.total)), h("span", { class: "row", style: { gap: "5px" } }, "من النسل"), h("em", null, descSummary(f, pid, ds) + " ‹")));
  const seen = M.seenDescendants(f, pid);
  if (seen) {
    const fem = p.gender === "f";
    const unk = seen.unknown;
    const unkText = unk === 0 ? "" : unk === 1 ? "واحد لم يُحسم ‹" : unk === 2 ? "اثنان لم يُحسما ‹" : `${ar(unk)} لم يُحسموا لنقص التواريخ ‹`;
    const none = seen.seen === 0 && seen.notSeen === 0;
    tiles.push(h("button", { class: "st", onclick: () => seenSheet(f, pid, seen) },
      none ? h("b", null, h("small", null, "لم يُحسب بعد")) : h("b", null, ar(seen.seen), unk ? h("small", null, " على الأقل") : null),
      h("span", null, fem ? "رأت منهم" : "رأى منهم"),
      none ? h("em", null, "أدخل تواريخ ميلاد ذريته ‹") : unk ? h("em", null, unkText) : h("em", null, "حسب التواريخ ‹")));
  }
  return h("div", { class: "stats", style: tiles.length === 1 ? { gridTemplateColumns: "1fr" } : null }, ...tiles);
}

function descSheet(f, pid, ds) {
  sheet((close) => h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
    h("h3", { class: "row", style: { gap: "8px" } }, `نسل ${M.headName(f, pid) || "هذه الخانة"}: ${ar(ds.total)}`, help("descendants")),
    h("div", { class: "list-plain" },
      ...ds.byGen.map((n, g) => (g === 0 || !n ? null : h("div", { class: "li" },
        g === 1 ? "الأبناء والبنات" : g === 2 ? "الأحفاد" : `الجيل ${ORD[g] || ar(g)}`, h("span", null, ar(n)))))),
    h("button", { class: "btn plain", onclick: close }, "إغلاق"),
  ));
}

function seenSheet(f, pid, seen) {
  const fem = f.persons[pid].gender === "f";
  sheet((close) => h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
    h("h3", { class: "row", style: { gap: "8px" } }, fem ? "من رأت من نسلها" : "من رأى من نسله", help("seen")),
    h("div", { class: "list-plain" },
      h("div", { class: "li" }, fem ? "وُلدوا في حياتها" : "وُلدوا في حياته", h("span", null, ar(seen.seen))),
      h("div", { class: "li" }, fem ? "وُلدوا بعد وفاتها" : "وُلدوا بعد وفاته", h("span", null, ar(seen.notSeen))),
      h("div", { class: "li" }, "غير محسوم لنقص التواريخ", h("span", null, ar(seen.unknown)))),
    seen.unknown ? h("p", null, "أكمل تواريخ هؤلاء لتصير النتيجة دقيقة:") : null,
    seen.unknown ? h("div", { class: "row" }, ...seen.unknownIds.map((id) => chip(f, id, { label: M.quadName(f, id) }))) : null,
    h("button", { class: "btn plain", onclick: close }, "إغلاق"),
  ));
}

function orderSheet(f, u, rerender) {
  sheet((close) => {
    const list = h("div");
    const draw = () => {
      list.replaceChildren(...u.kids.map((k, i) => h("div", { class: "order-row" },
        h("span", { class: "n" }, `${ar(i + 1)}. ${M.headName(f, k) || "—"}`),
        h("button", { class: "ib solid", "aria-label": "تقديم", disabled: i === 0, onclick: () => { M.moveChild(f, u.id, k, -1); store.changed(); draw(); } }, icon("up")),
        h("button", { class: "ib solid", "aria-label": "تأخير", disabled: i === u.kids.length - 1, onclick: () => { M.moveChild(f, u.id, k, 1); store.changed(); draw(); } }, icon("down")),
      )));
    };
    draw();
    return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
      h("h3", { class: "row", style: { gap: "8px" } }, "ترتيب الأبناء من الأكبر", help("reorder")),
      list,
      h("button", { class: "btn primary", onclick: () => { close(); rerender(); } }, "تم"),
    );
  });
}

function unionCard(f, pid, u, rerender) {
  const p = f.persons[pid];
  const other = M.spouseIn(u, pid);
  const tools = h("div", { class: "unit-tools" });
  let header;
  if (other && f.persons[other]) {
    const o = f.persons[other];
    const fromFamily = M.isDesc(f, other);
    header = h("a", { class: "spouse-h", href: personHash(f, other) },
      miniPhoto(f, other),
      h("div", { class: "n" }, M.headName(f, other) || "—", h("small", null, M.fullName(f, other))),
      h("span", { class: "tag" + (fromFamily ? "" : " out") }, fromFamily ? "من العائلة" : "من خارج العائلة"));
  } else {
    header = h("div", { class: "spouse-h" },
      h("div", { class: "mini-photo none" }),
      h("div", { class: "n" }, p.gender === "m" ? "أبناء لم تُحدَّد أمهم" : "أبناء لم يُحدَّد أبوهم", h("small", null, "تستطيع تحديد ذلك عند الإضافة")),
      help("unknownParent"));
  }
  const kids = u.kids.map((k) => chip(f, k));
  const addKids = h("a", { class: "addkids", href: `${personHash(f, pid)}/kids/${u.id}` }, icon("plus"), "أبناء");
  const moreBtn = h("button", { class: "ib", "aria-label": "خيارات", style: { width: "36px", height: "36px" } }, icon("more"));
  const hasOptions = u.kids.length > 1 || (!u.kids.length && other);
  moreBtn.addEventListener("click", () => {
    const items = [];
    if (u.kids.length > 1) items.push({ label: "ترتيب الأبناء", icon: "sort", onclick: () => orderSheet(f, u, rerender) });
    if (!u.kids.length && other) items.push({ label: "حذف الزواج", icon: "trash", danger: true, onclick: async () => {
      const ok = await confirm({ title: "حذف هذا الزواج؟", text: "يُلغى الزواج فقط ولا يُحذف أي شخص من العائلة. ومن كان من خارج العائلة ولا رابط آخر له يُحذف معه.", ok: "حذف الزواج", danger: true });
      if (!ok) return;
      M.removeUnion(f, u.id);
      store.changed();
      toast("حُذف الزواج");
      rerender();
    } });
    menu(moreBtn, items);
  });
  if (hasOptions) tools.append(moreBtn);
  return h("div", { class: "card" },
    h("div", { style: { display: "flex", alignItems: "flex-start", gap: "6px" } }, h("div", { style: { flex: 1, minWidth: 0 } }, header), tools),
    h("div", { class: "row" }, ...kids, addKids));
}

export function personScreen(f, pid, rerender) {
  const p = f.persons[pid];
  const k = M.kind(f, pid);
  store.setLastPerson(f.id, pid);
  const fem = p.gender === "f";

  const hero = h("div", { class: "card" },
    h("div", { class: "hero" },
      photoBox(f, pid),
      h("div", { style: { flex: 1, minWidth: 0 } },
        k === "blank"
          ? h("div", { class: "pname small muted row", style: { gap: "8px" } }, "خانة فارغة", help("blank"))
          : h("div", { class: "pname" + (M.headName(f, pid).length > 9 ? " small" : "") }, M.headName(f, pid)),
        h("div", { class: "pfull" }, M.fullName(f, pid)),
        ...dateLines(p),
        isDeceased(p) && k !== "blank" ? h("div", { class: "rahm" }, rahmaText(p)) : null,
      ),
      h("a", { class: "ib solid", href: `${personHash(f, pid)}/edit`, "aria-label": "تعديل", style: { alignSelf: "flex-start" } }, icon("edit")),
    ),
    statsBlock(f, pid),
  );

  const sections = [];
  if (k === "desc" || k === "blank") {
    if (k !== "root") {
      const pu = M.parentUnion(f, pid);
      if (pu) {
        const parentCell = (label, id) => h("div", { class: "card pp" }, h("b", null, label),
          id && f.persons[id] ? chip(f, id) : h("span", { class: "muted", style: { fontSize: "14px" } }, "غير مسجل"));
        sections.push(h("section", null, h("div", { class: "sec-t" }, "الوالدان"),
          h("div", { class: "parents" }, parentCell("الأب", pu.h), parentCell("الأم", pu.w))));
      }
    }
    const sibs = M.siblings(f, pid);
    if (sibs.length > 1) {
      sections.push(h("section", null,
        h("div", { class: "sec-t" }, h("span", null, "الإخوة والأخوات، من الأكبر"), h("span", null, ar(sibs.length))),
        h("div", { class: "strip" }, ...sibs.map((s) => chip(f, s, { current: s === pid })))));
    }
  }

  // marriages first (in order), children with an unrecorded parent last
  const unions = [...M.unionsOf(f, pid)].sort((a, b) => (M.spouseIn(a, pid) ? 0 : 1) - (M.spouseIn(b, pid) ? 0 : 1) || a.order - b.order);
  const marriages = unions.filter((u) => M.spouseIn(u, pid)).length;
  if (k === "spouse") {
    sections.push(h("section", null, h("div", { class: "sec-t" }, unions.length > 1 ? "الزيجات والأبناء" : "الزواج والأبناء"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, ...unions.map((u) => unionCard(f, pid, u, rerender)))));
  } else {
    const title = !marriages ? "الأبناء" : fem ? (marriages > 1 ? "الأزواج والأبناء" : "الزوج والأبناء") : (marriages > 1 ? "الزوجات والأبناء" : "الزوجة والأبناء");
    const addSpouse = h("a", { class: "btn ghost", href: `${personHash(f, pid)}/spouse` }, icon("plus"), fem ? "زوج" : "زوجة");
    const body = [];
    if (unions.length) body.push(...unions.map((u) => unionCard(f, pid, u, rerender)));
    const btns = [addSpouse];
    if (!unions.length) btns.push(h("a", { class: "btn ghost", href: `${personHash(f, pid)}/kids/new` }, icon("plus"), "أبناء"));
    if (k === "blank") {
      // an empty slot keeps its children, nothing new is added to it
    } else body.push(h("div", { class: "btn-row" }, ...btns));
    if (!unions.length && k === "root") {
      body.unshift(h("div", { class: "tip" }, "ابدأ بإضافة زوجة الجد ثم أبنائه منها. وإن لم تعرف زوجته فأضف أبناءه مباشرة، وتحدد أمهم لاحقًا."));
    }
    if (unions.length || k !== "blank") sections.push(h("section", null, unions.length ? h("div", { class: "sec-t" }, h("span", null, title), marriages > 1 ? h("span", null, ar(marriages)) : null) : null,
      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, ...body)));
  }

  return screen(
    appBar({
      title: f.name, back: true,
      actions: [
        { icon: "search", label: "بحث", onclick: () => (location.hash = `#/f/${f.id}/search`) },
        { icon: "tree", label: "شجرة العائلة", onclick: () => (location.hash = `#/f/${f.id}/tree/${pid}`) },
        { icon: "home", label: "الجد الجامع", onclick: () => (location.hash = personHash(f, f.rootId)) },
      ],
    }),
    h("main", { class: "body" }, hero, ...sections),
  );
}
