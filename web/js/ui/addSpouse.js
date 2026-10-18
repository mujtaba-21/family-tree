// Screen 4: add a husband or wife — someone new from outside, or someone already in the family.
import { h, icon } from "../util.js";
import { appBar, screen, field, help, segmented, toast, confirm, checkbox } from "./kit.js";
import { namesInput, genderInput } from "./forms.js";
import * as M from "../model.js";
import * as store from "../store.js";

export function addSpouseScreen(f, pid) {
  const p = f.persons[pid];
  const fem = p.gender === "f";
  const word = fem ? "زوج" : "زوجة";
  const data = { name: "", ancestors: [], fam: "", gender: fem ? "m" : "f" };
  let mode = "out";

  // children recorded before this spouse was known
  const unk = M.unknownSpouseUnion(f, pid, false);
  const firstSpouse = !M.unionsOf(f, pid).some((u) => M.spouseIn(u, pid));
  const assign = new Set(unk && firstSpouse ? unk.kids : []);
  const assignBox = unk && unk.kids.length ? h("div", { class: "card", style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h("div", { class: "sec-t", style: { margin: 0 } }, h("span", { class: "row", style: { gap: "6px" } }, fem ? "من أبنائها منه؟" : "من أبنائه منها؟", help("unknownParent"))),
    h("div", { class: "row" }, ...unk.kids.map((k) => checkbox(M.headName(f, k) || "—", assign.has(k), (on) => { on ? assign.add(k) : assign.delete(k); })))) : null;

  // ---- outside the family
  const name = h("input", { class: "inp", placeholder: "الاسم الأول", maxlength: 40, autocomplete: "off" });
  const fam = h("input", { class: "inp", placeholder: "مثل: الحربي", maxlength: 40, autocomplete: "off" });
  const preview = h("div", { class: "preview" });
  const save = h("button", { class: "btn primary", disabled: true }, `إضافة ال${word}`);
  const refresh = () => {
    data.name = name.value.trim();
    data.fam = fam.value.trim();
    const full = [data.name, ...data.ancestors, data.fam].filter(Boolean).join(" ");
    const tree = [data.name, data.fam || data.ancestors[data.ancestors.length - 1]].filter(Boolean).join(" ");
    preview.replaceChildren("الاسم الكامل", h("b", null, full || "—"), `ويظهر في الشجرة: ${tree || "—"}`);
    save.disabled = !data.name;
  };
  name.addEventListener("input", refresh);
  fam.addEventListener("input", refresh);
  save.addEventListener("click", () => {
    if (!data.name) return;
    M.addSpouse(f, pid, { name: data.name, ancestors: data.ancestors, fam: data.fam, gender: data.gender }, [...assign]);
    store.changed();
    toast(fem ? "أُضيف الزوج" : "أُضيفت الزوجة");
    history.back();
  });
  refresh();
  const outside = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
    field("الاسم", name),
    field("أسماء الآباء، الأقرب أولًا (اختياري)", namesInput([], (v) => { data.ancestors = v; refresh(); }), { helpKey: "ancestors" }),
    field("اسم العائلة", fam, { helpKey: "familyName" }),
    field("الجنس", h("div", { class: "row" }, genderInput(data.gender, (g) => { data.gender = g; }), h("span", { class: "hint" }, `تلقائي: عكس جنس ${M.headName(f, pid) || "الشخص"}`))),
    preview,
  );

  // ---- someone already in the family (e.g. a cousin): no duplicate person
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
      const ok = await confirm({ title: `تسجيل الزواج؟`, text: `${M.quadName(f, pid)} و${M.quadName(f, id)}. يظهر كل منهما في مكانه من الشجرة دون تكرار.`, ok: "تسجيل" });
      if (!ok) return;
      M.addSpouse(f, pid, { existingId: id }, [...assign]);
      store.changed();
      toast("سُجّل الزواج");
      history.back();
    } },
      h("div", { class: "dot " + f.persons[id].gender }),
      h("div", { class: "t" }, h("b", null, M.quadName(f, id)), h("span", null, M.isDesc(f, id) ? "من العائلة" : "زوج أو زوجة في العائلة")))));
  };
  q.addEventListener("input", runSearch);
  const inside = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
    h("div", { class: "sbar" }, icon("search"), q),
    results, none,
    h("div", { class: "hint" }, "مثلًا بنت العم: تبقى في فرع أبيها، ويُرسم الزواج بينهما دون تكرار اسمها."),
  );

  const area = h("div");
  const footer = h("div");
  const show = () => {
    area.replaceChildren(mode === "out" ? outside : inside);
    footer.replaceChildren(mode === "out" ? save : "");
    if (mode === "in") setTimeout(() => q.focus(), 60); else setTimeout(() => name.focus(), 60);
  };
  show();

  return screen(
    appBar({ title: `${word} ل${M.headName(f, pid) || "هذه الخانة"}`, back: true }),
    h("main", { class: "body" },
      h("div", { class: "row", style: { flexWrap: "nowrap" } },
        h("div", { style: { flex: 1 } }, segmented([{ value: "out", label: "من خارج العائلة" }, { value: "in", label: "من العائلة" }], mode, (v) => { mode = v; show(); }, { cls: "bigseg" })),
        help("spouseSource")),
      area,
      assignBox,
      h("div", { class: "spacer" }),
      footer,
    ),
  );
}
