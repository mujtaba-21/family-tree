// Create a family: its title and the common ancestor (الجد الجامع).
import { h } from "../util.js";
import { appBar, screen, field, help } from "./kit.js";
import { namesInput, genderInput } from "./forms.js";
import * as M from "../model.js";
import * as store from "../store.js";

export function newFamilyScreen() {
  const data = { title: "", name: "", ancestors: [], fam: "", gender: "m" };
  let titleTouched = false;

  const title = h("input", { class: "inp", placeholder: "مثل: آل السعيد", maxlength: 60 });
  const name = h("input", { class: "inp", placeholder: "الاسم الأول", maxlength: 40, autocomplete: "off" });
  const fam = h("input", { class: "inp", placeholder: "مثل: السعيد", maxlength: 40, autocomplete: "off" });
  const preview = h("div", { class: "preview" });
  const create = h("button", { class: "btn primary", disabled: true }, "إنشاء العائلة");

  const refresh = () => {
    data.name = name.value.trim();
    data.fam = fam.value.trim();
    if (!titleTouched) title.value = data.fam ? (data.fam.startsWith("آل") ? data.fam : "آل " + data.fam) : "";
    data.title = title.value.trim();
    const full = [data.name, ...data.ancestors, data.fam].filter(Boolean).join(" ");
    const inTree = [data.name, data.fam || data.ancestors[data.ancestors.length - 1]].filter(Boolean).join(" ");
    preview.replaceChildren("الاسم الكامل", h("b", null, full || "—"), `ويظهر في الشجرة: ${inTree || "—"}`);
    create.disabled = !data.name;
  };
  title.addEventListener("input", () => { titleTouched = true; refresh(); });
  name.addEventListener("input", refresh);
  fam.addEventListener("input", refresh);

  create.addEventListener("click", async () => {
    if (!data.name) return;
    const f = M.createFamily({ familyName: data.title, root: { name: data.name, ancestors: data.ancestors, fam: data.fam, gender: data.gender } });
    await store.saveNewFamily(f);
    history.replaceState(null, "", `#/f/${f.id}/p/${f.rootId}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  refresh();
  setTimeout(() => name.focus(), 80);
  return screen(
    appBar({ title: "عائلة جديدة", back: true }),
    h("main", { class: "body" },
      h("div", { class: "sec-t" }, h("span", { class: "row", style: { gap: "6px" } }, "الجد الجامع", help("root"))),
      field("الاسم", name),
      field("أسماء آبائه (اختياري)", namesInput([], (v) => { data.ancestors = v; refresh(); }), { helpKey: "ancestors" }),
      field("اسم العائلة", fam, { helpKey: "familyName" }),
      field("الجنس", genderInput("m", (g) => { data.gender = g; })),
      preview,
      field("اسم العائلة في القائمة", title, { helpKey: "familyTitle" }),
      h("div", { class: "spacer" }),
      create,
    ),
  );
}
