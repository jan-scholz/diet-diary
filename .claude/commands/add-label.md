# add-label

Process a screenshot of a nutrition facts label and add the product to `nutrition.json`.

## Usage

```
/add-label <path-to-screenshot>
```

The argument is the file path to a screenshot (PNG, JPG, or WEBP) of a nutrition facts label.

## Steps

### 1 — Read the image

Use the Read tool to view the screenshot at the provided path. Extract every value visible on the label:

- Product name (if shown on the label or packaging)
- Serving size (fraction label, e.g. "1/3 pizza", and grams)
- Calories (single value, or two values if dual-column "as sold / with milk")
- All nutrient rows: Total Fat, Saturated Fat, Trans Fat, Carbohydrate, Fibre/Fiber, Sugars, Protein, Cholesterol, Sodium, Potassium, Calcium, Iron — capture both the amount+unit and the % Daily Value
- Whether the label is dual-column (has two sets of values, e.g. "As sold" + "With ½ cup milk")
- Any serving note (e.g. "About 1½ cups when prepared with ½ cup 2% milk")
- Language: if the label is bilingual (English + French) note the French fraction label

### 2 — Read the existing nutrition.json

Use the Read tool to load `nutrition.json` from the project root. Study the existing product structure carefully — match it exactly, including field names, nesting, and which fields are optional.

Key schema notes:
- `id`: lowercase snake_case, derived in step 3
- `name`: human-readable, includes major food category (step 3)
- `url`: product page URL (step 4), omit if not found
- `image`: product image URL (step 5), omit if not found
- `serving.fraction`: English label, e.g. `"1/3 pizza"`
- `serving.fractionFr`: French label if bilingual, e.g. `"1/3 pizza"` — omit if not bilingual
- `serving.grams`: number
- `servingNote` / `servingNoteFr`: only present if the label has a preparation note
- `columns`: only present for dual-column labels — array of `{ label, labelFr? }` objects
- `calories`: number for single-column, array of two numbers for dual-column
- Each nutrient: `{ amount, unit, dv? }` — `dv` is omitted if not shown; for dual-column `dv` is an array of two numbers

### 3 — Assign id and name

**id**: Derive a short, unique, lowercase snake_case identifier. Use the main food category + a distinguishing word (e.g. `bacon_pizza`, `quinoa_hemp_oatmeal`, `muesli_four_nut`). Check existing ids and avoid collisions.

**name**: Human-readable string. Include the major food category as the first or most prominent word so search works (e.g. "Pizza — Bacon and Caramelized Onions", "Oatmeal — Sprouted Quinoa Hemp"). If the brand is relevant, include it (e.g. "Jordans Morning Muesli — Four Nut"). Keep the brand and category prefix short, so that the distinguishing part of the name doesn't get cut off on narrow screen. Length of entire name should be less than 70 characters.

### 4 — Research product URL

Use WebSearch and WebFetch to find the manufacturer's or retailer's product page:
- Search for the product name + brand (if visible on label)
- Prefer the official manufacturer website
- Set `url` to the product page URL
- If no credible URL is found, omit the field

### 5 — Research product image

Use WebFetch on the product page URL (from step 4) to find the main product image:
- Look for `<img>` src attributes on the product page — prefer the hero/main product image
- Must be a direct image URL (ending in .jpg, .png, .webp, or with an image content-type)
- If the manufacturer site is inaccessible (403), try retailer sites (well.ca, amazon.ca, healthyplanetcanada.com, etc.) via WebSearch
- Set `image` to the full absolute URL
- If no image is found, omit the field

### 6 — Insert into nutrition.json

Use the Read tool to confirm the current file state, then use the Edit tool to append the new product object to the `"products"` array in `nutrition.json`. Place it at the end of the array (before the closing `]`).

Validate before writing:
- JSON is valid (no trailing commas, correct nesting)
- All required fields are present (`id`, `name`, `serving`, `calories`, `nutrients` with all 12 nutrient keys)
- Optional fields (`url`, `image`, `columns`, `servingNote`, `fractionFr`, etc.) are included only when applicable
- The `id` does not already exist in the file

### 7 — Confirm

Report back:
- The assigned `id` and `name`
- Which optional fields were included
- The product URL and image URL found (or note if not found)
- Any values that were unclear or missing from the label image
