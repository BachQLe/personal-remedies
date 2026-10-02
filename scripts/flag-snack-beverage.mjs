#!/usr/bin/env node
/**
 * scripts/flag-snack-beverage.mjs — offline generator for
 * src/data/cache/itemOverlay.generated.json.
 *
 * Run manually: `node scripts/flag-snack-beverage.mjs`
 *
 * "Snacks & sweets" (fineFoodGroup 'h1') is a Nutridigm *food group*, not a
 * meal-planning concept — it also contains baking ingredients (frostings,
 * pie crust, puff pastry) and pantry spreads (honey, molasses, jams) that
 * nobody eats standalone as a snack. Conversely, genuine snackable items
 * live scattered across other groups ('c3' nuts & seeds, 'd' fruits). This
 * script reads the flat item snapshot (src/data/cache/items.json, no
 * network) and writes best-guess isBreakfast/isSnack/isBeverage flags so
 * the Plan's breakfast/snacks/beverages slots (src/api/adapter.js) can rank
 * real candidates instead of an entire raw food group.
 *
 * INVARIANT: this file is regenerated WHOLESALE every run — every key is
 * recomputed from scratch, nothing is merged with the previous output. That
 * is safe because hand-curated overrides live in the separate, never
 * script-touched src/data/cache/itemOverlay.json, which is layered AFTER
 * this generated file in src/api/localTables.js's ITEM_OVERLAY_LAYERS
 * (manual always wins on any key this script also writes). Never hand-edit
 * this generated file — edit itemOverlay.json instead, or adjust the rules
 * below and re-run.
 *
 * Pure classification helpers (`classifyBreakfast` below) are exported and
 * kept free of file I/O — see scripts/flag-snack-beverage.test.js, which
 * exercises them against small fixtures. Importing this module never runs
 * the file-reading/writing build (guarded by the `isMain` check at the
 * bottom), so a test file can `import { classifyBreakfast } from
 * './flag-snack-beverage.mjs'` without triggering a real write.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITEMS_PATH = path.join(ROOT, 'src', 'data', 'cache', 'items.json');
const OUT_PATH = path.join(ROOT, 'src', 'data', 'cache', 'itemOverlay.generated.json');

// ── Rules ─────────────────────────────────────────────────────────────────

/**
 * 'h1' ("snacks & sweets") rows that are really ingredients/condiments, not
 * something anyone eats on its own as a snack — excluded from the blanket
 * h1 → isSnack rule below. Kept conservative: only rows that are clearly
 * "used IN a recipe" rather than "eaten AS a snack". Each entry names the
 * item it targets so the list stays auditable as items.json changes.
 */
const SNACK_EXCLUSIONS = [
  { id: 688, name: 'Honey' }, // sweetener/ingredient, not a standalone snack
  { id: 698, name: 'Molasses' }, // sweetener/ingredient, not a standalone snack
  { id: 693, name: 'Jams & Preserves' }, // spread eaten on other food, not alone
  { id: 694, name: 'Jellies' }, // spread eaten on other food, not alone
  { id: 680, name: 'Dessert toppings' }, // topping added to other desserts
  { id: 683, name: 'Frostings' }, // cake ingredient, not eaten alone
  { id: 702, name: 'Pie crust' }, // raw baking component, not eaten alone
  { id: 718, name: 'Puff pastry' }, // raw baking component, not eaten alone
];
const SNACK_EXCLUSION_IDS = new Set(SNACK_EXCLUSIONS.map((e) => e.id));

/**
 * Name pattern that reroutes an otherwise-snack/nut item to isBeverage
 * instead — catches fruit juices/nectars in 'd' (e.g. "Orange juice") and
 * nut/seed "milks" in 'c3' (e.g. "Coconut milk", "Almond Milk") which are
 * drinks despite living in a solid-food fine group.
 */
const DRINK_NAME_PATTERN = /\b(juice|nectar|milk|punch|drink)\b/i;

/**
 * Dairy ('g1') is mixed: drinkable milks/cultured drinks are beverages,
 * cheeses/yogurt are snacks, but a large share are cooking ingredients
 * (butter, creams, condensed/evaporated milk, whey) that nobody consumes
 * standalone. We tag only the high-confidence drink/snack rows by name and
 * leave the rest untagged.
 */
const DAIRY_BEVERAGE_PATTERN = /\b(milk|buttermilk|kefir|eggnog)\b/i;
/** Dairy rows that match the beverage pattern but are baking ingredients. */
const DAIRY_BEVERAGE_EXCLUDE = /\b(condensed|evaporated)\b/i;
const DAIRY_SNACK_PATTERN = /\b(cheese|yogurt|cottage)\b/i;

/**
 * Breads/grains ('f') are overwhelmingly meal components, not snacks. Only a
 * short, high-confidence set of grab-and-eat items are snackable; one row
 * (rice milk) is actually a drink. Everything else in 'f' stays untagged.
 */
const BREAD_SNACK_PATTERN = /\b(cracker|crackers|granola bar|granola bars|bread sticks?|melba|rice cake|rice crisps|pretzel|popcorn|chips?)\b/i;
const BREAD_BEVERAGE_PATTERN = /\brice milk\b/i;

/**
 * Breakfast rule, intentionally tight — 'f' (breads/grains) matches only the
 * classic grab-and-eat breakfast staples (cereal, oatmeal, oat bran,
 * granola, bagel, waffle, pancake, grits, muffin); 'g1' (dairy) matches only
 * yogurt/cottage cheese. Deliberately does NOT blanket-tag fruit ('d') —
 * fruit isn't breakfast-specific, and a false positive puts an odd food in a
 * highly visible Plan slot. Sunny's hand-curated itemOverlay.json overrides
 * anything here, which already wins per ITEM_OVERLAY_LAYERS.
 */
const BREAKFAST_GRAIN_PATTERN = /\b(cereal|oatmeal|oat bran|granola|bagel|waffle|pancake|grits|muffin)s?\b/i;
const BREAKFAST_DAIRY_PATTERN = /\b(yogurt|cottage cheese)\b/i;

/**
 * Conservative isBreakfast classifier for a single item row. Pure function —
 * no file I/O — so it's directly unit-testable (see
 * scripts/flag-snack-beverage.test.js) and reused by `buildOverlay` below.
 * @param {{fineFoodGroup?: string, displayAs?: string, description?: string}} item
 * @returns {boolean}
 */
export function classifyBreakfast(item) {
  const name = item.displayAs || item.description || '';
  if (item.fineFoodGroup === 'f') return BREAKFAST_GRAIN_PATTERN.test(name);
  if (item.fineFoodGroup === 'g1') return BREAKFAST_DAIRY_PATTERN.test(name);
  return false;
}

// ── Build ─────────────────────────────────────────────────────────────────

/**
 * Pure overlay-building pass over an already-parsed items array — no file
 * I/O, so this is the part scripts/flag-snack-beverage.test.js exercises
 * directly against small fixtures instead of the real ~1,485-row file.
 * @param {Array<{foodItemID: number, fineFoodGroup?: string, displayAs?: string, description?: string}>} items
 * @returns {{
 *   overlay: Record<string, {isBreakfast?: boolean, isSnack?: boolean, isBeverage?: boolean}>,
 *   counts: Record<string, number>,
 *   resolvedExclusions: string[],
 *   breakfastTagged: string[],
 * }}
 */
export function buildOverlay(items) {
  /** @type {Record<string, {isBreakfast?: boolean, isSnack?: boolean, isBeverage?: boolean}>} */
  const overlay = {};

  const counts = {
    h2Beverage: 0,
    h1Snack: 0,
    h1Excluded: 0,
    dSnack: 0,
    dBeverageJuice: 0,
    c3Snack: 0,
    c3BeverageDrink: 0,
    g1Beverage: 0,
    g1Snack: 0,
    g1Untagged: 0,
    fSnack: 0,
    fBeverage: 0,
    fBreakfast: 0,
    g1Breakfast: 0,
  };
  const resolvedExclusions = [];
  const breakfastTagged = [];

  const tagBreakfast = (item, key, name) => {
    if (!classifyBreakfast(item)) return false;
    overlay[key] = { ...(overlay[key] || {}), isBreakfast: true };
    breakfastTagged.push(`${item.foodItemID} ${name}`);
    return true;
  };

  for (const item of items) {
    const key = String(item.foodItemID);

    if (item.fineFoodGroup === 'h2') {
      // Beverages group — every row is a drink.
      overlay[key] = { isBeverage: true };
      counts.h2Beverage++;
      continue;
    }

    if (item.fineFoodGroup === 'h1') {
      if (SNACK_EXCLUSION_IDS.has(item.foodItemID)) {
        counts.h1Excluded++;
        resolvedExclusions.push(`${item.foodItemID} ${item.displayAs || item.description}`);
        continue; // no flag — genuinely an ingredient, not a snack
      }
      overlay[key] = { isSnack: true };
      counts.h1Snack++;
      continue;
    }

    if (item.fineFoodGroup === 'd') {
      const name = item.displayAs || item.description || '';
      if (DRINK_NAME_PATTERN.test(name)) {
        overlay[key] = { isBeverage: true };
        counts.dBeverageJuice++;
      } else {
        overlay[key] = { isSnack: true };
        counts.dSnack++;
      }
      continue;
    }

    if (item.fineFoodGroup === 'c3') {
      const name = item.displayAs || item.description || '';
      if (DRINK_NAME_PATTERN.test(name)) {
        // e.g. "Coconut milk", "Almond Milk" — a nut/seed *drink*, not
        // something to snack on by the handful.
        overlay[key] = { isBeverage: true };
        counts.c3BeverageDrink++;
      } else {
        overlay[key] = { isSnack: true };
        counts.c3Snack++;
      }
      continue;
    }

    if (item.fineFoodGroup === 'g1') {
      const name = item.displayAs || item.description || '';
      if (DAIRY_BEVERAGE_PATTERN.test(name) && !DAIRY_BEVERAGE_EXCLUDE.test(name)) {
        overlay[key] = { isBeverage: true };
        counts.g1Beverage++;
      } else if (DAIRY_SNACK_PATTERN.test(name)) {
        overlay[key] = { isSnack: true };
        counts.g1Snack++;
      } else {
        // butter, creams, sour cream, whey, condensed/evaporated milk — cooking
        // ingredients, not standalone snacks/drinks.
        counts.g1Untagged++;
      }
      if (tagBreakfast(item, key, name)) counts.g1Breakfast++;
      continue;
    }

    if (item.fineFoodGroup === 'f') {
      const name = item.displayAs || item.description || '';
      if (BREAD_BEVERAGE_PATTERN.test(name)) {
        overlay[key] = { isBeverage: true };
        counts.fBeverage++;
      } else if (BREAD_SNACK_PATTERN.test(name)) {
        overlay[key] = { isSnack: true };
        counts.fSnack++;
      }
      if (tagBreakfast(item, key, name)) counts.fBreakfast++;
      continue;
    }
  }

  return { overlay, counts, resolvedExclusions, breakfastTagged };
}

// ── CLI entry point ──────────────────────────────────────────────────────

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const items = JSON.parse(readFileSync(ITEMS_PATH, 'utf8'));
  const { overlay, counts, resolvedExclusions, breakfastTagged } = buildOverlay(items);

  writeFileSync(OUT_PATH, JSON.stringify(overlay, null, 2) + '\n');

  console.log('flag-snack-beverage: wrote', Object.keys(overlay).length, 'entries to', path.relative(ROOT, OUT_PATH));
  console.log('');
  console.log('Per-rule counts:');
  console.log(`  h2 -> isBeverage:                 ${counts.h2Beverage}`);
  console.log(`  h1 -> isSnack:                     ${counts.h1Snack}`);
  console.log(`  h1 -> excluded (ingredient, no flag): ${counts.h1Excluded}`);
  console.log(`  d  -> isSnack:                     ${counts.dSnack}`);
  console.log(`  d  -> isBeverage (juice/nectar):   ${counts.dBeverageJuice}`);
  console.log(`  c3 -> isSnack:                     ${counts.c3Snack}`);
  console.log(`  c3 -> isBeverage (milk/drink):     ${counts.c3BeverageDrink}`);
  console.log(`  g1 -> isBeverage (milk/kefir):     ${counts.g1Beverage}`);
  console.log(`  g1 -> isSnack (cheese/yogurt):     ${counts.g1Snack}`);
  console.log(`  g1 -> untagged (ingredient):       ${counts.g1Untagged}`);
  console.log(`  f  -> isSnack (crackers/bars):     ${counts.fSnack}`);
  console.log(`  f  -> isBeverage (rice milk):      ${counts.fBeverage}`);
  console.log(`  f  -> isBreakfast (cereal/etc.):   ${counts.fBreakfast}`);
  console.log(`  g1 -> isBreakfast (yogurt/cottage): ${counts.g1Breakfast}`);
  console.log(`  TOTAL isBreakfast tagged:          ${breakfastTagged.length}`);
  console.log('');
  console.log('h1 exclusion list (resolved to names):');
  for (const line of resolvedExclusions) console.log(`  - ${line}`);
  console.log('');
  console.log('isBreakfast tagged list:');
  for (const line of breakfastTagged) console.log(`  - ${line}`);
}
