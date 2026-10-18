// Screen 6: edit a person. Every change is saved immediately.
import { h, icon, ar } from "../util.js";
import { appBar, screen, field, help, toggle, dialog, alertMsg, toast, busy } from "./kit.js";
import { namesInput, genderInput, dateInput } from "./forms.js";
import { rahmaText, personHash } from "./common.js";
import { pickFile } from "../platform.js";
import * as M from "../model.js";
import * as store from "../store.js";

export function editScreen(f, pid) {
  const p = f.persons[pid];
  const k = M.kind(f, pid);
  const set = (patch) => { M.updatePerson(f, pid, patch); store.changed(); savedNote.textContent = "حُفظ"; setTimeout(() => (savedNote.textContent = "يُحفظ تلقائيًا"), 1200); };
  const savedNote = h("span", { class: "saved-note" }, "يُحفظ تلقائيًا");

  const name = h("input", { class: "inp", value: p.name, placeholder: k === "blank" ? "اكتب اسمًا لملء الخانة" : "الاسم", maxlength: 40, autocomplete: "off" });
  const wasBlank = k === "blank";
  name.addEventListener("input", () => {
    const v = name.value.trim();
    if (!v) { if (wasBlank) set({ name: "", blank: true }); return; } // keep the last valid name while typing
    set({ name: v, blank: false });
  });
  name.addEventListener("blur", () => { if (!name.value.trim() && !p.blank) name.value = p.name; });

  const nick = h("input", { class: "inp", value: p.nick, placeholder: "مثل: أبو سعد", maxlength: 30, autocomplete: "off" });
  nick.addEventListener("input", () => set({ nick: nick.value }));
  const useNick = toggle(p.useNick, (v) => set({ useNick: v }));

  const noFather = !M.father(f, pid);
  const fam = h("input", { class: "inp", value: p.fam, placeholder: "مثل: السعيد", maxlength: 40, autocomplete: "off" });
  fam.addEventListener("input", () => set({ fam: fam.value }));

  // death + "deceased"
  const deceasedSw = toggle(!!(p.deceased || (p.death && p.death.y)), (v) => {
    if (!v && p.death && p.death.y) { deceasedSw.setOn(true); toast("امسح تاريخ الوفاة أولًا"); return; }
    set({ deceased: v }); rahma.textContent = v ? rahmaText(p) : "";
  });
  const rahma = h("span", { class: "rahm", style: { marginTop: 0 } }, p.deceased || (p.death && p.death.y) ? rahmaText(p) : "");
  // siblings are re-ordered by birth date once, when leaving this screen (not on every keystroke)
  let birthChanged = false;
  const onLeave = () => {
    window.removeEventListener("hashchange", onLeave);
    if (birthChanged && f.persons[pid]) { M.repositionByBirth(f, pid); store.changed(); }
  };
  window.addEventListener("hashchange", onLeave);
  const birthIn = dateInput(p.birth, (dt) => { if (dt !== undefined) { birthChanged = true; set({ birth: dt }); } });
  const deathIn = dateInput(p.death, (dt) => {
    if (dt === undefined) return;
    set({ death: dt });
    if (dt) { deceasedSw.setOn(true); rahma.textContent = rahmaText(p); }
  });

  // photos
  const thumbs = h("div", { class: "thumbs" });
  const drawThumbs = async () => {
    const items = [];
    for (const id of p.photos) {
      const url = await store.thumbURL(id);
      const t = h("button", { class: "thumb" + (p.mainPhoto === id ? " sel" : ""), "aria-label": "اختيار الصورة", onclick: () => { set({ mainPhoto: id }); drawThumbs(); } },
        url ? h("img", { src: url, alt: "" }) : null,
        p.mainPhoto === id ? h("span", { class: "star" }, "المحددة") : null,
        h("span", { class: "x", role: "button", "aria-label": "حذف الصورة", onclick: async (e) => {
          e.stopPropagation();
          const ok = await dialog({ title: "حذف الصورة؟", buttons: [{ label: "حذف", value: true, cls: "danger" }, { label: "إلغاء", value: false }] });
          if (!ok) return;
          const photos = p.photos.filter((x) => x !== id);
          set({ photos, mainPhoto: p.mainPhoto === id ? photos[0] || null : p.mainPhoto });
          await store.deletePhotos([id]);
          drawThumbs();
        } }, icon("close")));
      items.push(t);
    }
    items.push(h("button", { class: "thumb add", "aria-label": "إضافة صورة", onclick: async () => {
      const file = await pickFile("image/*");
      if (!file) return;
      const b = busy("جارٍ تجهيز الصورة…");
      try {
        const id = await store.addPhoto(file, f.id);
        set({ photos: [...p.photos, id], mainPhoto: p.mainPhoto || id });
      } catch (e) { toast("تعذر فتح هذه الصورة"); }
      b.done();
      drawThumbs();
    } }, icon("camera")));
    thumbs.replaceChildren(...items);
  };
  drawThumbs();

  const bio = h("textarea", { class: "inp", placeholder: p.gender === "f" ? "ما تعرفه عنها: أخبارها، أين عاشت…" : "ما تعرفه عنه: عمله، أخباره، أين عاش…" }, p.bio);
  bio.addEventListener("input", () => set({ bio: bio.value }));
  const note = h("input", { class: "inp", value: p.note, placeholder: "مثل: تاجر", maxlength: 28 });
  note.addEventListener("input", () => set({ note: note.value }));

  const del = h("button", { class: "delete-link", onclick: () => deleteFlow(f, pid) }, k === "blank" ? "حذف الخانة الفارغة" : `حذف ${M.headName(f, pid)}`);

  return screen(
    appBar({ title: k === "blank" ? "خانة فارغة" : `تعديل ${M.headName(f, pid)}`, back: true, extra: savedNote }),
    h("main", { class: "body" },
      k === "blank" ? h("div", { class: "tip" }, "هذه خانة شخص محذوف، تبقى ليظل أبناؤه متصلين بأجدادهم. اكتب اسمًا إن أردت ملأها.") : null,
      field("الاسم", name),
      field("اللقب (اختياري)", nick),
      h("div", { class: "toggle-row" }, h("span", { class: "l" }, "اعرض اللقب بدل الاسم", help("useNick")), useNick),
      field("الجنس", genderInput(p.gender, (g) => { set({ gender: g }); rahma.textContent = rahma.textContent ? rahmaText(p) : ""; })),
      noFather ? field("أسماء الآباء، الأقرب أولًا", namesInput(p.ancestors, (v) => set({ ancestors: v })), { helpKey: "ancestors" }) : null,
      noFather ? field("اسم العائلة", fam, { helpKey: "familyName" }) : null,
      field("الميلاد", birthIn),
      field("الوفاة", deathIn),
      h("div", { class: "toggle-row" }, h("span", { class: "l" }, "متوفى", rahma, help("deceased")), deceasedSw),
      field("الصور", thumbs, { helpKey: "photos" }),
      field("السيرة", bio),
      field("ملاحظة الشجرة، سطر قصير", note, { helpKey: "treeNote" }),
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
  if (dest === pid) { history.back(); return; } // back to the card, now an empty slot
  history.replaceState(null, "", personHash(f, dest));
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
