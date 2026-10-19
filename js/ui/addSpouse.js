// Screen: marry someone already in the family (e.g. a cousin), so the person is not entered twice.
// A spouse from outside the family is added in the family sheet (familySheet.js).
import { h, icon } from "../util.js";
import { appBar, screen, help, toast, confirm, checkbox } from "./kit.js";
import { personHash } from "./common.js";
import * as nav from "../nav.js";
import * as M from "../model.js";
import * as store from "../store.js";

export function addSpouseScreen(f, pid) {
  const p = f.persons[pid];
  const fem = p.gender === "f";

  // children recorded before this spouse was known
  const unk = M.unknownSpouseUnion(f, pid, false);
  const firstSpouse = !M.unionsOf(f, pid).some((u) => M.spouseIn(u, pid));
  const assign = new Set(unk && firstSpouse ? unk.kids : []);
  const assignBox = unk && unk.kids.length ? h("div", { class: "card", style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h("div", { class: "sec-t", style: { margin: 0 } }, h("span", { class: "row", style: { gap: "6px" } }, fem ? "من أبنائها منه؟" : "من أبنائه منها؟", help("unknownParent"))),
    h("div", { class: "row" }, ...unk.kids.map((k) => checkbox(M.headName(f, k) || "—", assign.has(k), (on) => { on ? assign.add(k) : assign.delete(k); })))) : null;

  const married = new Set(M.unionsOf(f, pid).map((u) => M.spouseIn(u, pid)).filter(Boolean));
  const exclude = new Set([pid, ...married]);
  const q = h("input", { placeholder: "اكتب الاسم، ثم اسم الأب إن أردت", autocomplete: "off", enterkeyhint: "search" });
  const results = h("div", { class: "card", style: { padding: "2px 12px", display: "none" } });
  const none = h("div", { class: "hint" });
  const runSearch = () => {
    const ids = M.search(f, q.value, { exclude }).filter((id) => f.persons[id].gender !== p.gender).slice(0, 40);
    results.style.display = ids.length ? "" : "none";
    none.textContent = q.value.trim() && !ids.length ? "لا يوجد أحد بهذا الاسم في العائلة." : "";
    results.replaceChildren(...ids.map((id) => h("button", { class: "res", onclick: async () => {
      const ok = await confirm({ title: "تسجيل الزواج؟", text: `${M.quadName(f, pid)} و${M.quadName(f, id)}. يظهر كل منهما في مكانه من الشجرة دون تكرار.`, ok: "تسجيل" });
      if (!ok) return;
      M.addSpouse(f, pid, { existingId: id }, [...assign]);
      store.changed();
      toast("سُجّل الزواج");
      nav.finish(personHash(f, pid));
    } },
      h("div", { class: "dot " + f.persons[id].gender }),
      h("div", { class: "t" }, h("b", null, M.quadName(f, id)), h("span", null, M.isDesc(f, id) ? "من العائلة" : "زوج أو زوجة في العائلة")))));
  };
  q.addEventListener("input", runSearch);
  setTimeout(() => q.focus(), 80);

  return screen(
    appBar({ title: `${fem ? "زوج" : "زوجة"} من العائلة لـ${M.headName(f, pid) || "هذه الخانة"}`, back: true }),
    h("main", { class: "body" },
      h("div", { class: "hint", style: { padding: 0 } }, fem
        ? "اختر زوجها من المسجلين في الشجرة، مثل ابن عمها. يبقى في فرع أبيه، ويُرسم الزواج بينهما دون تكرار اسمه."
        : "اختر زوجته من المسجلات في الشجرة، مثل بنت عمه. تبقى في فرع أبيها، ويُرسم الزواج بينهما دون تكرار اسمها."),
      h("div", { class: "sbar" }, icon("search"), q),
      results, none,
      assignBox,
    ),
  );
}
