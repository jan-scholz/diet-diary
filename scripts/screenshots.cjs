/**
 * Generate the repo screenshots in docs/:
 *   entries.png    two-day diary list
 *   dashboard.png  today-at-a-glance dashboard
 *   label.png      nutrition label with a product selected
 *   hero.png       three-up montage of the above (README hero)
 *
 * Run (server must be running first):
 *   uv run python -m http.server 8000   # from project root
 *   node scripts/screenshots.cjs        # from project root
 *
 * Or just `make screenshots`, which manages the server for you.
 * Pass a custom base URL as the first argument.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000';
const OUT = path.join(__dirname, '..', 'docs');

// Two days of demo data exercising every entry kind: catalog meals (with
// auto-computed calories), free-text entries, weight/count snacks, and symptoms.
const ENTRIES = [
  // ── Yesterday ──
  { id: 'd1-1', type: 'meal',    datetime: '2026-06-20T08:15', productId: 'jordans_muesli_super_berry', quantity: { kind: 'weight', value: 60, unit: 'g' }, note: '' },
  { id: 'd1-2', type: 'snack',   datetime: '2026-06-20T10:30', productId: null, name: 'Apple', quantity: { kind: 'number', value: 1, unit: '' }, note: '' },
  { id: 'd1-3', type: 'meal',    datetime: '2026-06-20T13:00', productId: 'turpone_bacon_pizza', quantity: { kind: 'weight', value: 200, unit: 'g' }, note: '' },
  { id: 'd1-4', type: 'symptom', datetime: '2026-06-20T15:00', note: 'Mild bloating after lunch', severity: 2, tags: ['bloating'] },
  { id: 'd1-5', type: 'snack',   datetime: '2026-06-20T16:30', productId: null, name: 'Greek yogurt', quantity: { kind: 'weight', value: 150, unit: 'g' }, note: '' },
  { id: 'd1-6', type: 'meal',    datetime: '2026-06-20T19:30', productId: 'turpone_bacon_pizza', quantity: { kind: 'weight', value: 250, unit: 'g' }, note: '' },

  // ── Today ──
  { id: 'd2-1', type: 'meal',    datetime: '2026-06-21T08:00', productId: 'one_degree_quinoa_hemp_oatmeal', quantity: { kind: 'weight', value: 50, unit: 'g' }, note: '' },
  { id: 'd2-2', type: 'snack',   datetime: '2026-06-21T10:45', productId: null, name: 'Banana', quantity: { kind: 'number', value: 1, unit: '' }, note: '' },
  { id: 'd2-3', type: 'meal',    datetime: '2026-06-21T12:45', productId: null, name: 'Chicken & avocado salad', quantity: { kind: 'weight', value: 320, unit: 'g' }, note: '' },
  { id: 'd2-4', type: 'symptom', datetime: '2026-06-21T14:00', note: 'Headache, low energy', severity: 3, tags: ['headache', 'fatigue'] },
  { id: 'd2-5', type: 'snack',   datetime: '2026-06-21T16:15', productId: null, name: 'Almonds', quantity: { kind: 'weight', value: 30, unit: 'g' }, note: '' },
  { id: 'd2-6', type: 'meal',    datetime: '2026-06-21T19:00', productId: 'turpone_bacon_pizza', quantity: { kind: 'weight', value: 200, unit: 'g' }, note: '' },
];

// Brand names to blank out in the rendered screenshots only (the underlying data
// in nutrition.json is untouched) so the repo images don't reproduce brand marks.
const BRANDS = ['Turpone'];

async function stripBrands(page) {
  await page.evaluate((brands) => {
    const re = new RegExp('\\b(?:' + brands.join('|') + ')\\s*', 'g');
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const n of nodes) { const v = n.nodeValue.replace(re, ''); if (v !== n.nodeValue) n.nodeValue = v; }
    for (const inp of document.querySelectorAll('input')) { const v = inp.value.replace(re, ''); if (v !== inp.value) inp.value = v; }
  }, BRANDS);
}

async function shot(page, url, file) {
  await page.goto(BASE + url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await stripBrands(page);
  const p = path.join(OUT, file);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Seed demo data, then capture the diary views.
  await page.goto(BASE + '/index.html');
  await page.evaluate(e => localStorage.setItem('dietDiary.entries', JSON.stringify(e)), ENTRIES);
  const entriesPng   = await shot(page, '/entries.html', 'entries.png');
  const dashboardPng = await shot(page, '/index.html', 'dashboard.png');

  // Nutrition label with the (same) Turpone pizza selected.
  await page.goto(BASE + '/labels.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#js-search').pressSequentially('bacon');
  await page.waitForTimeout(150);
  await page.locator('.suggestion').first().click();
  await page.waitForTimeout(300);
  await stripBrands(page);
  const labelPng = path.join(OUT, 'label.png');
  await page.screenshot({ path: labelPng, fullPage: true });

  // Compose a three-up hero montage from the captured PNGs (no extra tooling).
  // Transparent canvas; each screenshot is shrunk inside a rounded "phone" mask
  // whose app-coloured fill patches the gaps around the shrunken image.
  const dataUri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const phone = f =>
    `<div style="display:flex; align-items:center; justify-content:center;
        width:300px; height:640px; border-radius:34px; background:#f3f0ea;
        box-shadow:0 10px 34px rgba(0,0,0,.16);">
       <img src="${dataUri(f)}" style="width:264px; height:600px; object-fit:cover;
        object-position:top; border-radius:18px;">
     </div>`;
  await page.setViewportSize({ width: 1060, height: 820 });
  await page.setContent(`
    <div id="hero" style="display:inline-flex; gap:24px; padding:40px;
        background:transparent; align-items:flex-start; font-size:0;">
      ${[dashboardPng, entriesPng, labelPng].map(phone).join('')}
    </div>`);
  await page.waitForTimeout(100);
  await page.locator('#hero').screenshot({ path: path.join(OUT, 'hero.png'), omitBackground: true });

  await browser.close();
  console.log('saved docs/{entries,dashboard,label,hero}.png');
})();
