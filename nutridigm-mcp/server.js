#!/usr/bin/env node
/**
 * Nutridigm MCP server
 * -------------------------------------------------------------------------
 * Exposes the Personal Remedies "Nutridigm" food-disease interaction API as
 * MCP tools so Claude Code can query it live while building Remedi.
 *
 * Transport: stdio (local subprocess). No build step — run with `node server.js`.
 *
 * Required env:
 *   NUTRIDIGM_SUBSCRIPTION_ID   your subscription / key (kept out of git)
 * Optional env:
 *   NUTRIDIGM_BASE_URL          defaults to the v2 prod base below
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL =
  process.env.NUTRIDIGM_BASE_URL ??
  "https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2";

const SUBSCRIPTION_ID = process.env.NUTRIDIGM_SUBSCRIPTION_ID;

if (!SUBSCRIPTION_ID) {
  // Fail loudly on stderr so `claude mcp get` / a manual run shows the cause.
  console.error(
    "[nutridigm-mcp] Missing NUTRIDIGM_SUBSCRIPTION_ID env var. " +
      "Set it in your shell or in the MCP server's env block."
  );
  process.exit(1);
}

/* ---------------------------------------------------------------------- *
 * Core request helper
 * ---------------------------------------------------------------------- */

/**
 * GET a Nutridigm endpoint. subscriptionID is injected automatically.
 * Returns a structured result the tool handlers turn into MCP content.
 *
 * Status notes (from the swagger spec):
 *   200 -> success
 *   220 -> success but NO data found; body is an empty array. NOT an error.
 *   400 -> bad params; body has a `code` naming the bad param
 *   401 -> subscription problem (missing/invalid id, account disabled/expired,
 *          or APIDAILYLIMITREACHED -> you've hit the daily rate limit)
 *   500 -> database error
 */
async function apiGet(path, params = {}) {
  const qs = new URLSearchParams();
  qs.set("subscriptionID", SUBSCRIPTION_ID);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }

  const url = `${BASE_URL}/${path}?${qs.toString()}`;

  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    return { ok: false, kind: "network", status: 0, message: String(err) };
  }

  const status = res.status;
  const raw = await res.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw; // surface non-JSON bodies verbatim
  }

  // 220 = succeeded but empty. Treat as a clean "no data" result.
  if (status === 220) {
    return { ok: true, kind: "empty", status, body: body ?? [] };
  }
  if (status >= 200 && status < 300) {
    return { ok: true, kind: "data", status, body };
  }

  // Error: pull code/message out of the standard error shape if present.
  const code = body && typeof body === "object" ? body.code : undefined;
  const message = body && typeof body === "object" ? body.message : undefined;
  return { ok: false, kind: "http", status, code, message, body };
}

/** Turn an apiGet result into an MCP tool response. */
function toToolResult(result, { emptyNote } = {}) {
  if (!result.ok) {
    const lines = [`Request failed (HTTP ${result.status}).`];
    if (result.code) lines.push(`code: ${result.code}`);
    if (result.message) lines.push(`message: ${result.message}`);
    if (result.kind === "network") lines.push(result.message);
    if (result.status === 401 && result.code === "APIDAILYLIMITREACHED") {
      lines.push("Note: this is the daily API rate limit, not a bad key.");
    }
    return {
      isError: true,
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }

  if (result.kind === "empty") {
    return {
      content: [
        {
          type: "text",
          text:
            emptyNote ??
            "No data found for this query (HTTP 220, empty array). This is a normal 'we have no curated data' response, not an error.",
        },
      ],
    };
  }

  return {
    content: [
      { type: "text", text: JSON.stringify(result.body, null, 2) },
    ],
  };
}

/** Case-insensitive substring filter over chosen string fields. */
function filterByText(items, search, fields) {
  if (!search || !Array.isArray(items)) return items;
  const needle = search.toLowerCase();
  return items.filter((it) =>
    fields.some(
      (f) => typeof it?.[f] === "string" && it[f].toLowerCase().includes(needle)
    )
  );
}

const conditionList = z
  .array(z.number().int())
  .min(1)
  .describe(
    "One or more healthConditionID numbers. Pass ALL of the user's conditions, " +
      "allergies and diet flags together — the engine reconciles them in a single " +
      "call (sent as a comma-separated list under the hood)."
  );

/* ---------------------------------------------------------------------- *
 * Server + tools
 * ---------------------------------------------------------------------- */

const server = new McpServer({ name: "nutridigm", version: "1.0.0" });

// 1. /healthconditions ---------------------------------------------------
server.tool(
  "nutridigm_health_conditions",
  "List the full health-condition dictionary (conditions, illnesses, health risks, " +
    "allergies, dietary preferences and weight-loss diets), each with its " +
    "healthConditionID and description. These IDs are the input to every other " +
    "scoring tool. NOTE: ID numbering has gaps (some conditions aren't curated yet). " +
    "Pass `search` to filter client-side — the full list is large.",
  { search: z.string().optional().describe("Optional case-insensitive substring filter on the condition text.") },
  async ({ search }) => {
    const result = await apiGet("healthconditions");
    if (result.ok && result.kind === "data" && search) {
      result.body = filterByText(result.body, search, [
        "description",
        "longDescription",
        "AKA",
      ]);
    }
    return toToolResult(result);
  }
);

// 2. /fooditems ----------------------------------------------------------
server.tool(
  "nutridigm_food_items",
  "List the full food-item dictionary (foods, nutrients, herbal supplements, " +
    "alternative therapies, and a limited set of recipes), each with foodItemID, " +
    "description, displayAs, coarseFoodGroup and fineFoodGroup. foodItemID is the " +
    "input to nutridigm_good_for and nutridigm_references. Pass `search` to filter — " +
    "the full list is large. The API can only assess items that exist in this list.",
  { search: z.string().optional().describe("Optional case-insensitive substring filter on the food text.") },
  async ({ search }) => {
    const result = await apiGet("fooditems");
    if (result.ok && result.kind === "data" && search) {
      result.body = filterByText(result.body, search, [
        "description",
        "displayAs",
        "longDescription",
      ]);
    }
    return toToolResult(result);
  }
);

// 3. /foodgroups ---------------------------------------------------------
server.tool(
  "nutridigm_food_groups",
  "List the food-group codes and their descriptions. coarseFoodGroup values: " +
    "b,c,d,e,f,g,h,i,j,k,l (there is no group 'a'). fineFoodGroup values: " +
    "b1,b2,b3,c1,c2,c3,d,e,f,g1,g2,h1,h2,i1,i2,j1,k1,k2,l. nutridigm_suggest takes a " +
    "fineFoodGroup; nutridigm_detailed takes a coarseFoodGroup.",
  {},
  async () => toToolResult(await apiGet("foodgroups"))
);

// 4. /goodfor ------------------------------------------------------------
server.tool(
  "nutridigm_good_for",
  "Rate how good or bad ONE food is for a set of conditions. Returns a verdict on the " +
    "ladder: Most Helpful > More Helpful > Helpful > Neutral/OK > Consume Less > " +
    "Consume Much Less > Avoid, plus a numeric `value`, a `description` and `notes`. " +
    "This is the per-food reconciliation primitive — use it for taste tiebreaks and the " +
    "off-plan food checker. IMPORTANT: 'Neutral/OK' is also what you get when there's NO " +
    "data on the pairing, so it does not by itself mean 'researched and neutral'.",
  {
    foodItemID: z.number().int().describe("A single foodItemID from nutridigm_food_items."),
    healthConditionIDs: conditionList,
  },
  async ({ foodItemID, healthConditionIDs }) =>
    toToolResult(
      await apiGet("goodfor", {
        foodItemID,
        healthConditionID: healthConditionIDs.join(","),
      })
    )
);

// 5. /topdoordonts -------------------------------------------------------
server.tool(
  "nutridigm_top_do_or_donts",
  "Get the top foods to either CONSUME (most helpful) or AVOID (most harmful) for a set " +
    "of conditions, already sorted best-first. This is the proactive meal-plan / Daily " +
    "Picks primitive: one call with all the user's conditions yields a single ranked " +
    "profile. Returns empty (HTTP 220) when nothing is curated.",
  {
    healthConditionIDs: conditionList,
    consumeOrAvoid: z
      .enum(["consume", "avoid"])
      .describe("'consume' for helpful foods, 'avoid' for harmful foods."),
    limit: z.number().int().positive().optional().describe("Optional max number of items."),
  },
  async ({ healthConditionIDs, consumeOrAvoid, limit }) =>
    toToolResult(
      await apiGet("topdoordonts", {
        healthConditionID: healthConditionIDs.join(","),
        consumeOrAvoid,
        limit,
      })
    )
);

// 6. /suggest ------------------------------------------------------------
server.tool(
  "nutridigm_suggest",
  "Get the best (most helpful / least harmful) foods WITHIN a single fineFoodGroup for a " +
    "set of conditions, sorted best-first. Each item carries an advisory `description` plus " +
    "its `descriptionNumericID`. Use for category browsing (e.g. 'best fish for X'). Takes a " +
    "fineFoodGroup code (see nutridigm_food_groups). Returns empty (HTTP 220) when nothing " +
    "is curated.",
  {
    healthConditionIDs: conditionList,
    fineFoodGroup: z.string().describe("A fineFoodGroup code, e.g. 'b1', 'g2', 'k1'."),
  },
  async ({ healthConditionIDs, fineFoodGroup }) =>
    toToolResult(
      await apiGet("suggest", {
        healthConditionID: healthConditionIDs.join(","),
        fineFoodGroup,
      })
    )
);

// 7. /detailed -----------------------------------------------------------
server.tool(
  "nutridigm_detailed",
  "Get a helpful / neutral / harmful list of common foods within a coarseFoodGroup for a " +
    "set of conditions. Broader grouping and more widely-known foods than nutridigm_suggest; " +
    "helpful-only-vs-three-lists is the other difference. Takes a coarseFoodGroup code and a " +
    "listType. Returns empty (HTTP 220) when nothing is curated.",
  {
    healthConditionIDs: conditionList,
    coarseFoodGroup: z.string().describe("A coarseFoodGroup code, e.g. 'b', 'g', 'k'."),
    listType: z
      .enum(["helpful", "neutral", "harmful"])
      .describe("Which list to return."),
  },
  async ({ healthConditionIDs, coarseFoodGroup, listType }) =>
    toToolResult(
      await apiGet("detailed", {
        healthConditionID: healthConditionIDs.join(","),
        coarseFoodGroup,
        listType,
      })
    )
);

// 8. /references ---------------------------------------------------------
server.tool(
  "nutridigm_references",
  "Get the list of study references backing ONE food + ONE condition pairing. Powers the " +
    "'N studies' credibility signal — call it per food-condition pair and count the returned " +
    "array. Takes a single healthConditionID and a single foodItemID (no lists here).",
  {
    healthConditionID: z.number().int().describe("A single healthConditionID."),
    foodItemID: z.number().int().describe("A single foodItemID."),
  },
  async ({ healthConditionID, foodItemID }) =>
    toToolResult(
      await apiGet("references", { healthConditionID, foodItemID })
    )
);

/* ---------------------------------------------------------------------- *
 * Boot
 * ---------------------------------------------------------------------- */
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[nutridigm-mcp] connected over stdio");
