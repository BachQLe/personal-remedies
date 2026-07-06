#!/usr/bin/env node
const BASE_URL =
  process.env.NUTRIDIGM_BASE_URL ??
  "https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2";
const SUB = process.env.NUTRIDIGM_SUBSCRIPTION_ID;

if (!SUB) {
  console.error("Set NUTRIDIGM_SUBSCRIPTION_ID first.");
  process.exit(1);
}

async function get(path, params = {}) {
  const qs = new URLSearchParams({ subscriptionID: SUB, ...params });
  const url = `${BASE_URL}/${path}?${qs}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  console.log("Base URL:", BASE_URL, "\n");
  const groups = await get("foodgroups");
  console.log("foodgroups ->", groups.status);
  console.log(JSON.stringify(groups.body, null, 2).slice(0, 600), "\n");
  const conditions = await get("healthconditions");
  console.log("healthconditions ->", conditions.status);
  if (Array.isArray(conditions.body)) {
    console.log(`  ${conditions.body.length} conditions returned`);
    console.log("  sample:", JSON.stringify(conditions.body.slice(0, 3), null, 2));
  } else {
    console.log(JSON.stringify(conditions.body, null, 2));
  }
})().catch((e) => { console.error("Smoke test failed:", e); process.exit(1); });
