// Shared page helpers: formatting, escaping, and entry display logic.
// entrySummary/dayCalories look up products at call time, so pages must
// await loadCatalog() (catalog.js) before rendering with them.

const pad = n => String(n).padStart(2, '0');

// Safe for text content and double- or single-quoted attribute values.
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "2026-07-18T09:05" -> "9:05 AM"
function formatTime(dt) {
  const t = (dt.split('T')[1] || '00:00').slice(0, 5);
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Display name + detail sub-line for any entry (food or symptom).
function entrySummary(e) {
  if (e.type === 'symptom') {
    const parts = [];
    if (e.severity) parts.push(`Severity ${e.severity}`);
    if (e.tags && e.tags.length) parts.push(e.tags.join(', '));
    return { name: e.note || 'Symptom', sub: parts.join(' · ') };
  }
  const name = (e.productId ? getProduct(e.productId)?.name : null) ?? e.name ?? 'Entry';
  const parts = [];
  if (e.quantity && e.quantity.value) parts.push(e.quantity.unit ? `${e.quantity.value} ${e.quantity.unit}` : `${e.quantity.value}`);
  if (e.productId) {
    const p = getProduct(e.productId);
    if (p) parts.push(`~${scaleNutrition(p, e.quantity).calories} cal`);
  }
  return { name, sub: parts.join(' · ') };
}

// Estimated calorie total across food entries with a catalog product attached.
function dayCalories(entries) {
  let total = 0, has = false;
  for (const e of entries) {
    if ((e.type === 'meal' || e.type === 'snack' || e.type === 'drink') && e.productId) {
      const p = getProduct(e.productId);
      if (p) { total += scaleNutrition(p, e.quantity).calories; has = true; }
    }
  }
  return { total, has };
}
