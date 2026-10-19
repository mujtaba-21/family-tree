// Screen: add several children at once, eldest first (the same rows as in the family sheet).
import { h, ar } from "../util.js";
import { appBar, screen, toast } from "./kit.js";
import { kidsEditor, addLabel } from "./kidsEditor.js";
import { spouseWord } from "./familySheet.js";
import { personHash, displayName } from "./common.js";
import * as M from "../model.js";
import * as store from "../store.js";
import * as nav from "../nav.js";

export function addKidsScreen(f, pid, unionId) {
  const p = f.persons[pid];
  const u = unionId === "new" ? null : f.unions[unionId];
  const other = u ? M.spouseIn(u, pid) : null;
  const title = other ? `أبناء ${displayName(f, pid)} و${spouseWord(f, other, pid)}` : `أبناء ${displayName(f, pid)}`;
  const existing = u ? u.kids.length : 0;

  const save = h("button", { class: "btn primary", disabled: true }, "إضافة");
  const msg = h("div", { class: "err-t" });
  const refresh = () => {
    const fl = editor.filled();
    const missing = fl.filter((r) => !r.gender);
    save.disabled = !fl.length || missing.length > 0;
    save.textContent = addLabel(fl);
    msg.textContent = missing.length ? "اختر ذكر أو أنثى للأسماء الجديدة" : "";
  };
  let editor = null;
  editor = kidsEditor({ existing, onChange: () => { if (editor) refresh(); } });
  refresh();
  editor.focus();

  save.addEventListener("click", () => {
    const fl = editor.filled();
    if (!fl.length || fl.some((r) => !r.gender)) return;
    const union = u || M.unknownSpouseUnion(f, pid, true);
    M.addChildren(f, union.id, fl);
    store.changed();
    toast("تمت " + addLabel(fl));
    nav.finish(personHash(f, pid));
  });

  return screen(
    appBar({ title, back: true }),
    h("main", { class: "body", style: { gap: "10px" } },
      existing ? h("div", { class: "hint" }, `سبق تسجيل ${ar(existing)} من ${other ? "أبنائهما" : p.gender === "f" ? "أبنائها" : "أبنائه"}. الجدد يُضافون بعدهم، وتستطيع ترتيبهم لاحقًا.`) : null,
      h("div", { class: "card", style: { padding: "6px 12px" } }, editor.node),
      editor.newRowButton(),
      msg,
      h("div", { class: "hint" }, "اكتب الأكبر أولًا. يظهر سطر جديد كلما كتبت اسمًا. ولتغيير الترتيب اضغط مطوّلًا على رقم السطر واسحبه. والجنس يُملأ تلقائيًا للأسماء المُدخلة سابقًا، وتستطيع تغييره."),
      !u ? h("div", { class: "hint" }, p.gender === "m" ? "لم تُحدَّد أمهم بعد. تستطيع تحديدها عند إضافة الزوجة." : "لم يُحدَّد أبوهم بعد. تستطيع تحديده عند إضافة الزوج.") : null,
      h("div", { class: "spacer" }),
      save,
    ),
  );
}
