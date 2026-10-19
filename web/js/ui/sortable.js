// Press and hold a row, then drag it up or down to a new place in its list.
// Inputs, buttons and links inside the row keep working normally (a press on them never starts a drag).

const IGNORE = "input, textarea, select, button, a, .seg";

/**
 * el: the row; list: its container (rows are the children with the same first class as el);
 * onMove(from, to): called once when the row is dropped at a new place.
 */
export function sortableRow(el, list, onMove, { ignore = IGNORE, hold = 280 } = {}) {
  let timer = null, dragging = false, startY = 0, pointerId = null;
  let rows = [], pitch = 0, index = 0, target = 0;
  const kind = el.classList[0];
  const stopTimer = () => { clearTimeout(timer); timer = null; };

  const begin = () => {
    rows = [...list.children].filter((r) => r.classList.contains(kind));
    index = rows.indexOf(el);
    if (index < 0 || rows.length < 2) return;
    dragging = true;
    try { el.setPointerCapture(pointerId); } catch (e) { /* the pointer is already gone */ }
    const a = rows[0].getBoundingClientRect(), b = rows[1].getBoundingClientRect();
    pitch = b.top - a.top || a.height;
    target = index;
    el.classList.add("dragging");
    list.classList.add("sorting");
    if (navigator.vibrate) navigator.vibrate(12);
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (e.target.closest && e.target.closest(ignore))) return;
    startY = e.clientY; pointerId = e.pointerId;
    timer = setTimeout(begin, hold);
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    if (!dragging) { if (Math.abs(e.clientY - startY) > 8) stopTimer(); return; }
    e.preventDefault();
    const dy = Math.max(-index * pitch - pitch / 2, Math.min((rows.length - 1 - index) * pitch + pitch / 2, e.clientY - startY));
    el.style.transform = `translateY(${dy}px)`;
    target = Math.max(0, Math.min(rows.length - 1, index + Math.round(dy / pitch)));
    rows.forEach((r, j) => {
      if (j === index) return;
      let shift = 0;
      if (index < target && j > index && j <= target) shift = -pitch;
      if (index > target && j < index && j >= target) shift = pitch;
      r.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  });
  const end = () => {
    stopTimer();
    pointerId = null;
    if (!dragging) return;
    dragging = false;
    list.classList.remove("sorting");
    rows.forEach((r) => { r.style.transform = ""; });
    el.classList.remove("dragging");
    if (target !== index) onMove(index, target);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("touchmove", (e) => { if (dragging) e.preventDefault(); }, { passive: false });
  el.addEventListener("contextmenu", (e) => { if (dragging || timer) e.preventDefault(); });
}
