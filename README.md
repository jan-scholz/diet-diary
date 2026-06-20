# Diet Diary

A static, no-build food and symptom diary. Everything runs from plain HTML/CSS/JS; entries are stored in `localStorage`.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Daily dashboard — stats, quick-add buttons, recent entries |
| `add-entry.html` | Add or edit a meal/snack; catalog-first picker with free-text fallback |
| `add-symptom.html` | Add or edit a symptom — note, severity 1–5, tags |
| `entries.html` | Filterable list of all entries grouped by day; Export/Import modals |
| `labels.html` | Read-only nutrition-facts viewer (existing) |

## Running locally

```bash
uv run python -m http.server 8000
```

Then open <http://localhost:8000>.

## Verification

The test suite drives a headless Chromium browser through all 12 scenarios. Run it while the server is up.

**First-time setup** (one time per machine):

```bash
cd scripts
npm install
npx playwright install chromium
cd ..
```

**Run the tests:**

```bash
# server must be running first (see above)
node scripts/verify.cjs
```

Or from inside `scripts/`:

```bash
npm run verify
```

Pass a custom URL as the first argument if you're serving on a different port:

```bash
node scripts/verify.cjs http://localhost:9000
```

### What the tests cover

1. Dashboard loads with correct stat cards and quick-add buttons
2. Add meal — catalog shows all 7 products; selecting one auto-fills the quantity field; saves and redirects
3. `entries.html` groups the entry under the correct day with a calorie summary
4. Dashboard reflects updated meal count and calorie total
5. Add snack via free-text ("Something else") with a custom quantity
6. Add symptom — severity buttons, suggested tag chips, saves with correct detail line
7. Filter chips (Meals / Snacks / Symptoms / All) narrow the list correctly
8. Editing an entry pre-fills the form and updates in place without duplication
9. Deleting an entry shows a confirm dialog and removes it
10. Export modal shows placeholder QR; Import modal shows camera viewfinder; both close cleanly
11. Entries persist across a page reload (localStorage)
12. `labels.html` still renders all 7 nutrition-facts products unchanged

Exit code 0 = all passed; non-zero = one or more failures.
