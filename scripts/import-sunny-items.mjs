#!/usr/bin/env node
/**
 * scripts/import-sunny-items.mjs — Sunny's item classifications ->
 * src/data/cache/itemOverlay.json (checklist 7.6, 7.8).
 *
 * Source: content/sunny-item-categories.csv, exported from "List of Items
 * (Sunny).xlsx" ("Meal Planner categories" column). This overlay layer wins
 * over the heuristic itemOverlay.generated.json, so Sunny's list is the
 * source for isBreakfast/isSnack/isBeverage; a generated flag she did not
 * assign is written as an explicit false. R items also record their meal
 * types, since they join the recipe lists (adapter.js getCategoryRecipes).
 *
 * Run: node scripts/import-sunny-items.mjs
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';

const MEAL_TYPE_BY_CODE = { B: 'breakfast', L: 'lunch', D: 'dinner', S: 'snack', Ds: 'dessert', Bv: 'beverage' };
const FLAG_BY_CODE = { B: 'isBreakfast', S: 'isSnack', Bv: 'isBeverage' };
const KNOWN_CODES = new Set([...Object.keys(MEAL_TYPE_BY_CODE), 'R']);

/** @param {string} value e.g. 'R, L, D' @returns {string[]} */
export function parseCategories(value) {
  const codes = value.split(',').map((code) => code.trim()).filter(Boolean);
  for (const code of codes) {
    if (!KNOWN_CODES.has(code)) throw new Error(`Unknown category code "${code}" in "${value}"`);
  }
  return codes;
}

/**
 * @param {Array<{id: number|string, categories: string}>} rows
 * @param {Record<string, Object>} generated - itemOverlay.generated.json
 * @returns {Record<string, Object>}
 */
export function buildOverlay(rows, generated) {
  const overlay = {};
  for (const { id, categories } of rows) {
    const codes = parseCategories(categories);
    const entry = {};
    for (const [code, flag] of Object.entries(FLAG_BY_CODE)) {
      if (codes.includes(code)) entry[flag] = true;
      else if (generated[id]?.[flag]) entry[flag] = false;
    }
    if (codes.includes('R')) {
      entry.isRecipe = true;
      entry.mealTypes = codes.filter((code) => code !== 'R').map((code) => MEAL_TYPE_BY_CODE[code]);
    }
    if (Object.keys(entry).length) overlay[id] = entry;
  }
  return overlay;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const records = parseCsv(read('../content/sunny-item-categories.csv'));
  const rows = records.map((r) => ({ id: r.FI, categories: r['Meal Planner categories'] }));
  const overlay = buildOverlay(rows, JSON.parse(read('../src/data/cache/itemOverlay.generated.json')));
  fs.writeFileSync(new URL('../src/data/cache/itemOverlay.json', import.meta.url), `${JSON.stringify(overlay, null, 2)}\n`);
  console.log(`wrote ${Object.keys(overlay).length} rows from ${rows.length} items`);
}
