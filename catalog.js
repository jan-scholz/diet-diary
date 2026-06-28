let _catalog = null;

async function loadCatalog() {
  if (_catalog) return _catalog;
  const res = await fetch('nutrition.json');
  const data = await res.json();
  _catalog = data.products;
  return _catalog;
}

function getProduct(id) {
  return _catalog ? (_catalog.find(p => p.id === id) || null) : null;
}

const GRAMS_PER_UNIT = { g: 1, oz: 28.3495, lb: 453.592 };

function scaleNutrition(product, quantity) {
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
