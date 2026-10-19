// One form for a person, used to create the common ancestor, to add a spouse from outside the
// family, and to edit anyone. The essentials come first; everything optional sits in its own part
// below. When editing, every change is saved at once; for a new person the screen saves at the end.
import { h, icon } from "../util.js";
import { field, help, toggle, checkbox, dialog, confirm, toast, busy } from "./kit.js";
import { namesInput, genderInput, dateInput } from "./forms.js";
import { rahmaText } from "./common.js";
import { pickFile } from "../platform.js";
import * as M from "../model.js";
import * as store from "../store.js";

const EMPTY = { name: "", unknownName: false, ancestors: [], fam: "", gender: "m", nick: "", useNick: false,
  birth: null, death: null, deceased: false, bio: "", note: "" };

/**
 * role: "root" | "spouse" | "member". Fathers' names and the family name exist only for the root
 * and for spouses from outside (everyone else gets them from the tree); a spouse's gender is fixed.
 * Editing: pass pid (changes are saved through the model). New person: pass gender; read values
 * with form.values() and save photos with form.savePhotos(familyId).
 * onChange(): called after any change (new forms use it to enable their save button).
 */
export function personForm({ f, pid = null, role, gender = "m", onChange = () => {}, onBirthChange = () => {} }) {
  const live = !!pid;
  const p = live ? f.persons[pid] : null;
  const data = live ? { ...EMPTY, ...p } : { ...EMPTY, gender };
  const typed = role === "root" || role === "spouse";
  const pending = []; // new person: {file, url}
  let mainPending = 0;

  const set = (patch) => {
    Object.assign(data, patch);
    if (live) { M.updatePerson(f, pid, patch); store.changed(); flashSaved(); }
    refresh();
    onChange();
  };
  const savedNote = h("span", { class: "saved-note" }, live ? "يُحفظ تلقائيًا" : "");
  const flashSaved = () => { savedNote.textContent = "حُفظ"; setTimeout(() => (savedNote.textContent = "يُحفظ تلقائيًا"), 1200); };

  // ---------------------------------------------------------------- name
  const name = h("input", { class: "inp", name: "name", value: data.unknownName ? "" : data.name, placeholder: "الاسم الأول", maxlength: 40, autocomplete: "off" });
  const blankSlot = live && p.blank;
  if (blankSlot) name.placeholder = "اكتب اسمًا لملء الخانة";
  name.addEventListener("input", () => {
    const v = name.value.trim();
    if (!v) { if (blankSlot) set({ name: "", blank: true }); else if (!live) set({ name: "" }); return; } // keep the last valid name while typing
    set({ name: v, blank: false });
  });
  name.addEventListener("blur", () => { if (live && !name.value.trim() && !data.blank && !data.unknownName) name.value = data.name; });
  const unknown = role === "root" ? null : checkbox(data.gender === "f" ? "اسمها غير معروف" : "اسمه غير معروف", !!data.unknownName, (on) => {
    name.disabled = on;
    if (on) { name.value = ""; set({ unknownName: true, name: "" }); }
    else { set({ unknownName: false }); setTimeout(() => name.focus(), 30); }
  });
  name.disabled = !!data.unknownName;

  // ---------------------------------------------------------------- fathers, family name
  const fam = h("input", { class: "inp", name: "fam", value: data.fam, placeholder: "مثل: الحربي", maxlength: 40, autocomplete: "off" });
  fam.addEventListener("input", () => set({ fam: fam.value.trim() }));
  const ancestors = typed ? namesInput(data.ancestors, (v) => set({ ancestors: v })) : null;

  // ---------------------------------------------------------------- gender (fixed for spouses)
  let genderSeg = null;
  if (role !== "spouse") {
    genderSeg = genderInput(data.gender, async (g) => {
      if (!live) { set({ gender: g }); return; }
      const group = M.marriageGroup(f, pid).filter((x) => x !== pid);
      if (group.length) {
        const names = group.map((x) => M.headName(f, x) || "—").join(" و");
        const ok = await confirm({
          title: "تصحيح الجنس",
          text: `الزوج ذكر والزوجة أنثى دائمًا، فتصحيح جنس ${M.headName(f, pid) || "هذا الشخص"} يغيّر معه جنس: ${names}.`,
          ok: "تصحيح الاثنين", cancel: "إلغاء",
        });
        if (!ok) { genderSeg.setValue(data.gender); return; }
      }
      set({ gender: g });
      if (unknown) unknown.lastChild.textContent = g === "f" ? "اسمها غير معروف" : "اسمه غير معروف";
      rahma.textContent = isDead() ? rahmaText(data) : "";
      if (group.length) toast("صُحّح الجنس");
    });
  }

  // ---------------------------------------------------------------- preview of the names
  const preview = h("div", { class: "preview" });
  const refresh = () => {
    let full, tree;
    if (live) {
      full = M.fullName(f, pid);
      tree = M.shortName(f, pid);
    } else {
      const first = data.unknownName ? "…" : data.name;
      full = M.typedFullName([first, ...data.ancestors].filter(Boolean), data.fam, data.gender);
      const base = data.unknownName ? data.nick : data.useNick && data.nick ? data.nick : data.name;
      tree = data.unknownName ? base : [base, data.fam || data.ancestors[data.ancestors.length - 1]].filter(Boolean).join(" ");
    }
    preview.replaceChildren("الاسم الكامل", h("b", null, full && full !== "…" ? full : "—"),
      `ويظهر في الشجرة: ${tree || (data.unknownName ? "خانة بلا اسم" : "—")}`);
    const auto = live ? M.kunya(f, pid) : "";
    nick.placeholder = auto ? `تلقائيًا: ${auto}` : "مثل: أبو محمد، أو لقب اشتهر به";
  };

  // ---------------------------------------------------------------- optional part
  const nick = h("input", { class: "inp", name: "nick", value: data.nick, maxlength: 30, autocomplete: "off" });
  nick.addEventListener("input", () => set({ nick: nick.value.trim() }));
  const useNick = toggle(data.useNick, (v) => set({ useNick: v }));

  const isDead = () => !!(data.deceased || (data.death && data.death.y));
  const rahma = h("span", { class: "rahm", style: { marginTop: 0 } }, isDead() ? rahmaText(data) : "");
  const deceasedSw = toggle(isDead(), (v) => {
    if (!v && data.death && data.death.y) { deceasedSw.setOn(true); toast("امسح تاريخ الوفاة أولًا"); return; }
    set({ deceased: v });
    rahma.textContent = v ? rahmaText(data) : "";
  });
  const birthIn = dateInput(data.birth, (dt) => { if (dt !== undefined) { set({ birth: dt }); onBirthChange(); } });
  const deathIn = dateInput(data.death, (dt) => {
    if (dt === undefined) return;
    set({ death: dt, ...(dt ? { deceased: true } : {}) });
    if (dt) { deceasedSw.setOn(true); rahma.textContent = rahmaText(data); }
  });

  const thumbs = h("div", { class: "thumbs" });
  const drawThumbs = async () => {
    const items = [];
    if (live) {
      for (const id of data.photos || []) {
        const url = await store.thumbURL(id);
        items.push(thumb(url, data.mainPhoto === id, () => { set({ mainPhoto: id }); drawThumbs(); }, async () => {
          const ok = await dialog({ title: "حذف الصورة؟", buttons: [{ label: "حذف", value: true, cls: "danger" }, { label: "إلغاء", value: false }] });
          if (!ok) return;
          const photos = data.photos.filter((x) => x !== id);
          set({ photos, mainPhoto: data.mainPhoto === id ? photos[0] || null : data.mainPhoto });
          await store.deletePhotos([id]);
          drawThumbs();
        }));
      }
    } else {
      pending.forEach((ph, i) => items.push(thumb(ph.url, i === mainPending, () => { mainPending = i; drawThumbs(); }, () => {
        URL.revokeObjectURL(ph.url);
        pending.splice(i, 1);
        if (mainPending >= pending.length) mainPending = 0;
        drawThumbs();
      })));
    }
    items.push(h("button", { class: "thumb add", type: "button", "aria-label": "إضافة صورة", onclick: async () => {
      const file = await pickFile("image/*");
      if (!file) return;
      if (!live) { pending.push({ file, url: URL.createObjectURL(file) }); drawThumbs(); return; }
      const b = busy("جارٍ تجهيز الصورة…");
      try {
        const id = await store.addPhoto(file, f.id);
        set({ photos: [...(data.photos || []), id], mainPhoto: data.mainPhoto || id });
      } catch (e) { toast("تعذر فتح هذه الصورة"); }
      b.done();
      drawThumbs();
    } }, icon("camera")));
    thumbs.replaceChildren(...items);
  };
  drawThumbs();

  const bio = h("textarea", { class: "inp", placeholder: data.gender === "f" ? "ما تعرفه عنها: أخبارها، أين عاشت…" : "ما تعرفه عنه: عمله، أخباره، أين عاش…" }, data.bio || "");
  bio.addEventListener("input", () => set({ bio: bio.value }));
  const note = h("input", { class: "inp", name: "note", value: data.note || "", placeholder: "مثل: تاجر", maxlength: 28 });
  note.addEventListener("input", () => set({ note: note.value }));

  refresh();

  const node = h("div", { class: "pform" },
    field("الاسم", name),
    unknown ? h("div", { class: "row", style: { marginTop: "-4px" } }, unknown, help("unknownName")) : null,
    typed ? field("أسماء الآباء، الأقرب أولًا", ancestors, { helpKey: "ancestors" }) : null,
    typed ? field("اسم العائلة", fam, { helpKey: "familyName" }) : null,
    genderSeg ? field("الجنس", genderSeg) : null,
    typed || !live ? preview : null,
    h("div", { class: "opt-sec" }, h("span", null, "اختياري")),
    field("الكنية أو اللقب", nick, { helpKey: "nick" }),
    h("div", { class: "toggle-row" }, h("span", { class: "l" }, "اعرض الكنية بدل الاسم", help("useNick")), useNick),
    field("الميلاد", birthIn),
    field("الوفاة", deathIn),
    h("div", { class: "toggle-row" }, h("span", { class: "l" }, data.gender === "f" ? "متوفاة" : "متوفى", rahma, help("deceased")), deceasedSw),
    field("الصور", thumbs, { helpKey: "photos" }),
    field("السيرة", bio),
    field("ملاحظة الشجرة، سطر قصير", note, { helpKey: "treeNote" }),
  );

  return {
    node,
    savedNote,
    focus: () => setTimeout(() => { if (!name.disabled) name.focus(); }, 80),
    valid: () => !!(data.name || data.unknownName),
    /** Values for a new person (photos are added separately). */
    values: () => ({ ...data, name: data.unknownName ? "" : data.name }),
    /** Stores the chosen photos; returns {photos, mainPhoto}. */
    async savePhotos(familyId) {
      const ids = [];
      for (const ph of pending) {
        try { ids.push(await store.addPhoto(ph.file, familyId)); } catch (e) { /* unreadable image: skip */ }
        URL.revokeObjectURL(ph.url);
      }
      return { photos: ids, mainPhoto: ids[mainPending] || ids[0] || null };
    },
  };
}

function thumb(url, selected, onSelect, onRemove) {
  return h("button", { class: "thumb" + (selected ? " sel" : ""), type: "button", "aria-label": "اختيار الصورة", onclick: onSelect },
    url ? h("img", { src: url, alt: "" }) : null,
    selected ? h("span", { class: "star" }, "المحددة") : null,
    h("span", { class: "x", role: "button", "aria-label": "حذف الصورة", onclick: (e) => { e.stopPropagation(); onRemove(); } }, icon("close")));
}
