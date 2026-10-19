// Screen 6: edit a person. Every change is saved immediately.
import { h } from "../util.js";
import { appBar, screen, dialog, alertMsg, toast } from "./kit.js";
import { personForm } from "./personForm.js";
import { personHash } from "./common.js";
import * as nav from "../nav.js";
import * as M from "../model.js";
import * as store from "../store.js";

export function editScreen(f, pid) {
  const k = M.kind(f, pid);
  const role = k === "root" ? "root" : k === "spouse" ? "spouse" : "member";
  // siblings are re-ordered by birth date once, when leaving this screen (not on every keystroke)
  let birthChanged = false;
  nav.onLeave(() => { if (birthChanged && f.persons[pid]) { M.repositionByBirth(f, pid); store.changed(); } });
  const form = personForm({ f, pid, role, onBirthChange: () => { birthChanged = true; } });
  const del = h("button", { class: "delete-link", onclick: () => deleteFlow(f, pid) }, k === "blank" ? "حذف الخانة الفارغة" : `حذف ${M.headName(f, pid) || "هذا الشخص"}`);
  return screen(
    appBar({ title: k === "blank" ? "خانة فارغة" : `تعديل ${M.headName(f, pid) || (f.persons[pid].gender === "f" ? "زوجة" : "")}`.trim(), back: true, extra: form.savedNote }),
    h("main", { class: "body" },
      k === "blank" ? h("div", { class: "tip" }, "هذه خانة شخص محذوف، تبقى ليظل أبناؤه متصلين بأجدادهم. اكتب اسمًا إن أردت ملأها.") : null,
      form.node,
      del,
    ),
  );
}

async function deleteFlow(f, pid) {
  const p = f.persons[pid];
  const plan = M.planDelete(f, pid);
  if (plan.notAllowed) { await alertMsg("لا يمكن الحذف", plan.notAllowed); return; }
  const fem = p.gender === "f";
  const nm = M.headName(f, pid) || "الخانة";
  let text;
  if (plan.blank) {
    text = `${fem ? "تُحذف" : "يُحذف"} ${nm} ${fem ? "وحدها" : "وحده"}. ${fem ? "يبقى أبناؤها" : "يبقى أبناؤه"} في مكانهم، ${fem ? "ويبقى مكانها" : "ويبقى مكانه"} في الشجرة خانة فارغة ليظلوا متصلين بأجدادهم.`;
  } else if (plan.kidsKept) {
    text = `${fem ? "تُحذف" : "يُحذف"} ${nm} ${fem ? "وحدها" : "وحده"}، ${fem ? "ويبقى أبناؤها" : "ويبقى أبناؤه"} في مكانهم دون ${fem ? "أم مسجلة" : "أب مسجل"}.`;
  } else {
    text = `${fem ? "تُحذف" : "يُحذف"} ${nm} من العائلة.`;
  }
  if (plan.alsoRemoved.length) {
    const names = plan.alsoRemoved.map((id) => M.shortName(f, id)).join(" و");
    text += ` ويُحذف ${fem ? "معها" : "معه"} أيضًا: ${names}، لعدم بقاء رابط آخر بالعائلة.`;
  }
  const ok = await dialog({
    title: `حذف ${M.quadName(f, pid) || "الخانة الفارغة"}؟`, text, warn: "لا يمكن التراجع عن الحذف.",
    buttons: [{ label: "حذف", value: true, cls: "danger" }, { label: "إلغاء", value: false }],
  });
  if (!ok) return;
  // where to go afterwards
  const pu = M.parentUnion(f, pid);
  const spouse = M.unionsOf(f, pid).map((u) => M.spouseIn(u, pid)).find(Boolean);
  const target = plan.blank ? pid : (pu && (M.hostOf(f, pu))) || (spouse && f.persons[spouse] ? spouse : null) || f.rootId;
  const photos = M.applyDelete(f, plan);
  await store.deletePhotos(photos);
  store.changed();
  toast(plan.blank ? "حُذف، وبقيت خانته فارغة" : "حُذف");
  const dest = f.persons[target] ? target : f.rootId;
  nav.go(personHash(f, dest), { replace: true });
}
