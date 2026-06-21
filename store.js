const _STORE_KEY = 'dietDiary.entries';

function getEntries() {
  try { return JSON.parse(localStorage.getItem(_STORE_KEY)) || []; }
  catch { return []; }
}

function getEntry(id) {
  return getEntries().find(e => e.id === id) || null;
}

function saveEntry(entry) {
  const entries = getEntries();
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  localStorage.setItem(_STORE_KEY, JSON.stringify(entries));
}

function deleteEntry(id) {
  const entries = getEntries().filter(e => e.id !== id);
  localStorage.setItem(_STORE_KEY, JSON.stringify(entries));
}

function getTopProductIds(n) {
  const counts = {};
  for (const e of getEntries()) {
    if (e.productId) counts[e.productId] = (counts[e.productId] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);
}
