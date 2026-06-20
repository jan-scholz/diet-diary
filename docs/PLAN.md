# Diet Diary — Implementation Plan

## Context

`diet-diary` is a static, no-build site (plain HTML/CSS/JS served from disk). Today it has:

- `index.html` — landing page (warm `#f3f0ea` theme, Helvetica, card/button styling). The "Start a new entry" button links to `#` (dead).
- `labels.html` — a working, read-only nutrition-facts viewer that fetches `nutrition.json` and renders bilingual CA-style labels (single + dual-column).
- `nutrition.json` — 7 read-only products (`id`, `name`, `url`, `serving {fraction, grams}`, `calories`, `nutrients`).

What's missing is the diary itself: there is no way to **log** meals, snacks, or symptoms, and nothing connects a logged item to the nutrition catalog. This plan adds a logging + review layer, stored entirely in `localStorage`.

The UI has been designed up front as static mockups in **`mockups/`** (open `mockups/index.html`). The chosen directions — to be ported to the real pages — are:

- **Main page** → `mockups/main-a.html` — "Warm paper" daily dashboard.
- **Meal/snack entry** → `mockups/meal-a.html` — catalog-first picker.
- **Entries review** → `mockups/entries-a.html` — filterable dense rows with Export / Import.

**Decisions (confirmed with user):**
- Meal/snack entries can **optionally link** to a catalog product; nutrition is shown/scaled when linked.
- Symptom entries capture **note + severity + tags**.
- **Multi-page** layout; **Warm paper** theme is the locked reference (beige `#f3f0ea`, bordered white cards, 12px radius, dark `#1a1a1a` accents, monochrome line icons).
- **Export / Import via QR code** (see below) — **built as mockup modals first**; data encoding and conflict resolution deferred.
- Stay vanilla: no framework, no build step, no dependencies.

## Architecture

New files (all static, served as-is):

| File | Purpose | Mockup source |
|---|---|---|
| `styles.css` | Shared theme + form/card/row primitives extracted from the mockups. | all `mockups/*-a.html` |
| `store.js` | `localStorage` CRUD for diary entries. | — |
| `catalog.js` | Loads `nutrition.json` once; lookup + nutrition-scaling helpers. | — |
| `index.html` | Daily dashboard home (replaces current landing page). | `mockups/main-a.html` |
| `add-entry.html` | Meal/snack entry, catalog-first. Type preset via `?type=meal`/`?type=snack`. | `mockups/meal-a.html` |
| `add-symptom.html` | Symptom entry (note + severity + tags). | follows meal-entry form pattern |
| `entries.html` | Review list: filters, per-day summary, dense rows, Export/Import. | `mockups/entries-a.html` |

`labels.html` and `nutrition.json` are reused unchanged.

### Chosen UX per page

- **`index.html` (dashboard):** date + "Today at a glance"; a 3-stat row (Meals, Snacks, Calories logged); three white quick-add buttons with line icons (Add meal / Add snack / Add symptom); a "Recent entries" list with a "View all" link. Top-bar nav: Entries, Nutrition Labels.
- **`add-entry.html` (catalog-first):** top row pairs the **Meal/Snack** segmented toggle with the **Date & time** `datetime-local` (pre-filled to now). Then **Choose food**: a search box over selectable catalog cards (name · serving · calories) plus a "Something else — type it in" free-text fallback. Then optional **Quantity** (kind select: weight/volume/number · amount · unit). Save / Cancel.
- **`add-symptom.html`:** same form shell — top row with Date & time (pre-filled to now); a **note** textarea; **severity** (1–5); **tags** (suggested toggle chips like nausea/bloating/headache/cramps/fatigue + free-text add). Save / Cancel.
- **`entries.html` (filterable dense rows):** page header with **Export** / **Import** buttons; filter chips (All / Meals / Snacks / Symptoms); per-day sections each with a summary line (entry count + calorie total) and compact rows (time · type · name+detail · Edit/Delete).

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
  tags: ["bloating", "nausea"]     // suggested + free
}
```

`store.js` API: `getEntries()`, `getEntry(id)`, `saveEntry(entry)` (insert or update by `id`), `deleteEntry(id)`, all wrapping `JSON.parse`/`stringify` with a try/catch fallback to `[]`.

### Export / Import (QR) — mockup first

Both are **modals built as mockups now**; the real data pipeline is deferred.

- **Export** opens a modal showing a **QR code** (placeholder graphic for now). *Later:* decide which slice of `localStorage` to encode and how to generate the QR (size limits may force chunking or a compact encoding).
- **Import** opens a modal showing a **camera viewfinder** mockup ("Point your camera at the QR on the other device"). *Later:* wire up the device camera to scan a QR from another device, then decode and merge. *Later:* define conflict resolution (e.g. dedupe by `id`, last-write-wins, or merge prompts).

For this phase: render the modals, the placeholder QR, and the viewfinder framing; buttons open/close them. No real encoding, camera, or merge yet. Both modals live on `entries.html`.

## Implementation steps

1. **`styles.css`** — extract the shared Warm-paper tokens and components from the mockups: theme/body, `header`/`nav`/`footer`, `.btn`/`.btn-primary`/`.btn-secondary`, `.segmented` toggle, form fields (`input`/`select`/`textarea`, `.field`, `.qty-row`, `.toprow`), `.foodcard` catalog cards, dashboard `.stat`s, entries `.chip` filters / `.summary` / `.row`, and a `.modal` overlay. Keep palette and Helvetica stack exactly.
2. **`store.js`** — CRUD API above over key `dietDiary.entries`; IDs via `crypto.randomUUID()`.
3. **`catalog.js`** — `loadCatalog()` fetches `nutrition.json`; `getProduct(id)`; `scaleNutrition(product, quantity)` scaling `calories` + numeric `nutrients[*].amount` by `grams / serving.grams` when `quantity.kind === "weight"` and `unit === "g"`; otherwise return per-serving values (no guessed scaling). Use the first column for dual-column products.
4. **`index.html`** — rebuild as the dashboard from `mockups/main-a.html`; compute the stat counts/calories and the "Recent entries" list from `store.getEntries()`; link `styles.css`.
5. **`add-entry.html`** — port `mockups/meal-a.html`; populate catalog cards from `catalog.js`; pre-fill `datetime` to now; preset type from `?type=`; support edit via `?id=`; on submit `store.saveEntry` → `entries.html`.
6. **`add-symptom.html`** — same shell with note/severity/tags; pre-fill `datetime`; edit via `?id=`; submit → `entries.html`.
7. **`entries.html`** — port `mockups/entries-a.html`; render from `store.getEntries()` sorted desc, grouped by day with per-day summaries; filter chips; Edit (→ `add-entry.html?id=` / `add-symptom.html?id=`) and Delete (confirm → `store.deleteEntry` → re-render); empty state. Wire **Export**/**Import** buttons to their **mockup modals** (placeholder QR / camera viewfinder).

## Reuse notes

- `nutrition.json` shape and the nutrient field names / `fmt()` logic in `labels.html:201` are the reference for displaying values; reuse the same field names (`nutrients.totalFat.amount`, etc.).
- Take exact color/typography/spacing tokens from the `mockups/*-a.html` files so the real pages match the approved designs.
- No changes to `labels.html` or `nutrition.json`.

## Verification

Static site, so serve locally and click through:

```bash
cd /Users/jan/scratch/apps/diet-diary && uv run python -m http.server 8000
```

Then at `http://localhost:8000`:
1. **Add meal** — confirm date/time defaults to now; pick a catalog product (e.g. Bacon pizza), set weight `173 g`, save. Verify it appears in `entries.html` and the dashboard with scaled nutrition (~430 cal at one serving).
2. **Add snack** — free-text name, no catalog link, quantity `2 slices` (number). Verify it saves and shows quantity without invented nutrition.
3. **Add symptoms** — note + severity + a couple of tags. Verify it renders with severity/tags.
4. **Entries page** — filter chips narrow the list by type; per-day summary shows counts + calorie totals. **Edit** an entry and confirm update (not duplicate); **Delete** one and confirm removal.
5. **Export / Import** — Export opens the modal with the placeholder QR; Import opens the camera-viewfinder mockup; both close cleanly. (No real data transfer yet — deferred.)
6. Reload → entries persist (localStorage). DevTools → Application → Local Storage → confirm `dietDiary.entries` JSON.
7. Confirm `labels.html` still renders all 7 products unchanged.

## Deferred (post-mockup)

- Decide which `localStorage` data to encode in the export QR and how to generate it (size limits, chunking, compact encoding).
- Wire the device camera for Import to scan a QR from another device, decode, and merge.
- Define import conflict resolution (dedupe by `id`, last-write-wins, or prompt).
