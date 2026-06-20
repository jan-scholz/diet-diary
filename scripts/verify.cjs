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
  log(1, h1.includes('Today') && stats === 3 && quickBtns === 3,
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
  log('2a', selCards > 0 && qtyVal === '173', `Selected=${selCards}, qty=${qtyVal}${qtyUnit}`);

  await page.click('button[onclick="saveAndGo()"]');
  await page.waitForURL('**/entries.html');
  log('2b', true, 'Saved → entries.html');

  // ── Step 3: entries.html — day group, calories in summary ─────────────────
  await page.waitForLoadState('networkidle');
  const rowNm   = await page.locator('.row .nm').first().textContent().catch(() => '');
  const summary = await page.locator('.summary .s').first().textContent().catch(() => '');
  log(3,  !!rowNm,               `First row name="${rowNm}"`);
  log('3a', summary.includes('cal'), `Day summary="${summary}"`);

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

  await page.fill('#js-custom-name', 'Apple');
  await page.selectOption('#js-qty-kind', 'number');
  await page.fill('#js-qty-value', '1');
  await page.fill('#js-qty-unit', 'medium');
  await page.click('button[onclick="saveAndGo()"]');
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
  await page.click('button[onclick="saveAndGo()"]');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const sympSub = await page.locator('.row.symptom .sub').filter({ hasText: 'Severity 3' }).count();
  log(6, sympSub > 0, `Symptom row with "Severity 3 · bloating, cramps": ${sympSub}`);

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

  await page.click('button[onclick="saveAndGo()"]');
  await page.waitForURL('**/entries.html');
  await page.waitForLoadState('networkidle');
  const rowsAfterEdit = await page.locator('.row').count();
  log(8, rowsAfterEdit === allRows,
    `After save: rows=${rowsAfterEdit} (expected ${allRows}, no duplication)`);

  // ── Step 9: Delete — confirm dialog, entry removed ────────────────────────
  page.once('dialog', d => d.accept());
  await page.locator('.row .acts button').first().click();
  await page.waitForTimeout(500);
  const rowsAfterDel = await page.locator('.row').count();
  log(9, rowsAfterDel === rowsAfterEdit - 1,
    `After delete: rows=${rowsAfterDel} (was ${rowsAfterEdit})`);

  // ── Step 10: Export / Import modals ──────────────────────────────────────
  await page.click('button[onclick*="export-modal"]');
  await page.waitForTimeout(200);
  const expOpen = await page.locator('#export-modal.open').count();
  const qr      = await page.locator('.qr svg').count();
  log('10a', expOpen > 0 && qr > 0, `Export modal open=${expOpen}, placeholder QR=${qr}`);

  await page.locator('#export-modal .x-btn').click();
  await page.waitForTimeout(200);
  const expClosed = await page.locator('#export-modal.open').count();
  log('10b', expClosed === 0, 'Export modal closed');

  await page.click('button[onclick*="import-modal"]');
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

  // ── Step 12: labels.html unchanged ───────────────────────────────────────
  await page.goto(BASE + '/labels.html');
  await page.waitForLoadState('networkidle');
  const bodyText  = await page.textContent('body');
  const hasBacon  = bodyText.includes('Bacon');
  const hasQuinoa = bodyText.includes('Quinoa');
  const hasJordans = bodyText.includes('Jordan');
  log(12, hasBacon && hasQuinoa && hasJordans,
    `labels.html: Bacon=${hasBacon}, Quinoa=${hasQuinoa}, Jordans=${hasJordans}`);

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
