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

function scaleNutrition(product, quantity) {
  const baseCalories = Array.isArray(product.calories) ? product.calories[0] : product.calories;
  if (!quantity || quantity.kind !== 'weight' || String(quantity.unit).toLowerCase() !== 'g') {
    return { calories: baseCalories, scaled: false };
  }
  const grams = Number(quantity.value);
  if (!grams) return { calories: baseCalories, scaled: false };
  const ratio = grams / product.serving.grams;
  const nutrients = {};
  for (const [key, val] of Object.entries(product.nutrients)) {
    const base = Array.isArray(val.amount) ? val.amount[0] : val.amount;
    nutrients[key] = { ...val, amount: Math.round(base * ratio * 10) / 10 };
  }
  return { calories: Math.round(baseCalories * ratio), nutrients, scaled: true, ratio };
}
