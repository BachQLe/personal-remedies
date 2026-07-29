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
 * network) and writes best-guess isSnack/isBeverage flags so the Plan's
 * snacks/beverages slots (src/api/adapter.js) can rank real candidates
 * instead of an entire raw food group.
 *
 * INVARIANT: this file is regenerated WHOLESALE every run — every key is
 * recomputed from scratch, nothing is merged with the previous output. That
 * is safe because hand-curated overrides live in the separate, never
 * script-touched src/data/cache/itemOverlay.json, which is layered AFTER
 * this generated file in src/api/localTables.js's ITEM_OVERLAY_LAYERS
 * (manual always wins on any key this script also writes). Never hand-edit
 * this generated file — edit itemOverlay.json instead, or adjust the rules
 * below and re-run.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

// ── Build ─────────────────────────────────────────────────────────────────

const items = JSON.parse(readFileSync(ITEMS_PATH, 'utf8'));

/** @type {Record<string, {isSnack?: boolean, isBeverage?: boolean}>} */
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
};
const resolvedExclusions = [];

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
    // all other breads/grains/cereals/pasta stay untagged (meal components)
    continue;
  }
}

writeFileSync(OUT_PATH, JSON.stringify(overlay, null, 2) + '\n');

// ── Summary ───────────────────────────────────────────────────────────────

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
console.log('');
console.log('h1 exclusion list (resolved to names):');
for (const line of resolvedExclusions) console.log(`  - ${line}`);
