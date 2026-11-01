// Exports for Sunny's and Mory's review. Run: node scripts/export-image-list.mjs
//   docs/image-review.csv               every image in the app and where it comes from (checklist 7.7)
//   docs/items-missing-serving-size.csv every item with no PR serving size (checklist 4.17)
//
// The photo URL comes from the app's own getIngredientImage (src/api/ingredientImages.js). localTables.js and
// adapter.js import JSON without import attributes, so Node can't load them; the overlay-layer order and the
// effective-group rule below are small ports of localTables.js ITEM_OVERLAY_LAYERS and adapter.js
// effectiveCoarseGroup. ingredientImages.js has no imports, so a copy with its private tables exported is
// loaded from source; the "how" is then cross-checked against the app's URL (mismatch => UNVERIFIED-LABEL).
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const readJson = (p) => JSON.parse(read(`../src/data/cache/${p}`));

const src = read('../src/api/ingredientImages.js') +
  '\nexport { KEYWORD_MAP, GROUP_FALLBACKS, DEFAULT_FALLBACK, photoUrl };';
const app = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

const items = readJson('items.json');
const recipes = JSON.parse(read('../src/data/recipeOverlay.json'));
const groupLabel = new Map(readJson('groups.json').map((g) => [g.foodGroupID, g.description]));
// Same order as localTables.js ITEM_OVERLAY_LAYERS (later wins).
const layers = [
  ['itemOverlay.generated.json', readJson('itemOverlay.generated.json')],
  ['itemImages.generated.json', readJson('itemImages.generated.json')],
  ['itemOverlay.json', readJson('itemOverlay.json')],
];

function overlayImage(id) {
  let hit;
  for (const [file, layer] of layers) {
    const row = layer[String(id)];
    if (row?.imageFile) hit = { imageFile: row.imageFile, layer: file };
  }
  return hit;
}

// adapter.js effectiveCoarseGroup: coarse 'x'/missing => first letter of the fine group.
function effectiveGroup(it) {
  if (it.coarseFoodGroup && it.coarseFoodGroup !== 'x') return it.coarseFoodGroup;
  return it.fineFoodGroup ? it.fineFoodGroup.charAt(0) : it.coarseFoodGroup || '';
}

// Fine group 'x' is labelled "**** Not Used *****", so those items take their coarse group's label.
const categoryOf = (it) => (it.fineFoodGroup !== 'x' && groupLabel.get(it.fineFoodGroup)) || groupLabel.get(effectiveGroup(it)) || '';

function imageRow(id, name, group, category, fineGroup) {
  const ov = overlayImage(id);
  const image = app.getIngredientImage(name, group, ov?.imageFile);
  const lower = name.toLowerCase();
  const kw = app.KEYWORD_MAP.find(([k]) => lower.includes(k));

  let source, implied, rank;
  if (ov) { source = `overlay: ${ov.layer}`; implied = image; rank = 3; }
  else if (kw) { source = `keyword: ${kw[0]}`; implied = app.photoUrl(kw[1]); rank = 2; }
  else if (app.GROUP_FALLBACKS[group]) { source = `group fallback: ${group}`; implied = app.photoUrl(app.GROUP_FALLBACKS[group]); rank = 1; }
  else { source = 'default fallback'; implied = app.photoUrl(app.DEFAULT_FALLBACK); rank = 0; }
  if (implied !== image) { source = `UNVERIFIED: ${source}`; rank = 0; }

  const icon = app.getNonFoodIcon(group, fineGroup);
  if (icon) source += `; item card shows icon "${icon}" instead`;
  return { id, name, category, source, image, rank };
}

const inItems = new Set(items.map((it) => it.foodItemID));
const rows = [
  ...items.map((it) => imageRow(
    it.foodItemID, it.displayAs || it.description || 'Unknown', effectiveGroup(it), categoryOf(it), it.fineFoodGroup
  )),
  // Recipes from Sunny's list that the item snapshot doesn't carry yet.
  ...recipes.filter((r) => !inItems.has(r.foodItemID)).map((r) => imageRow(r.foodItemID, r.name, undefined, 'Recipes')),
];
// Likeliest mismatches first: default, group fallback, keyword (grouped by keyword), then overlay.
rows.sort((a, b) => a.rank - b.rank || a.source.localeCompare(b.source) || a.name.localeCompare(b.name) || a.id - b.id);

// Every entry of the lookup tables themselves, whether or not an item uses it today.
const tableRows = [
  ...app.KEYWORD_MAP.map(([keyword, id]) => ({ category: 'Keyword table', source: `keyword: ${keyword}`, image: app.photoUrl(id) })),
  ...Object.entries(app.GROUP_FALLBACKS).map(([group, id]) => ({
    category: 'Group fallback table', source: `group fallback: ${group} (${groupLabel.get(group) ?? ''})`, image: app.photoUrl(id),
  })),
  { category: 'Default fallback', source: 'default fallback', image: app.photoUrl(app.DEFAULT_FALLBACK) },
];

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const writeCsv = (path, lines) => fs.writeFileSync(new URL(path, import.meta.url), lines.map((l) => l.map(esc).join(',')).join('\n') + '\n');

writeCsv('../docs/image-review.csv', [
  ['item_id', 'item_name', 'category', 'image_keyword_or_source', 'image_url'],
  ...rows.map((r) => [r.id, r.name, r.category, r.source, r.image]),
  ...tableRows.map((r) => ['', '', r.category, r.source, r.image]),
]);

const missing = items.filter((it) => !/^\d+(\.\d+)?$/.test(String(it.unitOfMeasure ?? '').trim()));
writeCsv('../docs/items-missing-serving-size.csv', [
  ['item_id', 'item_name', 'category', 'unit_of_measure_from_api'],
  ...missing.map((it) => [it.foodItemID, it.displayAs || it.description, categoryOf(it), it.unitOfMeasure]),
]);

console.log(`image-review.csv: ${rows.length} item/recipe rows + ${tableRows.length} table rows`);
console.log(`items-missing-serving-size.csv: ${missing.length} of ${items.length} items`);
const unverified = rows.filter((r) => r.source.startsWith('UNVERIFIED'));
if (unverified.length) console.warn(`WARNING: ${unverified.length} labels disagree with the app resolver; see UNVERIFIED rows`);
