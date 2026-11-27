// supabase/functions/mp-db/index.ts
//
// Serves Mory's Meal Planner tables (MP_RECIPES + MP_MORE, MySQL on AWS RDS) in the same shape as
// src/data/mpDb.json. The MealPlanner password lives only in the MP_DB_PASSWORD Supabase secret;
// rotating it is `npm run mp:password` (no redeploy, the secret is read per request).
// Never query the CONTENT table here until Mory signs off on it.
import { createConnection } from 'npm:mysql2@3/promise';
import { fetchMpDb } from '../_shared/mpDb.js';

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return Response.json({ code: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  try {
    const db = await fetchMpDb(createConnection, (k: string) => Deno.env.get(k));
    return Response.json(db, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (err) {
    console.error('mp-db:', err instanceof Error ? err.message : err); // never echo config/password
    return Response.json({ code: 'MP_DB_UNAVAILABLE' }, { status: 502 });
  }
});
