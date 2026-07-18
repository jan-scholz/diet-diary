// Pure formatting and DOM-wiring helpers — no domain or catalog dependencies.

const pad = n => String(n).padStart(2, '0');

// "2026-07-18" — local date, for day keys and prefix matching.
export function localDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-07-18T09:05" — value shape for datetime-local inputs.
export function localDatetime(d) {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-07-18T09:05" -> "2026-07-18" — day key of a stored datetime string.
export function dayKey(datetime) {
  return datetime.slice(0, 10);
}

// Safe for text content and double- or single-quoted attribute values.
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "2026-07-18T09:05" -> "9:05 AM"
export function formatTime(dt) {
  const t = (dt.split('T')[1] || '00:00').slice(0, 5);
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

// One delegated click listener: fires handler(el, e) for the closest descendant
// of root matching selector.
export function delegate(root, selector, handler) {
  root.addEventListener('click', e => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(el, e);
  });
}

// Dismiss a modal when its backdrop or any [data-close] descendant is clicked.
export function bindModalDismiss(modal, onClose) {
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-close]')) onClose();
  });
}
