# Diet Diary — Implementation Plan

## Context

`diet-diary` is a static, no-build site (plain HTML/CSS/JS served from disk). Today it has:

- `index.html` — landing page (warm `#f3f0ea` theme, Helvetica, card/button styling). The "Start a new entry" button links to `#` (dead).
- `labels.html` — a working, read-only nutrition-facts viewer that fetches `nutrition.json` and renders bilingual CA-style labels (single + dual-column).
- `nutrition.json` — 7 read-only products (`id`, `name`, `url`, `serving {fraction, grams}`, `calories`, `nutrients`).

What's missing is the diary itself: there is no way to **log** meals, snacks, or symptoms, and nothing connects a logged item to the nutrition catalog. This plan adds a logging + review layer, stored entirely in `localStorage`, that fulfills the existing tagline ("connects what's on your plate to what's on the label").

**Decisions (confirmed with user):**
- Meal/snack entries can **optionally link** to a catalog product; nutrition can be shown/scaled when linked.
- Symptom entries capture **note + severity + tags**.
- **Multi-page** layout, matching the current `index.html` / `labels.html` split.
- Stay vanilla: no framework, no build step, no dependencies.

## Architecture

New files (all static, served as-is):

| File | Purpose |
|---|---|
| `styles.css` | Shared styles extracted from the existing inline CSS (theme, buttons, cards, forms). New pages link it; existing pages can adopt it incrementally. |
| `store.js` | `localStorage` CRUD for diary entries. |
| `catalog.js` | Loads `nutrition.json` once, exposes lookup + nutrition-scaling helpers. |
| `add-entry.html` | Meal/snack form. Type preset via `?type=meal` or `?type=snack`, switchable in the form. |
| `add-symptom.html` | Symptom form (note + severity + tags). |
| `entries.html` | Review/history list with edit + delete. |

`index.html` and `labels.html` are reused; only `index.html` gets new buttons/links.

### Data model (`localStorage`)

Single key `dietDiary.entries` → JSON array. Each entry:

```js
// meal / snack
{
  id: "<crypto.randomUUID()>",
  type: "meal" | "snack",
  datetime: "2026-06-20T13:30",   // local datetime-local string
  name: "Bacon and Caramelized Onions",
  productId: "bacon_pizza" | null, // link into nutrition.json
  quantity: { kind: "weight" | "volume" | "number", value: 173, unit: "g" } | null,
  note: ""
}
// symptom
{
  id, type: "symptom", datetime,
  note: "bloating after lunch",
  severity: 3,                     // 1–5
  tags: ["bloating", "nausea"]     // free + suggested
}
```

`store.js` API: `getEntries()`, `getEntry(id)`, `saveEntry(entry)` (insert or update by `id`), `deleteEntry(id)`, all wrapping `JSON.parse`/`stringify` with a try/catch fallback to `[]`.

## Implementation steps

1. **`styles.css`** — lift the shared look from `index.html` (body theme, `.brand`, `nav`, `.btn`/`.btn-primary`/`.btn-secondary`, `header`/`footer`, `main` container) and add form primitives: `.field`, `label`, `input`, `select`, `textarea`, `.row`, `.chip`/tag styling, `.entry-card`. Keep the existing palette and Helvetica stack.

2. **`store.js`** — implement the CRUD API above over key `dietDiary.entries`. ID via `crypto.randomUUID()`.

3. **`catalog.js`** — `loadCatalog()` fetches `nutrition.json` (reuse its existing shape); `getProduct(id)`; `scaleNutrition(product, quantity)` that, when `quantity.kind === "weight"` and `unit === "g"`, computes `multiplier = grams / product.serving.grams` and scales `calories` + numeric `nutrients[*].amount`. For other quantity kinds (volume/number) or no quantity, return the per-serving values labeled "per serving" (no guessed scaling). Handle dual-column products by using the first column.

4. **`add-entry.html`** — form fields:
   - **Type**: meal/snack toggle, preset from `?type=` query param (default `meal`).
   - **Date & time**: one `<input type="datetime-local">` **pre-filled to now** (set `value` from `new Date()` on load), editable.
   - **Food**: free-text `name`, plus an optional **catalog** `<select>` populated from `catalog.js`. Selecting a product fills `name` and reveals a small nutrition preview.
   - **Quantity (optional)**: a `kind` select (volume / weight / number), a numeric `value`, and a `unit` field (e.g. `ml`, `g`, `slices`). All three optional together.
   - **Note** (optional).
   - On submit: build the entry object, `store.saveEntry`, redirect to `entries.html`. Supports edit mode via `?id=` (pre-fills from `store.getEntry`).

5. **`add-symptom.html`** — `datetime` (pre-filled to now), `note` textarea, `severity` (1–5 radio/range), and `tags` (suggested chips like nausea/bloating/headache/cramps/fatigue that toggle, plus a free-text add). Submit → `store.saveEntry` → `entries.html`. Edit via `?id=`.

6. **`entries.html`** — read `store.getEntries()`, sort by `datetime` descending, group by day. Render each as an `.entry-card` showing type badge, time, name/note, quantity, tags/severity, and (for linked meals/snacks) computed nutrition via `catalog.scaleNutrition`. Each card has **Edit** (→ `add-entry.html?id=` / `add-symptom.html?id=`) and **Delete** (confirm → `store.deleteEntry` → re-render). Empty state with a prompt to add the first entry.

7. **`index.html`** — replace the single dead "Start a new entry" button with the action set: **Add meal** (`add-entry.html?type=meal`), **Add snack** (`add-entry.html?type=snack`), **Add symptoms** (`add-symptom.html`), **Review entries** (`entries.html`), **Browse nutrition labels** (`labels.html`). Switch its `<style>` block to link `styles.css`.

## Reuse notes

- `nutrition.json` shape and the `fmt()`/label-rendering logic already in `labels.html:201` are the reference for displaying nutrient values; reuse the same field names (`nutrients.totalFat.amount`, etc.).
- Keep the exact color/typography tokens from `index.html:8` so new pages are visually consistent.
- No changes to `labels.html` or `nutrition.json`.

## Verification

Static site, so serve locally and click through:

```bash
cd /Users/jan/scratch/apps/diet-diary && uv run python -m http.server 8000
```

Then in a browser at `http://localhost:8000`:
1. **Add meal** — confirm date/time defaults to now; pick a catalog product (e.g. Bacon pizza), set weight `173 g`, save. Verify it appears in `entries.html` with scaled nutrition (~430 cal at one serving).
2. **Add snack** — free-text name, no catalog link, quantity `2 slices` (number). Verify it saves and shows quantity without invented nutrition.
3. **Add symptoms** — note + severity + a couple of tags. Verify it renders with badge/severity/tags.
4. **Edit** an entry, change time/quantity, confirm update (not duplicate). **Delete** one, confirm removal.
5. Reload the page → entries persist (localStorage). Open DevTools → Application → Local Storage → confirm `dietDiary.entries` JSON.
6. Confirm `labels.html` still renders all 7 products unchanged.
