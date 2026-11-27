// Meal Planner DB (MP_RECIPES + MP_MORE) -> src/data/mpDb.json shape. Shared by
// scripts/import-mp-db.mjs (xlsx or live MySQL) and the mp-db edge function, so both stay identical.
// Rows are objects keyed by column name (MP-DB.xlsx headers or MySQL columns), case-insensitive.
// Live MySQL (Nov 2026) has no Dessert column and calls Beverage `BEV`.
// Output: { recipes: { FI: { url, meals: ['b'|'ld'|'ds'|'bev'], kcal } }, more: { FI: ['b'|'s'|'bev'] } }

const isX = (v) => v === true || v === 1 || /^(x|1|y|yes|true)$/i.test(String(v ?? '').trim());

// `name` may list aliases ('Beverage|BEV': xlsx header vs MySQL column). Optional columns end in '?'.
function pick(row, name) {
  const names = name.replace('?', '').toLowerCase().split('|');
  const key = Object.keys(row).find((k) => names.includes(k.toLowerCase()));
  if (key === undefined && !name.endsWith('?')) throw new Error(`column "${name}" missing; columns are: ${Object.keys(row).join(', ')}`);
  return key === undefined ? undefined : row[key];
}

const flags = (row, cols) => Object.entries(cols).filter(([c]) => isX(pick(row, c))).map(([, code]) => code);

export function toMpDb(recipeRows, moreRows) {
  const recipes = {};
  for (const r of recipeRows) {
    const fi = String(pick(r, 'FI') ?? '').trim();
    if (!/^\d+$/.test(fi)) continue;
    const meals = flags(r, { Breakfast: 'b', LD: 'ld', 'Dessert?': 'ds', 'Beverage|BEV': 'bev' });
    if (!meals.length) throw new Error(`MP_RECIPES FI ${fi} has no category`);
    const u = String(pick(r, 'URL') ?? '').trim();
    const url = /^https:\/\//.test(u) ? u : null; // "Commonly prepared" = prepared food, no link
    if (!url && u !== 'Commonly prepared') throw new Error(`MP_RECIPES FI ${fi}: URL "${u}"`);
    recipes[fi] = { url, meals, kcal: Number(pick(r, 'Kcal')) };
  }
  const more = {};
  for (const r of moreRows) {
    const fi = String(pick(r, 'FI') ?? '').trim();
    if (/^\d+$/.test(fi)) more[fi] = flags(r, { Breakfast: 'b', Snack: 's', 'Beverage|BEV': 'bev' });
  }
  return { recipes, more };
}

/** Connection settings. Only the password is secret; `env` is a getter (process.env / Deno.env). */
export function mpDbConfig(env) {
  const password = env('MP_DB_PASSWORD');
  if (!password) throw new Error('MP_DB_PASSWORD is not set (run: npm run mp:password)');
  return {
    host: env('MP_DB_HOST') || 'nutridigm.cheyzh1ihima.us-east-1.rds.amazonaws.com',
    port: Number(env('MP_DB_PORT') || 3306),
    user: env('MP_DB_USER') || 'MealPlanner',
    database: env('MP_DB_NAME') || 'nutridigm',
    password,
    connectTimeout: 10000,
  };
}

/** Read both tables live. `createConnection` is mysql2/promise's (Node or npm: in Deno). Never touch CONTENT. */
export async function fetchMpDb(createConnection, env) {
  const conn = await createConnection(mpDbConfig(env));
  try {
    const [recipes] = await conn.query('SELECT * FROM MP_RECIPES');
    const [more] = await conn.query('SELECT * FROM MP_MORE');
    return toMpDb(recipes, more);
  } finally {
    await conn.end();
  }
}
