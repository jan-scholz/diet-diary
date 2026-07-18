// Pure formatting helpers — no domain or catalog dependencies.

export const pad = n => String(n).padStart(2, '0');

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
