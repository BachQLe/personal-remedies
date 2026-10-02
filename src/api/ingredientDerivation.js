/**
 * ingredientDerivation.js — resolve a recipe's ingredient list, and the fine
 * food group each ingredient's substitutes should be scoped by.
 *
 * WHY THIS EXISTS: FoodDetailCard's back face has always had an "Ingredients"
 * block, but it renders only from `item.realIngredients` — the C1 recipe
 * overlay's transcribed ingredient facts (see recipeDetail.js). As of this
 * pass NO row in src/data/recipeOverlay.json carries `rawIngredients`/
 * `ingredientFoodItemIds` (116/116 entries have only foodItemID/name/
 * mealType/alsoFits/fineFoodGroup/sourceUrl), so that block never actually
 * renders for any recipe in the app today.
 *
 * Rather than invent quantities/ingredients (the never-fabricate rule this
 * codebase holds everywhere), this module derives ingredients by matching the
 * recipe's OWN TITLE against the bundled Nutridigm food dictionary
 * (src/data/cache/items.json, 1485 real rows). "Three Bean and Beef Chili"
 * yields the real dictionary item Beef (foodItemID 9); a title that names no
 * dictionary food yields nothing at all. Every derived entry is therefore a
 * real food the API can score — never a guess about what's in the pot — and
 * callers label them as read off the recipe name, not as a transcribed
 * ingredient list. Real overlay ingredients, where they exist, always win
 * (see `resolveCardIngredients`).
 *
 * The second job here is picking the fine food group to scope an
 * ingredient's substitutes by (`resolveSuggestGroup`). The dictionary parks
 * generic staples — Beef, Chicken, Fish, Berries, Vegetables — in fine group
 * 'x', which `isExcludedItem` (adapter.js) treats as a non-food lifestyle
 * code and which /suggest can't be scoped by. For those, the modal fine group
 * of the item's dictionary SIBLINGS (rows whose name starts with the same
 * word: "Beef brain"/"Beef chuck/brisket"/… → 'b2') stands in. Still real
 * data, just read off the neighbourhood rather than the row itself.
 */

import { getItemTable } from './localTables.js';
import { EXCLUDED_FINE_GROUPS } from './config.js';

/** Fine group that holds recipes — never a match for a recipe's ingredient. */
const RECIPE_FINE_GROUP = 'l';

/**
 * Dictionary-name words that qualify a food rather than name one. Stripped
 * when building lookup keys so "Broccoli non-organic", "Organic Kale" and
 * "Carrots non-organic" are all reachable from the plain word a recipe title
 * actually uses. NOTE: preparation words that genuinely distinguish one
 * dictionary row from another ("skin", "breast", "liver") are deliberately
 * NOT in here — stripping those collapsed "Chicken skin" onto the key
 * "chicken" and shadowed the real generic Chicken row.
 */
const QUALIFIER_WORDS = new Set([
  'organic', 'nonorganic', 'non', 'org', 'raw', 'cooked', 'fresh', 'canned', 'dried', 'plain',
]);

/** Title words that are never ingredients, even when the dictionary has a row for them. */
const TITLE_STOPWORDS = new Set([
  'recipe', 'recipes', 'style', 'easy', 'quick', 'best', 'homemade', 'healthy', 'low', 'cal',
]);

/** Longest phrase (in words) matched against the dictionary. */
const MAX_PHRASE_WORDS = 3;

/** @type {Map<string, Object>|null} */
let _nameIndex = null;
/** @type {Map<string, string>|null} */
let _siblingGroupByFirstWord = null;

/**
 * Crude singularizer — enough to bridge dictionary plurals ("Lentils",
 * "Carrots non-organic") and the singular a title tends to use, without
 * pulling in a stemming dependency.
 * @param {string} word
 * @returns {string}
 */
function singularize(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(oes|ses|shes|ches|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Drop parenthetical qualifiers from a dictionary name — "Oatmeal (cereal)"
 * → "Oatmeal". Runs BEFORE any comma split, since the dictionary's parens
 * often contain the comma themselves ("Salmon (smoked, Lox)"); splitting
 * first would leave a dangling "(smoked" that no paren pattern matches and
 * would key that row as "salmon smoked" — unreachable from a title's plain
 * "Salmon".
 * @param {string} text
 * @returns {string}
 */
function stripParentheticals(text) {
  return (text || '').replace(/\([^)]*\)?/g, ' ');
}

/**
 * Lowercase word list for a name: parentheticals dropped, punctuation
 * flattened.
 * @param {string} text
 * @returns {string[]}
 */
function words(text) {
  return stripParentheticals(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * The display name for a dictionary row, with qualifier words stripped —
 * "Broccoli non-organic" reads as "Broccoli" in an ingredient list.
 * Falls back to the raw name if stripping would leave nothing.
 * @param {Object} item - merged dictionary row
 * @returns {string}
 */
export function cleanItemName(item) {
  const raw = item?.displayAs || item?.description || '';
  const kept = stripParentheticals(raw)
    .split(',')[0]
    .split(/[\s/]+/)
    .filter((w) => w && !QUALIFIER_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')));
  const joined = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) return raw.trim();
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * Lookup key for a name: qualifiers dropped, each remaining word singularized.
 * @param {string} name
 * @returns {string}
 */
function keyFor(name) {
  return words(stripParentheticals(name).split(',')[0])
    .filter((w) => !QUALIFIER_WORDS.has(w))
    .map(singularize)
    .join(' ');
}

/**
 * Build (once) the phrase -> dictionary-row index, plus the first-word ->
 * modal fine group map that rescues generic 'x' rows (see module header).
 */
function ensureIndex() {
  if (_nameIndex && _siblingGroupByFirstWord) return;

  const index = new Map();
  /** @type {Map<string, Map<string, number>>} */
  const groupTally = new Map();

  for (const item of getItemTable()) {
    if (item.fineFoodGroup === RECIPE_FINE_GROUP) continue;
    const raw = item.displayAs || item.description || '';
    if (!raw) continue;

    const key = keyFor(raw);
    if (key.length >= 3) {
      const existing = index.get(key);
      // A row with a usable (non-excluded) fine group wins a key collision —
      // e.g. prefer a real scoped row over a generic 'x' duplicate.
      const better = !existing
        || (EXCLUDED_FINE_GROUPS.includes(existing.fineFoodGroup) && !EXCLUDED_FINE_GROUPS.includes(item.fineFoodGroup));
      if (better) index.set(key, item);
    }

    const [firstWord] = words(raw);
    if (firstWord && item.fineFoodGroup && !EXCLUDED_FINE_GROUPS.includes(item.fineFoodGroup)) {
      const stem = singularize(firstWord);
      if (!groupTally.has(stem)) groupTally.set(stem, new Map());
      const tally = groupTally.get(stem);
      tally.set(item.fineFoodGroup, (tally.get(item.fineFoodGroup) ?? 0) + 1);
    }
  }

  const modal = new Map();
  for (const [stem, tally] of groupTally) {
    let bestGroup = null;
    let bestCount = 0;
    for (const [group, count] of tally) {
      if (count > bestCount) {
        bestGroup = group;
        bestCount = count;
      }
    }
    if (bestGroup) modal.set(stem, bestGroup);
  }

  _nameIndex = index;
  _siblingGroupByFirstWord = modal;
}

/**
 * The fine food group /suggest should be scoped by for one dictionary item.
 *
 * The item's own `fineFoodGroup` when it's a real, scopeable group; otherwise
 * the modal fine group of its dictionary siblings (Beef → 'b2' via "Beef
 * brain"/"Beef chuck/brisket"/…). `null` when neither exists — the caller
 * then shows no alternatives for that ingredient rather than scoping by a
 * made-up group.
 * @param {Object} item - merged dictionary row
 * @returns {string|null}
 */
export function resolveSuggestGroup(item) {
  if (!item) return null;
  const own = item.fineFoodGroup;
  if (own && !EXCLUDED_FINE_GROUPS.includes(own)) return own;

  ensureIndex();
  const [firstWord] = words(item.displayAs || item.description || '');
  if (!firstWord) return null;
  return _siblingGroupByFirstWord.get(singularize(firstWord)) ?? null;
}

/**
 * Derive a recipe's ingredients from its title by matching against the
 * bundled food dictionary. Longer phrases win over shorter ones ("sweet
 * potato" over "potato"), each title word is consumed at most once, and
 * results keep the order they appear in the title.
 * @param {string} title - recipe name
 * @param {Object} [options]
 * @param {number} [options.max] - cap on returned ingredients (default 6)
 * @returns {Array<{name: string, foodItemID: number, group: string, fineGroup: string, suggestGroup: string|null, derived: true}>}
 */
export function deriveIngredientsFromTitle(title, { max = 6 } = {}) {
  if (!title) return [];
  ensureIndex();

  const titleWords = words(title).map(singularize);
  const claimed = new Array(titleWords.length).fill(false);
  /** @type {Array<{item: Object, at: number}>} */
  const hits = [];

  for (let size = MAX_PHRASE_WORDS; size >= 1; size--) {
    for (let i = 0; i + size <= titleWords.length; i++) {
      let free = true;
      for (let j = i; j < i + size; j++) if (claimed[j]) free = false;
      if (!free) continue;

      const phrase = titleWords.slice(i, i + size).join(' ');
      if (size === 1 && TITLE_STOPWORDS.has(phrase)) continue;

      const item = _nameIndex.get(phrase);
      if (!item) continue;

      for (let j = i; j < i + size; j++) claimed[j] = true;
      hits.push({ item, at: i });
    }
  }

  return hits
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map(({ item }) => ({
      name: cleanItemName(item),
      foodItemID: item.foodItemID,
      group: item.coarseFoodGroup || (item.fineFoodGroup || '').charAt(0),
      fineGroup: item.fineFoodGroup || '',
      suggestGroup: resolveSuggestGroup(item),
      derived: true,
    }));
}

/**
 * The ingredient list FoodDetailCard should show, and whether it's real
 * transcribed data or read off the recipe name.
 *
 * Real C1-overlay ingredients (`item.realIngredients`) always win and are
 * returned as-is (`derived: false`), with `suggestGroup` filled in from the
 * dictionary where the entry carries a `foodItemID` — those rows are facts
 * from the source recipe. Only when there are none does this fall back to
 * `deriveIngredientsFromTitle`, and the `derived` flag on every entry (plus
 * the `derived` field on the result) is what the UI uses to caption the
 * section honestly.
 * @param {Object} item - FoodDetailCard's `item` prop
 * @returns {{ingredients: Array<Object>, derived: boolean}}
 */
export function resolveCardIngredients(item) {
  ensureIndex();

  if (Array.isArray(item?.realIngredients) && item.realIngredients.length > 0) {
    const ingredients = item.realIngredients.map((ing, i) => {
      const row = ing.foodItemID != null
        ? getItemTable().find((r) => r.foodItemID === ing.foodItemID)
        : _nameIndex.get(keyFor(ing.name || ''));
      return {
        name: ing.name || (row ? cleanItemName(row) : `Ingredient ${i + 1}`),
        foodItemID: ing.foodItemID ?? row?.foodItemID ?? null,
        group: row?.coarseFoodGroup || '',
        fineGroup: row?.fineFoodGroup || '',
        suggestGroup: row ? resolveSuggestGroup(row) : null,
        derived: false,
      };
    });
    return { ingredients, derived: false };
  }

  return { ingredients: deriveIngredientsFromTitle(item?.name || ''), derived: true };
}
