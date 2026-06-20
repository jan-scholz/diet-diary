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
