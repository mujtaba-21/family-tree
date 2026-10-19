// «التالي»: a small bar at the bottom of the card that suggests the next family to record,
// generation by generation, so the tree can be filled in without hunting for who is missing.
// [أضف] opens the family sheet right here, [ما له أبناء] stops the question for good,
// [لاحقًا] puts it off until the app is opened again.
import { h, icon } from "../util.js";
import { toast } from "./kit.js";
import { familySheet } from "./familySheet.js";
import { personHash, displayName } from "./common.js";
import * as P from "../progress.js";
import * as M from "../model.js";
import * as store from "../store.js";

const later = new Map(); // familyId -> ids put off with «لاحقًا» (for this session)

export function nextBar(f, onChange) {
  if (!later.has(f.id)) later.set(f.id, new Set());
  const skip = later.get(f.id);
  const bar = h("div", { class: "next-bar", role: "region", "aria-label": "التالي" });

  const draw = () => {
    const st = P.nextStep(f, skip);
    bar.hidden = !st;
    if (!st) { bar.replaceChildren(); return; }
    const p = f.persons[st.pid];
    const fem = p.gender === "f";
    const u = st.unionId ? f.unions[st.unionId] : null;
    const name = M.nameWithFather(f, st.pid) || displayName(f, st.pid);
    const what = u ? `أبناء ${name}` : `أسرة ${name}`;
    const add = h("button", { class: "btn primary", type: "button" }, icon("plus"), "أضف");
    add.addEventListener("click", () => familySheet(f, st.pid, { unionId: st.unionId, onSaved: onChange }));
    const none = h("button", { class: "btn soft", type: "button" }, fem ? "ما لها أبناء" : "ما له أبناء");
    none.addEventListener("click", () => {
      const before = P.snapshot(f);
      M.setNoKids(f, st.pid, true);
      store.changed();
      const m = P.milestone(f, before);
      toast(m || `سُجّل: ${displayName(f, st.pid)} ${fem ? "ليس لها" : "ليس له"} أبناء`, m ? 3200 : 2200);
      onChange();
    });
    const notNow = h("button", { class: "btn plain", type: "button" }, "لاحقًا");
    notNow.addEventListener("click", () => { skip.add(st.pid); draw(); });
    bar.replaceChildren(
      h("div", { class: "nb-t" },
        h("span", { class: "nb-l" }, "التالي"),
        h("a", { class: "nb-n", href: personHash(f, st.pid) }, what)),
      h("div", { class: "nb-b" }, add, none, notNow));
  };
  draw();
  return bar;
}
