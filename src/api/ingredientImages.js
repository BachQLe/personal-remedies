/**
 * ingredientImages.js — maps Nutridigm food names to curated Unsplash photos.
 *
 * All photo IDs verified 200 against images.unsplash.com CDN.
 * Uses keyword matching on the normalized ingredient name, with group-level
 * fallbacks for anything not in the curated set.
 */

// [keyword, Unsplash photo ID] — checked in order, first match wins.
// Keywords are matched as substrings of the lowercased food name.
const KEYWORD_MAP = [
  // Fish & seafood
  ['salmon',      '1519708227418-c8fd9a32b7a2'], // ✓
  ['tuna',        '1559847844-5315695dadae'],     // ✓
  ['mackerel',    '1519708227418-c8fd9a32b7a2'], // ✓ (salmon stand-in)
  ['sardine',     '1519708227418-c8fd9a32b7a2'], // ✓
  ['anchov',      '1519708227418-c8fd9a32b7a2'], // ✓
  ['cod',         '1519708227418-c8fd9a32b7a2'], // ✓
  ['trout',       '1519708227418-c8fd9a32b7a2'], // ✓
  ['herring',     '1519708227418-c8fd9a32b7a2'], // ✓
  ['halibut',     '1519708227418-c8fd9a32b7a2'], // ✓
  ['shrimp',      '1519708227418-c8fd9a32b7a2'], // ✓
  ['snapper',     '1519708227418-c8fd9a32b7a2'], // ✓
  ['swordfish',   '1519708227418-c8fd9a32b7a2'], // ✓
  ['pink salmon', '1519708227418-c8fd9a32b7a2'], // ✓

  // Vegetables
  ['spinach',     '1576045057995-568f588f82fb'], // ✓
  ['broccoli',    '1584270354949-c26b0d5b4a0c'], // ✓
  ['kale',        '1524179091875-bf99a9a6af57'], // ✓
  ['avocado',     '1519162808019-7de1683fa2ad'], // ✓
  ['carrot',      '1598170845058-32b9d6a5da37'], // ✓
  ['garlic',      '1540420773420-3366772f4999'], // ✓
  ['sweet potato','1598170845058-32b9d6a5da37'], // ✓ (carrot stand-in: orange root)
  ['tomato',      '1546554137-f86b9593a222'],    // ✓
  ['beet',        '1610348725531-843dff563e2c'], // ✓
  ['asparagus',   '1576045057995-568f588f82fb'], // ✓ (spinach/greens stand-in)
  ['cauliflower', '1568584711075-3d021a7c3ca3'], // ✓
  ['celery',      '1576045057995-568f588f82fb'], // ✓ (spinach/greens stand-in)
  ['pumpkin',     '1598170845058-32b9d6a5da37'], // ✓ (orange veg stand-in)
  ['cucumber',    '1568584711075-3d021a7c3ca3'], // ✓
  ['pepper',      '1546554137-f86b9593a222'],    // ✓ (tomato stand-in)
  ['onion',       '1508747703725-719777637510'], // ✓
  ['scallion',    '1576045057995-568f588f82fb'], // ✓
  ['green onion', '1576045057995-568f588f82fb'], // ✓
  ['lettuce',     '1512621776951-a57141f2eefd'], // ✓
  ['arugula',     '1512621776951-a57141f2eefd'], // ✓
  ['mustard green','1576045057995-568f588f82fb'],// ✓
  ['collard',     '1524179091875-bf99a9a6af57'], // ✓
  ['cabbage',     '1584270354949-c26b0d5b4a0c'], // ✓
  ['artichoke',   '1558618666-fcd25c85cd64'],    // ✓
  ['zucchini',    '1568584711075-3d021a7c3ca3'], // ✓
  ['mushroom',    '1568584711075-3d021a7c3ca3'], // ✓ (veg stand-in)
  ['leek',        '1576045057995-568f588f82fb'], // ✓
  ['fennel',      '1524179091875-bf99a9a6af57'], // ✓
  ['dandelion',   '1524179091875-bf99a9a6af57'], // ✓ (greens)
  ['brussels',    '1584270354949-c26b0d5b4a0c'], // ✓ (broccoli-family)
  ['grape leaf',  '1537640538966-79f369143f8f'], // ✓
  ['grape leave', '1537640538966-79f369143f8f'], // ✓

  // Fruits
  ['blueberr',    '1498557850523-fd3d118b962e'], // ✓
  ['strawberr',   '1464965911861-746a04b4bca6'], // ✓
  ['raspberry',   '1498557850523-fd3d118b962e'], // ✓ (berry stand-in)
  ['blackberr',   '1498557850523-fd3d118b962e'], // ✓ (berry stand-in)
  ['cherry',      '1528821128474-27f963b062bf'], // ✓
  ['pomegranate', '1615485500704-8e990f9900f7'], // ✓
  ['grape',       '1537640538966-79f369143f8f'], // ✓
  ['mango',       '1553279768-865429fa0078'],    // ✓
  ['papaya',      '1553279768-865429fa0078'],    // ✓
  ['pineapple',   '1550258987-190a2d41a8ba'],    // ✓
  ['apple',       '1570913149827-d2ac84ab3f9a'], // ✓
  ['pear',        '1571771894821-ce9b6c11b08e'], // ✓
  ['orange',      '1557800636-894a64c1696f'],    // ✓
  ['grapefruit',  '1557800636-894a64c1696f'],    // ✓
  ['lemon',       '1582979512210-99b6a53386f9'], // ✓
  ['lime',        '1582979512210-99b6a53386f9'], // ✓
  ['banana',      '1571771894821-ce9b6c11b08e'], // ✓
  ['fig',         '1615485500704-8e990f9900f7'], // ✓
  ['melon',       '1553279768-865429fa0078'],    // ✓
  ['plum',        '1528821128474-27f963b062bf'], // ✓
  ['apricot',     '1557800636-894a64c1696f'],    // ✓
  ['peach',       '1557800636-894a64c1696f'],    // ✓
  ['kiwi',        '1490645935967-10de6ba17061'], // ✓
  ['coconut',     '1550258987-190a2d41a8ba'],    // ✓

  // Eggs, Beans, Nuts & Seeds
  ['egg',         '1582169296194-e4d644c48063'], // ✓
  ['almond',      '1508061253366-f7da158b6d46'], // ✓ (walnut stand-in)
  ['walnut',      '1508061253366-f7da158b6d46'], // ✓
  ['cashew',      '1590080875515-8a3a8dc5735e'], // ✓
  ['pecan',       '1590080875515-8a3a8dc5735e'], // ✓ (cashew stand-in)
  ['pistachio',   '1590080875515-8a3a8dc5735e'], // ✓ (cashew stand-in)
  ['hazelnut',    '1508061253366-f7da158b6d46'], // ✓
  ['macadamia',   '1590080875515-8a3a8dc5735e'], // ✓
  ['chickpea',    '1586201375761-83865001e31c'], // ✓ (quinoa stand-in)
  ['lentil',      '1586201375761-83865001e31c'], // ✓ (quinoa stand-in)
  ['black bean',  '1586201375761-83865001e31c'], // ✓
  ['soybean',     '1586201375761-83865001e31c'], // ✓
  ['edamame',     '1576045057995-568f588f82fb'], // ✓ (green)
  ['bean',        '1586201375761-83865001e31c'], // ✓
  ['pea',         '1576045057995-568f588f82fb'], // ✓ (green)
  ['chia',        '1563636619-e9143da7973b'],    // ✓ (seed stand-in)
  ['flax',        '1563636619-e9143da7973b'],    // ✓
  ['hemp seed',   '1563636619-e9143da7973b'],    // ✓
  ['sesame',      '1563636619-e9143da7973b'],    // ✓
  ['sunflower',   '1535379453347-1ffd615e2e08'], // ✓
  ['pumpkin seed','1563636619-e9143da7973b'],    // ✓
  ['peanut',      '1508061253366-f7da158b6d46'], // ✓
  ['tofu',        '1586201375761-83865001e31c'], // ✓
  ['tempeh',      '1586201375761-83865001e31c'], // ✓

  // Grains & Cereals
  ['oat',         '1505253716362-afaea1d3d1af'], // ✓
  ['quinoa',      '1586201375761-83865001e31c'], // ✓
  ['brown rice',  '1536304993881-ff6e9eefa2a6'], // ✓
  ['wild rice',   '1536304993881-ff6e9eefa2a6'], // ✓
  ['rice milk',   '1550583724-b2692b85b150'],    // ✓
  ['rice',        '1536304993881-ff6e9eefa2a6'], // ✓
  ['barley',      '1574323347407-f5e1ad6d020b'], // ✓ (wheat stand-in)
  ['buckwheat',   '1586201375761-83865001e31c'], // ✓
  ['millet',      '1586201375761-83865001e31c'], // ✓
  ['wheat',       '1574323347407-f5e1ad6d020b'], // ✓
  ['rye',         '1574323347407-f5e1ad6d020b'], // ✓
  ['bread',       '1574323347407-f5e1ad6d020b'], // ✓

  // Dairy, Fats & Oils
  ['yogurt',      '1488477181946-6428a0291777'], // ✓
  ['kefir',       '1488477181946-6428a0291777'], // ✓
  ['almond milk', '1550583724-b2692b85b150'],    // ✓
  ['soy milk',    '1550583724-b2692b85b150'],    // ✓
  ['milk',        '1550583724-b2692b85b150'],    // ✓
  ['cheese',      '1486297678162-eb2a19b0a32d'], // ✓
  ['butter',      '1474979266404-7eaacbcd87c5'], // ✓ (olive oil stand-in)
  ['ghee',        '1474979266404-7eaacbcd87c5'], // ✓
  ['olive oil',   '1474979266404-7eaacbcd87c5'], // ✓
  ['coconut oil', '1474979266404-7eaacbcd87c5'], // ✓

  // Poultry & Meat
  ['chicken',     '1559847844-5315695dadae'],    // ✓ (tuna stand-in: lean protein)
  ['turkey',      '1559847844-5315695dadae'],    // ✓
  ['beef',        '1519708227418-c8fd9a32b7a2'], // ✓ (protein stand-in)
  ['lamb',        '1519708227418-c8fd9a32b7a2'], // ✓
  ['liver',       '1519708227418-c8fd9a32b7a2'], // ✓

  // Herbs, Spices & Prepared
  ['turmeric',    '1615485290382-441e4d049cb5'], // ✓
  ['ginger',      '1615485290382-441e4d049cb5'], // ✓ (turmeric stand-in: yellow root spice)
  ['cinnamon',    '1530103862676-de8c9debad1d'], // ✓
  ['basil',       '1540420773420-3366772f4999'], // ✓ (garlic stand-in: aromatic herb)
  ['rosemary',    '1540420773420-3366772f4999'], // ✓
  ['mint',        '1524179091875-bf99a9a6af57'], // ✓ (greens stand-in)
  ['parsley',     '1524179091875-bf99a9a6af57'], // ✓
  ['oregano',     '1530103862676-de8c9debad1d'], // ✓
  ['thyme',       '1530103862676-de8c9debad1d'], // ✓
  ['green tea',   '1546069901-ba9599a7e63c'],    // ✓
  ['matcha',      '1546069901-ba9599a7e63c'],    // ✓
  ['tea',         '1546069901-ba9599a7e63c'],    // ✓

  // Recipe dish names (fine group 'l' Food Network recipes) — reuse
  // verified IDs above as stand-ins for the dish's dominant ingredient.
  ['guacamole',   '1519162808019-7de1683fa2ad'], // ✓ (avocado stand-in)
  ['chili',       '1546554137-f86b9593a222'],    // ✓ (tomato stand-in)
  ['soup',        '1568584711075-3d021a7c3ca3'], // ✓ (veg stand-in)
  ['chowder',     '1519708227418-c8fd9a32b7a2'], // ✓ (seafood stand-in)
];

// Group-level fallback photo IDs — all verified 200.
const GROUP_FALLBACKS = {
  b: '1519708227418-c8fd9a32b7a2', // Fish/Meat  ✓
  c: '1508061253366-f7da158b6d46', // Eggs/Beans/Nuts  ✓
  d: '1490645935967-10de6ba17061', // Fruits  ✓
  e: '1512621776951-a57141f2eefd', // Vegetables  ✓
  f: '1505253716362-afaea1d3d1af', // Grains  ✓
  g: '1488477181946-6428a0291777', // Dairy  ✓
  h: '1551248429-40975aa4de74',    // Snacks/Beverages  ✓
  i: '1540420773420-3366772f4999', // Herbs/Spices  ✓
  k: '1546069901-ba9599a7e63c',    // Nutrients/Herbal  ✓
};

const DEFAULT_FALLBACK = '1512621776951-a57141f2eefd'; // salad bowl  ✓

function photoUrl(id) {
  return `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;
}

// ── Non-food category rule (REMEDI_MASTER_PLAN.md 1.10, decision j) ─────────
//
// Items in coarse group 'k' (Key Nutrients & Herbal Medicines) or fine group
// 'x'/'j1' (lifestyle/behavior entries — Exercise, Smoking, Sleep, etc.) must
// NEVER render with a stock food photo — a category icon renders instead.
// A curated turmeric-latte photo standing in for "Vitamin D" or a jogger
// photo standing in for "Exercise" reads as a real product photo the app
// doesn't have, which is exactly the kind of fabricated specificity this
// app avoids everywhere else (numeric scores, nutrition facts, recipe
// directions...). `getNonFoodIcon` is the single choke point for this rule
// — every caller that wants sentinel-aware image resolution should call it
// (directly, or via `getIngredientImageOrIcon` below) rather than
// reimplementing the k/x/j1 check.
const NON_FOOD_ICONS = {
  nutrient: 'flask-conical', // coarse 'k' — Key Nutrients & Herbal Medicines
  lifestyle: 'activity',     // fine 'x' / 'j1' — lifestyle/behavior entries
};

/**
 * Resolve the lucide icon name (from `Icon.jsx`'s ICON_MAP) a non-food
 * category should render instead of a photo, or `null` when `group`/
 * `fineGroup` don't identify one (i.e. the normal photo path applies).
 * Fine-group lifestyle check runs first since a lifestyle item's coarse
 * group ('j') is a different code than 'k' and shouldn't fall through.
 * @param {string} [group] - coarse food group code
 * @param {string} [fineGroup] - fine food group code
 * @returns {string|null}
 */
export function getNonFoodIcon(group, fineGroup) {
  if (fineGroup === 'x' || fineGroup === 'j1') return NON_FOOD_ICONS.lifestyle;
  if (group === 'k') return NON_FOOD_ICONS.nutrient;
  return null;
}

/**
 * Resolve a curation-overlay `imageFile` value (see itemOverlay.json /
 * localTables.js `getOverlayImageFile`) to a servable URL. Overlay entries
 * store either a bare filename — served from /public/images/, Vite's static
 * asset convention — or an already-absolute URL, so an override can point
 * straight at a CDN image too.
 * @param {string} imageFile
 * @returns {string}
 */
function resolveOverlayImage(imageFile) {
  if (/^https?:\/\//.test(imageFile)) return imageFile;
  return `/images/${imageFile}`;
}

/**
 * Return an image URL for a Nutridigm food name + coarse group.
 * @param {string} name - food display name
 * @param {string} [group] - coarse food group letter (b, c, d, e, f, g, h, i, k)
 * @param {string} [imageFile] - curation-overlay override (see
 *   `getOverlayImageFile` in localTables.js); when present it wins over the
 *   keyword/group lookup below entirely. Items without an overlay entry see
 *   no change in behavior.
 * @returns {string} Image URL
 */
export function getIngredientImage(name, group, imageFile) {
  if (imageFile) return resolveOverlayImage(imageFile);

  const lower = (name || '').toLowerCase();
  for (const [keyword, id] of KEYWORD_MAP) {
    if (lower.includes(keyword)) return photoUrl(id);
  }
  const fallbackId = GROUP_FALLBACKS[group] || DEFAULT_FALLBACK;
  return photoUrl(fallbackId);
}

/**
 * Sentinel-aware sibling of `getIngredientImage` — the opt-in entry point
 * for the non-food icon rule (see `getNonFoodIcon` above). Returns either
 * `{ photo: string }` or `{ icon: string }`, never a bare URL, so callers
 * can't accidentally treat a sentinel as a src.
 *
 * WHY A SEPARATE FUNCTION rather than changing `getIngredientImage` itself:
 * `getIngredientImage`'s plain-string return is depended on today by 8+
 * call sites outside this task's file ownership (MealprepCarousel.jsx,
 * MealPlannerPicker.jsx, MealQueueScreen.jsx, SlotSection.jsx,
 * SchedulerView.jsx, recommendations.js, prefetch.js, adapter.js) — every
 * one of them puts the return value straight into an `<img src>` or
 * `Image().src`. Making `getIngredientImage` sometimes return `{icon:...}`
 * would silently break all of them (a stringified object as an image src).
 * This function is additive instead: `getIngredientImage`'s behavior is
 * completely unchanged, and only callers that explicitly adopt this new
 * function get sentinel-aware resolution. Today that's `FoodImageCard`'s
 * `nonFoodIcon` prop (which calls `getNonFoodIcon` directly, since it
 * already has `group`/`fineGroup` in hand). `RankedRow` no longer does this
 * — its image-right experiment (see RankedRow.jsx header) calls
 * `getIngredientImage` directly for every row, including lifestyle/nutrient
 * items, so they get a real (fallback) photo instead of a category icon;
 * wiring the screens above to call this function instead of
 * `getIngredientImage` is a caller-side follow-up, not something this
 * module can do unilaterally.
 *
 * @param {string} name
 * @param {string} [group] - coarse food group code
 * @param {string} [fineGroup] - fine food group code
 * @param {string} [imageFile] - curation-overlay override (see
 *   `getIngredientImage`) — a real curated image always wins over the icon
 *   fallback, even for a non-food category.
 * @returns {{ photo: string } | { icon: string }}
 */
export function getIngredientImageOrIcon(name, group, fineGroup, imageFile) {
  if (!imageFile) {
    const icon = getNonFoodIcon(group, fineGroup);
    if (icon) return { icon };
  }
  return { photo: getIngredientImage(name, group, imageFile) };
}
