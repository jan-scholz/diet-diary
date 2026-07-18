let _catalog = null;

export async function loadCatalog() {
  if (_catalog) return _catalog;
  const res = await fetch('data/nutrition.json');
  const data = await res.json();
  _catalog = data.products;
  return _catalog;
}

export function getProduct(id) {
  return _catalog ? (_catalog.find(p => p.id === id) || null) : null;
}

const GRAMS_PER_UNIT = { g: 1, oz: 28.3495, lb: 453.592 };

export function scaleNutrition(product, quantity) {
  const baseCalories = Array.isArray(product.calories) ? product.calories[0] : product.calories;
  const unit = quantity && String(quantity.unit).toLowerCase();
  if (!quantity || quantity.kind !== 'weight' || !GRAMS_PER_UNIT[unit]) {
    return { calories: baseCalories, scaled: false };
  }
  const grams = Number(quantity.value) * GRAMS_PER_UNIT[unit];
  if (!grams) return { calories: baseCalories, scaled: false };
  const ratio = grams / product.serving.grams;
  const nutrients = {};
  for (const [key, val] of Object.entries(product.nutrients)) {
    const base = Array.isArray(val.amount) ? val.amount[0] : val.amount;
    nutrients[key] = { ...val, amount: Math.round(base * ratio * 10) / 10 };
  }
  return { calories: Math.round(baseCalories * ratio), nutrients, scaled: true, ratio };
}

// ── Entry summarization (needs the catalog loaded first) ─────────────────────

// Display name + detail sub-line for any entry (food or symptom).
export function entrySummary(e) {
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
export function dayCalories(entries) {
  let total = 0, has = false;
  for (const e of entries) {
    if ((e.type === 'meal' || e.type === 'snack' || e.type === 'drink') && e.productId) {
      const p = getProduct(e.productId);
      if (p) { total += scaleNutrition(p, e.quantity).calories; has = true; }
    }
  }
  return { total, has };
}
