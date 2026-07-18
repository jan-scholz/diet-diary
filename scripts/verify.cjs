/**
 * End-to-end verification for diet-diary.
 *
 * Setup (one time):
 *   cd scripts && npm install && npx playwright install chromium
 *
 * Run (server must be running first):
 *   uv run python -m http.server 8000   # from project root
 *   node scripts/verify.cjs             # from project root, or:
 *   npm run verify                      # from scripts/
 *
 * Pass a custom base URL as the first argument:
 *   node scripts/verify.cjs http://localhost:9000
 */

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000';

async function main() {
  const results = [];
  const consoleErrors = [];

  function log(step, ok, detail) {
    console.log(`${ok ? '✅' : '❌'} [${step}] ${detail}`);
    results.push({ step, ok, detail });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // Reset state before each run
  await page.goto(BASE + '/index.html');
  await page.evaluate(() => localStorage.clear());

  // ── Step 1: Dashboard ─────────────────────────────────────────────────────
  await page.goto(BASE + '/index.html');
  await page.waitForLoadState('networkidle');
  const h1       = await page.textContent('h1');
  const stats    = await page.locator('.stat').count();
  const quickBtns = await page.locator('.quick .btn').count();
  const empty    = await page.locator('.empty').count();
  log(1, h1.includes('Today') && stats === 4 && quickBtns === 4,
    `h1="${h1}", stats=${stats}, quickBtns=${quickBtns}, emptyState=${empty > 0}`);

  // ── Step 2: Add meal — catalog picker ────────────────────────────────────
  await page.click('a[href="add-entry.html?type=meal"]');
  await page.waitForLoadState('networkidle');
  const addH1   = await page.textContent('h1');
  const dtVal   = await page.inputValue('#js-dt');
  const catalog = await page.locator('.foodcard').count();
  log(2, addH1.includes('Add meal') && !!dtVal && catalog >= 8,
    `h1="${addH1}", dt pre-filled=${!!dtVal}, catalog=${catalog} (7 products + custom)`);

  // Select Bacon pizza (first non-custom card), check auto-fill
  await page.locator('.foodcard:not(.custom)').first().click();
  await page.waitForTimeout(200);
  const selCards = await page.locator('.foodcard.selected').count();
  const qtyVal   = await page.inputValue('#js-qty-value');
  const qtyUnit  = await page.inputValue('#js-qty-unit');
  log('2a', selCards > 0 && qtyVal === '173' && qtyUnit === 'g', `Selected=${selCards}, qty=${qtyVal} ${qtyUnit}`);

  // Unit select — weight gives g/lb options; number disables the select
  const weightOpts = await page.locator('#js-qty-unit option').allTextContents();
  await page.selectOption('#js-qty-kind', 'number');
  await page.waitForTimeout(100);
  const unitDisabled = await page.locator('#js-qty-unit').isDisabled();
  await page.selectOption('#js-qty-kind', 'weight');
  await page.waitForTimeout(100);
  log('2b', weightOpts.includes('g') && weightOpts.includes('lb') && unitDisabled,
    `weight opts=${JSON.stringify(weightOpts)}, number→disabled=${unitDisabled}`);

  // Switching to a second product updates qty to that product's serving.grams
  await page.locator('.foodcard:not(.custom)').nth(1).click(); // sausage_pizza = 243 g
  await page.waitForTimeout(200);
  const switchedQty = await page.inputValue('#js-qty-value');
  log('2c', switchedQty === '243', `Product switch qty=${switchedQty} (expected 243)`);

  await page.click('#js-save');
  await page.waitForURL('**/entries.html');
  log('2d', true, 'Saved → entries.html');

  // ── Step 2e/2f: Top-3 quick picks + search expansion ─────────────────────
  await page.goto(BASE + '/add-entry.html');
  await page.waitForLoadState('networkidle');
  const topCatalog = await page.locator('.foodcard').count();
  log('2e', topCatalog <= 4, `Top-3 mode: ${topCatalog} cards (expected ≤ 4)`);

  await page.locator('#js-search').pressSequentially('pizza');
  await page.waitForTimeout(100);
  const searchCatalog = await page.locator('.foodcard').count();
  log('2f', searchCatalog >= 3, `Search "pizza": ${searchCatalog} cards (expected ≥ 3: 2 products + custom)`);

  await page.goto(BASE + '/entries.html');
  await page.waitForLoadState('networkidle');

  // ── Step 3: entries.html — day group, calories in summary ─────────────────
  await page.waitForLoadState('networkidle');
  const rowNm   = await page.locator('.row .nm').first().textContent().catch(() => '');
  const summary = await page.locator('.summary .s').first().textContent().catch(() => '');
  log(3,  !!rowNm,               `First row name="${rowNm}"`);
  log('3a', summary.includes('cal'), `Day summary="${summary}"`);

  // FAB speed-dial — opens on click, shows 4 actions, backdrop closes it
  const fabExists = await page.locator('.fab-main').count();
  await page.click('.fab-main');
  await page.waitForTimeout(200);
  const fabOpen  = await page.locator('.fab-actions.open').count();
  const fabLinks = await page.locator('.fab-action').count();
  await page.locator('#fab-backdrop').click();
  await page.waitForTimeout(200);
  const fabClosed = await page.locator('.fab-actions.open').count();
  log('3b', fabExists > 0 && fabOpen > 0 && fabLinks === 4 && fabClosed === 0,
    `FAB: exists=${fabExists > 0}, opens=${fabOpen > 0}, links=${fabLinks}, closes=${fabClosed === 0}`);

  // ── Step 4: Dashboard reflects today's stats ──────────────────────────────
  await page.goto(BASE + '/index.html');
  await page.waitForLoadState('networkidle');
  const mealsNum = await page.textContent('#js-meals');
  const calsNum  = await page.textContent('#js-cals');
  log(4, mealsNum.trim() === '1' && calsNum.includes('~'),
    `meals="${mealsNum.trim()}", cals="${calsNum.trim()}"`);

  // ── Step 5: Add snack — free-text name ────────────────────────────────────
  await page.goto(BASE + '/add-entry.html?type=snack');
  await page.waitForLoadState('networkidle');
  const snackH1 = await page.textContent('h1');
  log('5a', snackH1.includes('snack'), `h1="${snackH1}"`);

  await page.locator('.foodcard.custom').click();
  const customVisible = await page.locator('#js-custom-field').isVisible();
  log('5b', customVisible, 'Custom name field visible after selecting "Something else"');

  // Search term pre-fills custom name when "Something else" is clicked
  await page.locator('#js-search').pressSequentially('chia seeds');
  await page.locator('.foodcard.custom').click();
  const preFilledName = await page.inputValue('#js-custom-name');
  log('5c', preFilledName === 'chia seeds', `Search-term pre-fill: name="${preFilledName}"`);

  await page.fill('#js-custom-name', 'Apple');
  await page.selectOption('#js-qty-kind', 'number');
  await page.fill('#js-qty-value', '1');
  await page.click('#js-save');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const appleCount = await page.locator('.row .nm').filter({ hasText: 'Apple' }).count();
  log(5, appleCount > 0, `"Apple" in entries: ${appleCount}`);

  // ── Step 6: Add symptom — severity + tags ─────────────────────────────────
  await page.goto(BASE + '/add-symptom.html');
  await page.waitForLoadState('networkidle');
  const sevBtns = await page.locator('.severity-btn').count();
  const tagCount = await page.locator('.tag-chip').count();
  log('6a', sevBtns === 5 && tagCount >= 5,
    `severity buttons=${sevBtns}, tag chips=${tagCount}`);

  await page.fill('#js-note', 'Bloating after lunch');
  await page.click('.severity-btn[data-v="3"]');
  await page.locator('.tag-chip').filter({ hasText: 'bloating' }).click();
  await page.locator('.tag-chip').filter({ hasText: 'cramps' }).click();

  // Custom tag with a double quote and angle brackets must render as literal
  // text (no markup injection) and toggle like any other chip.
  const nastyTag = 'won"t <fix>';
  await page.fill('#js-tag-input', nastyTag);
  await page.press('#js-tag-input', 'Enter');
  const nastyChip = page.locator('.tag-chip').filter({ hasText: nastyTag });
  const nastyText   = await nastyChip.textContent().catch(() => '');
  const nastyActive = await nastyChip.evaluate(el => el.classList.contains('active')).catch(() => false);
  await nastyChip.click(); // toggle off
  const nastyOff = await nastyChip.evaluate(el => el.classList.contains('active')).catch(() => true);
  await nastyChip.click(); // toggle back on
  const nastyOn  = await nastyChip.evaluate(el => el.classList.contains('active')).catch(() => false);
  log('6b', nastyText === nastyTag && nastyActive && !nastyOff && nastyOn,
    `Special-char tag: text="${nastyText}", added active=${nastyActive}, toggles off=${!nastyOff}, back on=${nastyOn}`);

  await page.click('#js-save');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const sympSub = await page.locator('.row.symptom .sub').filter({ hasText: 'Severity 3' }).count();
  log(6, sympSub > 0, `Symptom row with "Severity 3 · bloating, cramps": ${sympSub}`);

  // Special-char tag shows as literal text in the entries list and round-trips
  // through the edit flow (reappears as a selected chip).
  const nastyInList = await page.locator('.row.symptom .sub').filter({ hasText: nastyTag }).count();
  await page.locator('.row.symptom .acts a').first().click();
  await page.waitForLoadState('networkidle');
  const nastyEditChip = page.locator('.tag-chip').filter({ hasText: nastyTag });
  const nastyEditCount  = await nastyEditChip.count();
  const nastyEditActive = nastyEditCount > 0 &&
    await nastyEditChip.evaluate(el => el.classList.contains('active'));
  log('6c', nastyInList > 0 && nastyEditActive,
    `Special-char tag in entries list=${nastyInList > 0}, selected on edit=${nastyEditActive}`);
  await page.goto(BASE + '/entries.html'); // leave edit without saving
  await page.waitForLoadState('networkidle');

  // ── Step 7: Filter chips ──────────────────────────────────────────────────
  const totalRows = await page.locator('.row').count();

  await page.locator('.chip[data-filter="meal"]').click();
  await page.waitForTimeout(300);
  const mealRows   = await page.locator('.row').count();
  const sympInMeal = await page.locator('.row.symptom').count();
  log(7, sympInMeal === 0 && mealRows > 0,
    `Meal filter: rows=${mealRows}, symptoms visible=${sympInMeal}`);

  await page.locator('.chip[data-filter="symptom"]').click();
  await page.waitForTimeout(300);
  const sympTotal = await page.locator('.row').count();
  const sympClass = await page.locator('.row.symptom').count();
  log('7a', sympTotal === sympClass,
    `Symptom filter: total rows=${sympTotal}, .symptom rows=${sympClass}`);

  await page.locator('.chip[data-filter="all"]').click();
  await page.waitForTimeout(300);
  const allRows = await page.locator('.row').count();
  log('7b', allRows === totalRows, `All filter: rows=${allRows} (expected ${totalRows})`);

  // ── Step 8: Edit — pre-fills, no duplication on save ─────────────────────
  const editLink = page.locator('.row .acts a').first();
  const editHref = await editLink.getAttribute('href');
  await editLink.click();
  await page.waitForLoadState('networkidle');
  const editH1 = await page.textContent('h1');
  const editDt = await page.inputValue('#js-dt');
  log('8a', editH1.toLowerCase().includes('edit') && !!editDt,
    `Edit page: h1="${editH1}", href="${editHref}"`);

  await page.click('#js-save');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const rowsAfterEdit = await page.locator('.row').count();
  log(8, rowsAfterEdit === allRows,
    `After save: rows=${rowsAfterEdit} (expected ${allRows}, no duplication)`);

  // ── Step 8b/8c: Edit drink — type round-trips (issue #1) ─────────────────
  await page.goto(BASE + '/add-entry.html?type=drink');
  await page.waitForLoadState('networkidle');
  await page.locator('#js-search').pressSequentially('juice');
  await page.locator('.foodcard:not(.custom)').first().click();
  await page.click('#js-save');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const drinkId = await page.evaluate(async () => {
    const { getEntries } = await import('/js/store.js');
    return getEntries().find(e => e.type === 'drink')?.id;
  });

  await page.goto(BASE + `/add-entry.html?id=${drinkId}`);
  await page.waitForLoadState('networkidle');
  const drinkEditH1 = await page.textContent('h1');
  const drinkBtnActive = await page.locator('#btn-drink.active').count();
  log('8b', drinkEditH1 === 'Edit drink' && drinkBtnActive === 1,
    `Edit drink pre-select: h1="${drinkEditH1}", Drink button active=${drinkBtnActive}`);

  await page.click('#js-save');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const savedDrinkType = await page.evaluate(async id => {
    const { getEntry } = await import('/js/store.js');
    return getEntry(id)?.type;
  }, drinkId);
  await page.locator('.chip[data-filter="drink"]').click();
  await page.waitForTimeout(300);
  const drinkFilterRows = await page.locator('.row').count();
  log('8c', savedDrinkType === 'drink' && drinkFilterRows === 1,
    `After save: type="${savedDrinkType}" (expected "drink"), Drinks filter rows=${drinkFilterRows}`);

  // Clean up the drink entry so step 9's row arithmetic is unaffected
  await page.evaluate(async id => {
    const { deleteEntry } = await import('/js/store.js');
    deleteEntry(id);
  }, drinkId);
  await page.goto(BASE + '/entries.html');
  await page.waitForLoadState('networkidle');

  // ── Step 9: Delete — confirm dialog, entry removed ────────────────────────
  page.once('dialog', d => d.accept());
  await page.locator('.row .acts button').first().click();
  await page.waitForTimeout(500);
  const rowsAfterDel = await page.locator('.row').count();
  log(9, rowsAfterDel === rowsAfterEdit - 1,
    `After delete: rows=${rowsAfterDel} (was ${rowsAfterEdit})`);

  // ── Step 10: Export / Import modals ──────────────────────────────────────
  await page.click('#js-export');
  await page.waitForTimeout(300);
  const expOpen = await page.locator('#export-modal.open').count();
  const qr      = await page.locator('.qr canvas').count();
  log('10a', expOpen > 0 && qr > 0, `Export modal open=${expOpen}, QR canvas=${qr}`);

  await page.locator('#export-modal .x-btn').click();
  await page.waitForTimeout(200);
  const expClosed = await page.locator('#export-modal.open').count();
  log('10b', expClosed === 0, 'Export modal closed');

  await page.click('#js-import');
  await page.waitForTimeout(200);
  const impOpen = await page.locator('#import-modal.open').count();
  const vf      = await page.locator('.viewfinder').count();
  log('10c', impOpen > 0 && vf > 0,
    `Import modal open=${impOpen}, camera viewfinder=${vf}`);

  await page.locator('#import-modal .x-btn').click();
  await page.waitForTimeout(200);
  const impClosed = await page.locator('#import-modal.open').count();
  log(10, impClosed === 0, 'Import modal closed');

  // ── Step 11: localStorage persistence across reload ───────────────────────
  const beforeReload = await page.locator('.row').count();
  await page.reload();
  await page.waitForLoadState('networkidle');
  const afterReload = await page.locator('.row').count();
  log(11, afterReload === beforeReload,
    `Persist: before=${beforeReload}, after=${afterReload}`);

  // ── Step 12: labels.html — header, search-to-select UX ──────────────────────
  await page.goto(BASE + '/labels.html');
  await page.waitForLoadState('networkidle');
  const labH1    = await page.textContent('h1');
  const labSuggestions = await page.locator('.suggestion').count();
  const labEmpty       = await page.locator('#js-label').innerHTML();
  log('12a', labH1.includes('Nutrition') && labSuggestions === 0 && labEmpty.trim() === '',
    `h1="${labH1}", suggestions on load=${labSuggestions}, label empty=${labEmpty.trim() === ''}`);

  // Typing shows matching suggestions
  await page.locator('#js-search').pressSequentially('pizza');
  await page.waitForTimeout(100);
  const suggestCards = await page.locator('.suggestion').count();
  log('12b', suggestCards >= 2, `Search "pizza": ${suggestCards} suggestions`);

  // Selecting a suggestion fills the search box, hides suggestions, shows label
  await page.locator('.suggestion').first().click();
  await page.waitForTimeout(200);
  const searchVal    = await page.inputValue('#js-search');
  const suggestAfter = await page.locator('.suggestion').count();
  const labelEl      = await page.locator('#js-label .label').count();
  const labelTxt     = await page.locator('#js-label').textContent();
  log(12, searchVal.length > 0 && suggestAfter === 0 && labelEl > 0 && labelTxt.includes('Nutrition Facts'),
    `search="${searchVal}", suggestions hidden=${suggestAfter === 0}, label shown=${labelEl > 0}`);

  // ── Step 13: QR sync (sync.js) ──────────────────────────────────────────────
  // Runs last so seeding/wiping localStorage here can't disturb earlier steps.
  // Exercises the full export->QR->jsQR-decode->decompress->merge path in-page,
  // bypassing only the physical camera (decoded bytes are fed straight to jsQR
  // from a rendered QR canvas).
  await page.goto(BASE + '/entries.html');
  await page.waitForLoadState('networkidle');

  const roundTrip = await page.evaluate(async () => {
    const { getEntries, setEntries } = await import('/js/store.js');
    const { buildSyncChunks, renderChunkQR, parseChunkHeader, reassemble, applyImported } = await import('/js/sync.js');
    const seed = [
      { id: '1', type: 'meal',  datetime: '2026-06-19T08:00', productId: 'turpone_bacon_pizza', quantity: { kind: 'weight', value: 150, unit: 'g' }, note: '' },
      { id: '2', type: 'snack', datetime: '2026-06-19T15:30', productId: null, name: 'Toast with butter', quantity: null, note: '' },
      { id: '3', type: 'symptom', datetime: '2026-06-20T21:00', note: 'bloated', severity: 3, tags: ['bloating', 'nausea'] },
      // padding with high-entropy notes to defeat compression and force >1 chunk
      ...Array.from({ length: 60 }, (_, i) => ({
        id: 'p' + i, type: 'meal', datetime: '2026-06-21T12:00', productId: 'oatmeal_classic',
        quantity: { kind: 'weight', value: 40 + i, unit: 'g' },
        note: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) })),
    ];
    setEntries(seed);

    const chunks = await buildSyncChunks();
    const collected = new Map();
    let total = 0;
    for (const chunk of chunks) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 360;
      renderChunkQR(canvas, chunk);
      const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const res = jsQR(img.data, img.width, img.height);
      if (!res) return { ok: false };
      const bytes = Uint8Array.from(res.binaryData);
      const h = parseChunkHeader(bytes);
      total = h.total;
      collected.set(h.seq, bytes);
    }

    setEntries([]);
    await applyImported(reassemble(collected, total));
    const got = getEntries();
    return { ok: JSON.stringify(got) === JSON.stringify(seed), chunks: chunks.length, seedLen: seed.length, gotLen: got.length };
  });
  log('13a', roundTrip.ok,
    `round-trip via ${roundTrip.chunks} QR code(s): ${roundTrip.gotLen}/${roundTrip.seedLen} entries match`);

  const merge = await page.evaluate(async () => {
    const { getEntries, setEntries } = await import('/js/store.js');
    const { mergeByDay } = await import('/js/sync.js');
    setEntries([
      { id: 'a', type: 'meal', datetime: '2026-06-01T08:00', note: '' },
      { id: 'b', type: 'meal', datetime: '2026-06-02T08:00', note: '' },
      { id: 'c', type: 'meal', datetime: '2026-06-02T12:00', note: '' },
      { id: 'd', type: 'meal', datetime: '2026-06-03T08:00', note: '' },
    ]);
    // Import covers days 2 & 3. Day 2 dropped entry 'c' (a deletion); day 3 edited.
    mergeByDay([
      { id: 'b', type: 'meal', datetime: '2026-06-02T08:00', note: 'edited' },
      { id: 'd', type: 'meal', datetime: '2026-06-03T08:00', note: 'edited' },
    ]);
    const ids = getEntries().map(e => e.id).sort();
    return {
      day1Kept: ids.includes('a'),
      deletionPropagated: !ids.includes('c'),
      day2Replaced: getEntries().find(e => e.id === 'b').note === 'edited',
      ids: ids.join(','),
    };
  });
  log(13, merge.day1Kept && merge.deletionPropagated && merge.day2Replaced,
    `day-merge: day1 kept=${merge.day1Kept}, deletion propagated=${merge.deletionPropagated}, day2 replaced=${merge.day2Replaced} (ids: ${merge.ids})`);

  // ── Step 14: no inline event handlers on any page (incl. rendered lists) ──
  // Entries from step 13's merge are still in localStorage, so dynamic lists render rows.
  const inlineCounts = [];
  for (const p of ['index.html', 'add-entry.html', 'add-symptom.html', 'entries.html', 'labels.html', 'storage.html']) {
    await page.goto(BASE + '/' + p);
    await page.waitForLoadState('networkidle');
    const n = await page.locator('[onclick], [oninput], [onchange], [onsubmit], [onkeydown]').count();
    if (n > 0) inlineCounts.push(`${p}:${n}`);
  }
  log(14, inlineCounts.length === 0,
    inlineCounts.length === 0 ? 'no inline event handlers on any page' : `inline handlers found: ${inlineCounts.join(', ')}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  if (consoleErrors.length) {
    console.log('\n⚠️  Console / page errors:');
    consoleErrors.forEach(e => console.log('  ' + e));
  } else {
    console.log('\n✅  No console errors');
  }

  await browser.close();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n═══ SUMMARY: ${passed} passed, ${failed} failed ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(2); });
