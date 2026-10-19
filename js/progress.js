// What is left to record in a family: the next family to add (generation by generation, eldest
// branches first), the totals shown on the family list, and the calm milestones after a change.
// Someone marked «ما له أبناء», or certainly younger than 16, is never asked about.
import * as M from "./model.js";
import * as D from "./dates.js";
import { ar } from "./util.js";

const DAY = 86400000;
const ADULT_DAYS = 16 * 365.25;
const ORD = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

/** Certainly under 16 today (or when they died), going by the dates entered. */
function tooYoung(p) {
  const b = D.range(p.birth, true);
  if (!b) return false;
  let end = Math.floor(Date.now() / DAY);
  const d = D.range(p.death, true);
  if (d) end = Math.min(end, d[1]);
  return end - b[0] < ADULT_DAYS;
}

const unionsInOrder = (f, pid) => [...M.unionsOf(f, pid)]
  .sort((a, b) => (M.spouseIn(a, pid) ? 0 : 1) - (M.spouseIn(b, pid) ? 0 : 1) || a.order - b.order);

/** The members by generation (the common ancestor is generation 0), each in tree order. */
export function generations(f) {
  const gens = [[f.rootId]];
  const seen = new Set(gens[0]);
  for (;;) {
    const next = [];
    for (const pid of gens[gens.length - 1]) {
      for (const u of unionsInOrder(f, pid)) {
        for (const k of u.kids) if (f.persons[k] && !seen.has(k)) { seen.add(k); next.push(k); }
      }
    }
    if (!next.length) return gens;
    gens.push(next);
  }
}

/** Whether this member's own children are still to be recorded. */
export function needsFamily(f, pid) {
  const p = f.persons[pid];
  if (!p || p.blank || p.noKids) return false;
  if (M.unionsOf(f, pid).some((u) => u.kids.length)) return false;
  return !tooYoung(p);
}

/** The next family to record: {pid, unionId (a marriage still without children), gen}, or null. */
export function nextStep(f, skip = null) {
  const gens = generations(f);
  for (let g = 0; g < gens.length; g++) {
    for (const pid of gens[g]) {
      if ((skip && skip.has(pid)) || !needsFamily(f, pid)) continue;
      const u = unionsInOrder(f, pid).find((x) => M.spouseIn(x, pid));
      return { pid, unionId: u ? u.id : null, gen: g };
    }
  }
  return null;
}

const people = (f) => Object.values(f.persons).filter((p) => !p.blank).length;

/** Totals for the family list: people, generations, and families still to record. */
export function summary(f) {
  const gens = generations(f);
  let left = 0;
  for (const g of gens) for (const pid of g) if (needsFamily(f, pid)) left++;
  return { people: people(f), generations: gens.length, left };
}

/** The state a milestone is measured against (taken before a change). */
export function snapshot(f) {
  const gens = generations(f);
  let done = 0;
  for (const g of gens) {
    if (g.some((pid) => needsFamily(f, pid))) break;
    done++;
  }
  return { people: people(f), done, total: gens.length };
}

const STEPS = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];

/** «صار في الشجرة ١٠٠ شخص» or «اكتمل تسجيل أسر الأحفاد», when a change crossed one; else "". */
export function milestone(f, before) {
  const now = snapshot(f);
  if (now.done > before.done && now.done >= 2) {
    const g = now.done - 1; // the last generation whose families are all recorded
    if (now.done === now.total && g >= 2) return "اكتمل تسجيل كل الأسر المعروفة";
    return `اكتمل تسجيل أسر ${g === 1 ? "الأبناء والبنات" : g === 2 ? "الأحفاد" : `الجيل ${ORD[g] || ar(g)}`}`;
  }
  const step = STEPS.filter((n) => before.people < n && now.people >= n).pop();
  if (step) return `صار في الشجرة ${countPeople(step)}`;
  return "";
}

/** «شخص واحد»، «٥ أشخاص»، «٥٠ شخصًا»، «١٠٠ شخص» */
export function countPeople(n) {
  if (n === 1) return "شخص واحد";
  if (n === 2) return "شخصان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${ar(n)} أشخاص`;
  if (r >= 11) return `${ar(n)} شخصًا`;
  return `${ar(n)} شخص`;
}

export function countGenerations(n) {
  if (n === 1) return "جيل واحد";
  if (n === 2) return "جيلان";
  if (n <= 10) return `${ar(n)} أجيال`;
  return `${ar(n)} جيلًا`;
}

export function countLeft(n) {
  if (!n) return "اكتملت الأسر المعروفة";
  if (n === 1) return "بقيت أسرة واحدة";
  if (n === 2) return "بقيت أسرتان";
  if (n <= 10) return `بقيت ${ar(n)} أسر`;
  return `بقيت ${ar(n)} أسرة`;
}
