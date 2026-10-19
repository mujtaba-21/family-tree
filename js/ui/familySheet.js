// The family sheet: a person's spouse and children in one place, opened over the card or the tree.
// Names only (dates, photos and the rest come later from «تعديل»). Saved when the sheet closes,
// however it closes («تم», a tap outside, the Back button), so nothing typed is lost.
import { h, icon, ar } from "../util.js";
import { sheet, toast, help, checkbox } from "./kit.js";
import { kidsEditor, addLabel } from "./kidsEditor.js";
import { displayName, personHash } from "./common.js";
import * as nav from "../nav.js";
import * as M from "../model.js";
import * as store from "../store.js";
import * as P from "../progress.js";

/** «زوجته»/«زوجها» when the spouse has neither a name nor a kunya. */
export function spouseWord(f, other, ofPid) {
  const n = other && M.headName(f, other);
  if (n) return n;
  return f.persons[ofPid] && f.persons[ofPid].gender === "f" ? "زوجها" : "زوجته";
}

/**
 * pid: the family member. unionId: an existing marriage to add children to; null for a new
 * marriage (spouse and children). onSaved(): redraw what is behind the sheet.
 */
export function familySheet(f, pid, { unionId = null, onSaved = () => {}, restore = null, message = "" } = {}) {
  const p = f.persons[pid];
  if (!p) return;
  const fem = p.gender === "f";
  const u = unionId ? f.unions[unionId] : null;
  const other = u ? M.spouseIn(u, pid) : null;
  const st = restore || { name: "", fam: "", unknown: false, kids: [], assign: null };
  const name0 = displayName(f, pid);
  const before = P.snapshot(f);

  // children recorded before any spouse: offered to the first spouse added (all ticked)
  const unk = !u ? M.unknownSpouseUnion(f, pid, false) : null;
  const firstSpouse = !M.unionsOf(f, pid).some((x) => M.spouseIn(x, pid));
  const assign = new Set(st.assign || (unk && firstSpouse ? unk.kids : []));

  let title;
  if (u) title = other ? `أبناء ${name0} و${spouseWord(f, other, pid)}` : `أبناء ${name0}`;
  else title = M.unionsOf(f, pid).some((x) => M.spouseIn(x, pid)) ? `زواج آخر لـ${name0}` : `أسرة ${name0}`;

  const msg = h("div", { class: "err-t" });
  const editor = kidsEditor({ existing: u ? u.kids.length : 0, initial: st.kids, onChange: () => { msg.textContent = ""; } });
  if (message) { msg.textContent = message; editor.missing(); }

  // ---- the spouse (new marriage only)
  let spouseBox = null, nameIn = null, famIn = null, unknownBox = null;
  if (!u) {
    nameIn = h("input", { class: "inp", name: "spouse", value: st.name, placeholder: fem ? "اسم الزوج" : "اسم الزوجة", maxlength: 40, autocomplete: "off" });
    famIn = h("input", { class: "inp", name: "spouseFam", value: st.fam, placeholder: "اسم عائلتها (اختياري)", maxlength: 40, autocomplete: "off" });
    if (fem) famIn.placeholder = "اسم عائلته (اختياري)";
    nameIn.disabled = !!st.unknown;
    unknownBox = checkbox(fem ? "اسمه غير معروف" : "اسمها غير معروف", !!st.unknown, (on) => {
      st.unknown = on;
      nameIn.disabled = on;
      if (on) nameIn.value = "";
    });
    const fromFamily = h("a", { class: "link-t", href: `${personHash(f, pid)}/spouse/in` }, fem ? "زوجها من العائلة نفسها؟" : "زوجته من العائلة نفسها؟");
    fromFamily.addEventListener("click", (e) => {
      // pick someone already in the tree (e.g. a cousin): children typed here are kept and can be
      // given to that marriage on the next screen
      e.preventDefault(); e.stopPropagation();
      const t = missingText();
      if (t) { msg.textContent = t; return; }
      leaving = true;
      const kids = editor.filled();
      if (kids.length) { M.addChildren(f, M.unknownSpouseUnion(f, pid, true).id, kids); store.changed(); onSaved(); }
      closeSheet().then(() => nav.go(fromFamily.getAttribute("href")));
    });
    spouseBox = h("div", { class: "fs-sec" },
      h("div", { class: "opt-t" }, fem ? "الزوج" : "الزوجة"),
      nameIn, famIn,
      h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "row", style: { gap: "6px" } }, unknownBox, help("unknownName")), fromFamily),
      unk && unk.kids.length ? h("div", { class: "fs-assign" },
        h("div", { class: "opt-t" }, fem ? "من أبنائها منه؟" : "من أبنائه منها؟", help("unknownParent")),
        h("div", { class: "row" }, ...unk.kids.map((k) => checkbox(M.headName(f, k) || "—", assign.has(k), (on) => { on ? assign.add(k) : assign.delete(k); })))) : null);
  }

  let leaving = false; // going to «من العائلة»: already saved what was typed
  let closeSheet = () => Promise.resolve();
  const values = () => ({
    name: nameIn ? nameIn.value.trim() : "", fam: famIn ? famIn.value.trim() : "",
    unknown: !!st.unknown, kids: editor.state(), assign: [...assign],
  });

  /** Saves what is complete; rows still without ذكر/أنثى are left out (and returned). */
  const commit = () => {
    const v = values();
    const kids = editor.filled().filter((r) => r.gender);
    const spouseGiven = !u && (v.unknown || v.name);
    if (!spouseGiven && !kids.length) return;
    let union = u;
    if (!u && spouseGiven) union = M.addSpouse(f, pid, { name: v.name, fam: v.fam, unknownName: v.unknown }, v.assign);
    if (kids.length) {
      if (!union) union = M.unknownSpouseUnion(f, pid, true);
      M.addChildren(f, union.id, kids);
    }
    store.changed();
    const said = spouseGiven && kids.length ? `حُفظت أسرة ${name0}` : spouseGiven ? (fem ? "أُضيف الزوج" : "أُضيفت الزوجة") : "تمت " + addLabel(kids);
    const m = P.milestone(f, before);
    toast(m ? `${said}\n${m}` : said, m ? 3600 : 2200);
    onSaved();
  };
  const missingText = () => {
    const miss = editor.missing();
    return miss.length ? `اختر ذكر أو أنثى لـ: ${miss.join("، ")}` : "";
  };

  sheet((close) => {
    closeSheet = close;
    setTimeout(() => { if (!u && !st.name && !st.unknown && !st.kids.length) nameIn.focus(); else editor.focus(); }, 120);
    return h("div", { class: "fs" },
      h("h3", null, title),
      spouseBox,
      h("div", { class: "fs-sec" },
        h("div", { class: "opt-t" }, u && u.kids.length ? `أبناء آخرون (سبق تسجيل ${ar(u.kids.length)})` : "الأبناء، الأكبر أولًا"),
        editor.node,
        editor.newRowButton()),
      msg,
      h("div", { class: "hint", style: { padding: 0 } }, "يُحفظ عند الإغلاق. والتواريخ والصور تضيفها لاحقًا من «تعديل»."),
      h("button", { class: "btn primary", type: "button", onclick: close }, "تم"),
    );
  }, {
    cls: "family",
    // «تم» or a tap outside: keep the sheet open while a child has no ذكر/أنثى
    beforeClose: () => {
      const t = missingText();
      if (!t) return true;
      msg.textContent = t;
      return false;
    },
    onClose: (fromPop) => {
      if (leaving) return;
      const t = missingText();
      if (t && fromPop) {
        // Back pressed with something missing: show the sheet again as it was
        setTimeout(() => familySheet(f, pid, { unionId, onSaved, restore: values(), message: t }), 0);
        return;
      }
      commit();
    },
  });
}
