// Export every food item's resolved photo + how it was resolved, for mismatch review (checklist 7.7).
// Run: node scripts/export-image-list.mjs   ->  docs/image-list-for-review.csv
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

const ORDER = { 'default-fallback': 0, 'group-fallback': 1, keyword: 2, overlay: 3, 'UNVERIFIED-LABEL': 0 };

const rows = items.map((it) => {
  const name = it.displayAs || it.description || 'Unknown'; // adapter.js normalizeFood
  const group = effectiveGroup(it);
  const ov = overlayImage(it.foodItemID);
  const image = app.getIngredientImage(name, group, ov?.imageFile);
  const lower = name.toLowerCase();
  const kw = app.KEYWORD_MAP.find(([k]) => lower.includes(k));

  let method, detail, implied;
  if (ov) { method = 'overlay'; detail = ov.layer; implied = image; }
  else if (kw) { method = 'keyword'; detail = kw[0]; implied = app.photoUrl(kw[1]); }
  else if (app.GROUP_FALLBACKS[group]) { method = 'group-fallback'; detail = group; implied = app.photoUrl(app.GROUP_FALLBACKS[group]); }
  else { method = 'default-fallback'; detail = group || '(none)'; implied = app.photoUrl(app.DEFAULT_FALLBACK); }
  if (implied !== image) { detail = `${method}:${detail}`; method = 'UNVERIFIED-LABEL'; }

  return {
    id: it.foodItemID, name, coarse: it.coarseFoodGroup, fine: it.fineFoodGroup, group,
    image, method, detail, icon: app.getNonFoodIcon(group, it.fineFoodGroup) || '',
  };
});

// Likeliest mismatches first: default, group fallback, keyword (grouped by keyword), then overlay.
rows.sort((a, b) =>
  ORDER[a.method] - ORDER[b.method] ||
  a.detail.localeCompare(b.detail) || a.name.localeCompare(b.name) || a.id - b.id);

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const header = ['foodItemID', 'item_name', 'coarse_group', 'fine_group', 'group_used_by_resolver', 'resolved_image', 'method', 'detail', 'non_food_icon'];
const lines = [header, ...rows.map((r) => [r.id, r.name, r.coarse, r.fine, r.group, r.image, r.method, r.detail, r.icon])];
const out = new URL('../docs/image-list-for-review.csv', import.meta.url);
fs.writeFileSync(out, lines.map((l) => l.map(esc).join(',')).join('\n') + '\n');

const counts = rows.reduce((m, r) => ((m[r.method] = (m[r.method] || 0) + 1), m), {});
console.log(`wrote ${rows.length} rows -> docs/image-list-for-review.csv`);
console.log(counts);
if (counts['UNVERIFIED-LABEL']) console.warn('WARNING: some labels disagree with the app resolver; see method=UNVERIFIED-LABEL rows');
