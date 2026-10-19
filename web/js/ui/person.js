// Screen 2: the person card — the centre of the app.
import { h, icon, ar } from "../util.js";
import { appBar, screen, sheet, help, menu, confirm, toast } from "./kit.js";
import { chip, photoBox, miniPhoto, dateLines, rahmaText, isDeceased, personHash, displayName } from "./common.js";
import { familySheet } from "./familySheet.js";
import { sortableRow } from "./sortable.js";
import { nextBar } from "./nextBar.js";
import * as nav from "../nav.js";
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

/** Re-order children: the arrows, or press and hold a row and drag it. onChange redraws the card behind. */
function orderSheet(f, u, onChange) {
  sheet((close) => {
    const list = h("div", { class: "order-list" });
    const commit = (kids) => { M.setKidsOrder(f, u.id, kids); store.changed(); draw(); onChange(); };
    const moveTo = (from, to) => {
      if (from === to) return;
      const kids = [...u.kids];
      const [k] = kids.splice(from, 1);
      kids.splice(to, 0, k);
      commit(kids);
    };
    const row = (k, i) => {
      const el = h("div", { class: "order-row" },
        h("span", { class: "grip", "aria-hidden": "true" }, "⠿"),
        h("span", { class: "n" }, `${ar(i + 1)}. ${displayName(f, k)}`),
        h("button", { class: "ib solid", "aria-label": "تقديم", disabled: i === 0, onclick: () => moveTo(i, i - 1) }, icon("up")),
        h("button", { class: "ib solid", "aria-label": "تأخير", disabled: i === u.kids.length - 1, onclick: () => moveTo(i, i + 1) }, icon("down")),
      );
      sortableRow(el, list, moveTo);
      return el;
    };
    const draw = () => list.replaceChildren(...u.kids.map(row));
    draw();
    return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
      h("h3", { class: "row", style: { gap: "8px" } }, "ترتيب الأبناء من الأكبر", help("reorder")),
      list,
      h("button", { class: "btn primary", onclick: close }, "تم"),
    );
  });
}

// The child whose own family is unfolded on the card (one at a time), remembered while the app is open.
const openKid = new Map(); // familyId -> person id

const marriagesFirst = (f, pid) => [...M.unionsOf(f, pid)].sort((a, b) => (M.spouseIn(a, pid) ? 0 : 1) - (M.spouseIn(b, pid) ? 0 : 1) || a.order - b.order);

/** A child's own family, shown when its row is unfolded: each marriage with its children, and "+" buttons. */
function kidFamily(f, k, refresh) {
  const p = f.persons[k], fem = p.gender === "f";
  const unions = marriagesFirst(f, k);
  const out = [];
  for (const u of unions) {
    const o = M.spouseIn(u, k);
    const head = o && f.persons[o]
      ? [h("span", { class: "kf-l" }, fem ? "زوجها" : "زوجته"), chip(f, o)]
      : [h("span", { class: "kf-none" }, fem ? "أبناء لم يُسجَّل أبوهم" : "أبناء لم تُسجَّل أمهم")];
    const addK = h("button", { class: "mini-add", type: "button", onclick: () => familySheet(f, k, { unionId: u.id, onSaved: refresh }) }, icon("plus"), "أبناء");
    out.push(h("div", { class: "kf-u" },
      h("div", { class: "kf-sp" }, ...head),
      h("div", { class: "kf-kids" }, ...u.kids.map((c) => chip(f, c)), addK)));
  }
  const married = unions.some((u) => M.spouseIn(u, k));
  out.push(h("button", { class: "mini-add", type: "button", onclick: () => familySheet(f, k, { onSaved: refresh }) },
    icon("plus"), married ? "زواج آخر" : fem ? "زوج وأبناء" : "زوجة وأبناء"));
  return h("div", { class: "kf" }, ...out);
}

/** «زوجته فاطمة»، «زوجتاه فاطمة وزينب»، «أزواجها …» */
function spouseLine(f, k, spouses) {
  if (!spouses.length) return "";
  const fem = f.persons[k].gender === "f";
  const n = spouses.length;
  const word = fem ? (n === 1 ? "زوجها" : n === 2 ? "زوجاها" : "أزواجها") : (n === 1 ? "زوجته" : n === 2 ? "زوجتاه" : "زوجاته");
  return `${word} ${joinAnd(spouses.map((s) => displayName(f, s)))}`;
}

/** A child on the card: the name (opens its card), its spouse, and a fold that shows its own family.
 *  With no marriage yet there is nothing to unfold: «+» (or a tap on the row) opens the family sheet. */
function kidRow(f, k, refresh) {
  const p = f.persons[k];
  if (!p) return null;
  const row = h("div", { class: "kid" });
  if (p.blank) { row.append(h("div", { class: "kid-line" }, chip(f, k))); return row; }
  const unions = M.unionsOf(f, k);
  const count = unions.reduce((a, u) => a + u.kids.length, 0);
  const spouses = unions.map((u) => M.spouseIn(u, k)).filter((x) => x && f.persons[x]);
  const sub = [spouseLine(f, k, spouses), p.noKids && !count ? (p.gender === "f" ? "ليس لها أبناء" : "ليس له أبناء") : ""].filter(Boolean).join("، ");
  const fem = p.gender === "f";

  if (!unions.length) {
    const add = h("button", { class: "kid-pill add", type: "button", "aria-label": `${fem ? "زوج وأبناء" : "زوجة وأبناء"} لـ${displayName(f, k)}` }, icon("plus"));
    const line = h("div", { class: "kid-line" }, chip(f, k), h("span", { class: "kid-sub" }, sub), add);
    line.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest("a.chip")) return;
      familySheet(f, k, { onSaved: () => { openKid.set(f.id, k); refresh(); } });
    });
    row.append(line);
    return row;
  }

  const isOpen = () => openKid.get(f.id) === k;
  const pill = h("button", { class: "kid-pill", type: "button", "aria-expanded": String(isOpen()), "aria-label": `أسرة ${displayName(f, k)}` },
    count ? h("span", null, ar(count)) : null, icon("down"));
  const line = h("div", { class: "kid-line" }, chip(f, k), h("span", { class: "kid-sub" }, sub), pill);
  const body = h("div", { class: "kid-body" }, h("div", { class: "kid-inner" }, kidFamily(f, k, refresh)));
  row.append(line, body);
  const setOpen = (on) => {
    row.classList.toggle("open", on);
    pill.setAttribute("aria-expanded", String(on));
    body.inert = !on;
  };
  line.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("a.chip")) return; // the name opens the child's card
    const on = !isOpen();
    if (on) openKid.set(f.id, k); else openKid.delete(f.id);
    for (const other of document.querySelectorAll(".kid.open")) if (other !== row) {
      other.classList.remove("open");
      const b = other.querySelector(".kid-body");
      if (b) b.inert = true;
      const pl = other.querySelector(".kid-pill");
      if (pl) pl.setAttribute("aria-expanded", "false");
    }
    setOpen(on);
  });
  setOpen(isOpen());
  return row;
}

function unionCard(f, pid, u, rerender) {
  const p = f.persons[pid];
  const other = M.spouseIn(u, pid);
  const tools = h("div", { class: "unit-tools" });
  let header;
  if (other && f.persons[other]) {
    const fromFamily = M.isDesc(f, other);
    const full = M.fullName(f, other);
    const head = displayName(f, other);
    header = h("a", { class: "spouse-h", href: personHash(f, other) },
      miniPhoto(f, other),
      h("div", { class: "n" }, head, full && full !== head ? h("small", null, full) : null),
      h("span", { class: "tag" + (fromFamily ? "" : " out") }, fromFamily ? "من العائلة" : "من خارج العائلة"));
  } else {
    header = h("div", { class: "spouse-h" },
      h("div", { class: "mini-photo none" }),
      h("div", { class: "n" }, p.gender === "m" ? "أبناء لم تُحدَّد أمهم" : "أبناء لم يُحدَّد أبوهم", h("small", null, "تستطيع تحديد ذلك عند الإضافة")),
      help("unknownParent"));
  }
  const addKids = h("button", { class: "addkids", type: "button", onclick: () => familySheet(f, pid, { unionId: u.id, onSaved: rerender }) }, icon("plus"), "أبناء");
  const kidsBox = h("div", { class: "kids" });
  const drawKids = () => {
    const rows = u.kids.map((k) => kidRow(f, k, rerender)).filter(Boolean);
    kidsBox.replaceChildren(...(rows.length ? [h("div", { class: "kid-list" }, ...rows)] : []), h("div", { class: "kids-add" }, addKids));
  };
  drawKids();
  const moreBtn = h("button", { class: "ib", "aria-label": "خيارات", style: { width: "36px", height: "36px" } }, icon("more"));
  const hasOptions = u.kids.length > 1 || (!u.kids.length && other);
  moreBtn.addEventListener("click", () => {
    const items = [];
    if (u.kids.length > 1) items.push({ label: "ترتيب الأبناء", icon: "sort", onclick: () => orderSheet(f, u, drawKids) });
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
    kidsBox);
}

/** The way from the common ancestor down to this person: tap any name to go there. */
function crumbs(f, pid) {
  const chain = [];
  let cur = pid;
  if (M.kind(f, pid) === "spouse") {
    chain.push(pid);
    cur = M.unionsOf(f, pid).map((u) => M.spouseIn(u, pid)).find((id) => id && M.isDesc(f, id)) || null;
  }
  const seen = new Set();
  while (cur && !seen.has(cur) && f.persons[cur]) {
    seen.add(cur);
    chain.unshift(cur);
    const pu = M.parentUnion(f, cur);
    cur = pu ? M.hostOf(f, pu) : null;
  }
  if (chain.length < 2) return null;
  const items = [];
  chain.forEach((id, i) => {
    if (i) items.push(h("span", { class: "sep", "aria-hidden": "true" }, "←"));
    const label = f.persons[id].blank ? "—" : displayName(f, id);
    items.push(i === chain.length - 1 ? h("b", { class: "cur" }, label) : h("a", { href: personHash(f, id) }, label));
  });
  const bar = h("nav", { class: "crumbs", "aria-label": "موقعه في العائلة" }, ...items);
  // show the end of the path (this person) without moving the page itself
  requestAnimationFrame(() => { bar.scrollLeft = -bar.scrollWidth; });
  return bar;
}

/** The kunya or title under the full name, unless it is already the big name. */
function nickLine(f, pid) {
  const n = M.nickOf(f, pid);
  if (!n || n === M.headName(f, pid)) return null;
  return h("div", { class: "pnick" }, n);
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
          : M.headName(f, pid)
            ? h("div", { class: "pname" + (M.headName(f, pid).length > 9 ? " small" : "") }, M.headName(f, pid))
            : h("div", { class: "pname small muted" }, p.gender === "f" ? "اسمها غير معروف" : "اسمه غير معروف"),
        h("div", { class: "pfull" }, M.fullName(f, pid)),
        nickLine(f, pid),
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
    const body = [];
    if (unions.length) body.push(...unions.map((u) => unionCard(f, pid, u, rerender)));
    const addFamily = h("button", { class: "btn ghost", type: "button", onclick: () => familySheet(f, pid, { onSaved: rerender }) },
      icon("plus"), marriages ? "زواج آخر" : fem ? "زوج وأبناء" : "زوجة وأبناء");
    if (k === "blank") {
      // an empty slot keeps its children, nothing new is added to it
    } else {
      if (p.noKids && !unions.some((u) => u.kids.length)) {
        const undo = h("button", { class: "linkbtn", type: "button" }, "تراجع");
        undo.addEventListener("click", () => { M.setNoKids(f, pid, false); store.changed(); rerender(); });
        body.push(h("div", { class: "nokids" }, fem ? "مسجَّل أنها ليس لها أبناء." : "مسجَّل أنه ليس له أبناء.", undo));
      }
      body.push(addFamily);
    }
    if (!unions.length && k === "root") {
      body.unshift(h("div", { class: "tip" }, "اضغط «زوجة وأبناء» وأضف زوجة الجد وأبناءه منها مرة واحدة. وإن لم تعرف اسمها اختر «اسمها غير معروف»."));
    }
    if (unions.length || k !== "blank") sections.push(h("section", null, unions.length ? h("div", { class: "sec-t" }, h("span", null, title), marriages > 1 ? h("span", null, ar(marriages)) : null) : null,
      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, ...body)));
  }

  return screen(
    appBar({
      title: f.name, back: true,
      // the family's name opens the common ancestor's card; the house goes to the family list
      titleAction: pid !== f.rootId ? { label: `بطاقة ${displayName(f, f.rootId)}، الجد الجامع`, onclick: () => nav.go(personHash(f, f.rootId)) } : null,
      actions: [
        { icon: "search", label: "بحث", onclick: () => nav.go(`#/f/${f.id}/search`) },
        { icon: "tree", label: "شجرة العائلة", onclick: () => nav.go(`#/f/${f.id}/tree/${pid}`) },
        { icon: "home", label: "الصفحة الرئيسية: العائلات", onclick: () => nav.go("#/") },
      ],
    }),
    h("main", { class: "body" }, crumbs(f, pid), hero, ...sections),
    nextBar(f, rerender),
  );
}
