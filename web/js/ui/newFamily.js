// Create a family: its title and the common ancestor (الجد الجامع).
import { h } from "../util.js";
import { appBar, screen, field, help } from "./kit.js";
import { personForm } from "./personForm.js";
import * as M from "../model.js";
import * as store from "../store.js";
import * as nav from "../nav.js";

export function newFamilyScreen() {
  let titleTouched = false;
  const title = h("input", { class: "inp", placeholder: "مثل: آل السعيد", maxlength: 60 });
  const create = h("button", { class: "btn primary", disabled: true }, "إنشاء العائلة");
  const draft = { persons: {}, unions: {}, rootId: null };
  const form = personForm({ f: draft, role: "root", gender: "m", onChange: () => refresh() });
  const refresh = () => {
    const v = form.values();
    if (!titleTouched) title.value = v.fam ? (v.fam.startsWith("آل") ? v.fam : "آل " + v.fam) : "";
    create.disabled = !form.valid();
  };
  title.addEventListener("input", () => { titleTouched = true; });

  create.addEventListener("click", async () => {
    if (!form.valid()) return;
    create.disabled = true;
    const v = form.values();
    const f = M.createFamily({ familyName: title.value.trim(), root: v });
    const root = f.persons[f.rootId];
    Object.assign(root, { nick: v.nick, useNick: v.useNick, birth: v.birth, death: v.death, deceased: v.deceased, bio: v.bio, note: v.note });
    Object.assign(root, await form.savePhotos(f.id));
    await store.saveNewFamily(f);
    nav.go(`#/f/${f.id}/p/${f.rootId}`, { replace: true });
  });

  refresh();
  form.focus();
  return screen(
    appBar({ title: "عائلة جديدة", back: true }),
    h("main", { class: "body" },
      h("div", { class: "sec-t" }, h("span", { class: "row", style: { gap: "6px" } }, "الجد الجامع", help("root"))),
      form.node,
      h("div", { class: "opt-sec" }, h("span", null, "العائلة")),
      field("اسم العائلة في القائمة", title, { helpKey: "familyTitle" }),
      h("div", { class: "spacer" }),
      create,
    ),
  );
}
