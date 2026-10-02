/**
 * entitlements.js — Pure entitlement gate for Remedi's monetization
 * scaffolding (REMEDI_MASTER_PLAN.md Phase 6, item 6.1).
 *
 * WHERE THIS SITS TODAY: everything is unlocked. There is no free/paid
 * split in the product yet — this module exists so that when one is
 * introduced, it's a data edit to `ENTITLEMENT_CONFIG` below, not a rewrite
 * of every call site that currently (and will still) call `hasEntitlement`.
 *
 * ── The swap path to a real paid tier ──────────────────────────────────────
 *
 * Step 1 (config-only, PWA, no native work required):
 *   - Register the feature in `ENTITLEMENT_CONFIG.features` with a
 *     `{ tier: 'plus' }` (or similar) descriptor.
 *   - Flip `ENTITLEMENT_CONFIG.defaultUnlocked` to `false` if the product
 *     wants an allowlist model (everything locked unless registered as
 *     free) instead of today's denylist model (everything unlocked unless
 *     registered as paid). Either model is representable by this shape —
 *     see `hasEntitlement` below for exactly how each field is read.
 *   - `hasEntitlement(featureKey)` starts returning `false` for that key.
 *     No call site changes: every screen already calls `hasEntitlement`
 *     rather than checking config directly, so the gate takes effect
 *     everywhere at once.
 *
 * Step 2 (6.3, native conversion): swap the *implementation* of
 *   `hasEntitlement`/`listFeatures` to read RevenueCat's `CustomerInfo`
 *   (active entitlements) instead of the static config object. RevenueCat
 *   is the chosen vendor specifically so receipt validation, restore,
 *   trials, and cancellation come for free instead of being hand-rolled
 *   against raw StoreKit, and so Android billing (6.6, Release 2.0) is a
 *   second RevenueCat-configured store rather than a second bespoke
 *   integration. This module's exported function SIGNATURES
 *   (`hasEntitlement(featureKey) -> boolean`, `listFeatures() -> Feature[]`)
 *   are deliberately the entire contract screens depend on, so that native
 *   conversion swap is internal to this file.
 *
 * ── Restore Purchases (6.4) ─────────────────────────────────────────────────
 *
 * Restore Purchases is an **Apple App Store requirement** (its absence is a
 * routine App Review rejection), not a feature this web app can meaningfully
 * offer: a PWA has no App Store receipt to restore in the first place, since
 * nothing can be purchased here yet (see PaywallScreen.jsx — its CTA is a
 * placeholder that explicitly does not charge anything). Restore Purchases
 * gets built when 6.3's RevenueCat wiring happens at native conversion,
 * using RevenueCat's `restorePurchases()` — not before, and not here.
 *
 * ── What this module deliberately does NOT do ──────────────────────────────
 * - No React, no DOM, no storage reads. Pure config + pure functions, so it
 *   is trivially unit-testable and trivially portable into a future
 *   `packages/core` extraction.
 * - No persistence of "did the user buy X" — that's RevenueCat's job later.
 *   Today there is nothing to persist because nothing is for sale.
 */

/**
 * @typedef {Object} FeatureDescriptor
 * @property {string} key - Stable identifier, e.g. 'top_dos_donts'.
 * @property {string} label - Short human-readable name for the paywall list.
 * @property {string} [description] - Neutral, non-persuasive one-line
 *   description of what the feature is. NOT marketing copy — see
 *   PaywallScreen.jsx's file-header comment re: the C2 health-claim audit.
 * @property {'plus'} [tier] - Which paid tier unlocks this feature, when
 *   `defaultUnlocked` is false or this feature is explicitly gated. Absent
 *   today because nothing is gated; the shape exists so a future entry can
 *   add it without changing how `hasEntitlement` is called.
 */

/**
 * The single source of truth for what's unlocked.
 *
 * `defaultUnlocked: true` — every feature is available regardless of
 * whether it appears in `features` below, UNLESS that feature's own entry
 * sets an explicit lock (see `hasEntitlement`). Nothing is locked today, so
 * `features` currently holds only unlocked descriptors (for the paywall's
 * "what's included" list) with no `tier` set.
 *
 * Flipping the free/paid split later is exactly one of:
 *   (a) set `defaultUnlocked: false` and mark specific features as free, or
 *   (b) keep `defaultUnlocked: true` and mark specific features `{ tier: 'plus' }`
 *       to lock only those.
 * Both are one-line edits to this object — no call-site changes either way.
 *
 * @type {{ defaultUnlocked: boolean, features: Record<string, FeatureDescriptor> }}
 */
export const ENTITLEMENT_CONFIG = {
  defaultUnlocked: true,
  features: {
    // Real premium-side surfaces (REMEDI_MASTER_PLAN.md §6.7's boundary
    // table): everything here is condition-scored against the user's own
    // health profile, which is the line Pricing.jsx's copy draws between
    // Free and Premium. None carries a `tier` yet — see the module
    // docblock's swap path — so `defaultUnlocked: true` means every one of
    // these still resolves unlocked today. Descriptions are neutral/factual
    // per the no-health-claims guardrail — final copy is a Track C (C10) +
    // C2 audit deliverable, not this file's.
    top_dos_donts: {
      key: 'top_dos_donts',
      label: "Top Do's & Don'ts",
      description: 'Condition-ranked list of what to favor and what to limit.',
    },
    food_group_detail: {
      key: 'food_group_detail',
      label: 'Food Groups Eat/Avoid detail',
      description: 'Per-item eat/avoid verdicts within a food group, scored against your conditions.',
    },
    suggest: {
      key: 'suggest',
      label: 'Suggestions for you',
      description: 'Condition-ranked suggestions within a specific food group.',
    },
    plan: {
      key: 'plan',
      label: 'Meal planner',
      description: 'Build a plan from condition-filtered candidate pools.',
    },
    saved_plans: {
      key: 'saved_plans',
      label: 'Saved plans',
      description: 'Keep copies of plans you have built.',
    },
  },
};

/**
 * Whether the current user has access to `featureKey`.
 *
 * Resolution order:
 *   1. Registered key WITH a `tier` set → locked (`false`) UNCONDITIONALLY,
 *      regardless of `defaultUnlocked`. A `tier` is a deliberate, explicit
 *      marker that a feature requires a paid entitlement — and since there
 *      is no concept of an active purchase yet, "requires a tier" can only
 *      resolve to "locked" today. This branch is what native conversion
 *      (6.3) replaces with a real RevenueCat `CustomerInfo` check (does the
 *      signed-in customer have an active entitlement for this tier?).
 *   2. Everything else — a registered key with NO `tier`, or any unknown/
 *      unregistered key — resolves to `ENTITLEMENT_CONFIG.defaultUnlocked`.
 *      This is what makes `defaultUnlocked: true` mean "everything is
 *      unlocked today": nothing in the shipped config sets a `tier`, so
 *      every call bottoms out here. It's also what makes the free/paid
 *      split a config-only change — flip `defaultUnlocked` to `false` and
 *      every untiered feature (known or not) locks at once, or leave it
 *      `true` and add `{ tier: 'plus' }` to individual features to lock
 *      only those.
 *
 * @param {string} featureKey
 * @returns {boolean}
 */
export function hasEntitlement(featureKey) {
  const feature = ENTITLEMENT_CONFIG.features[featureKey];
  if (feature?.tier) return false;
  return ENTITLEMENT_CONFIG.defaultUnlocked;
}

/**
 * Introspection for the paywall screen: every registered feature plus
 * whether it's currently unlocked, so PaywallScreen can render its list
 * purely from config rather than hardcoding feature names in JSX.
 * @returns {Array<FeatureDescriptor & { unlocked: boolean }>}
 */
export function listFeatures() {
  return Object.values(ENTITLEMENT_CONFIG.features).map((feature) => ({
    ...feature,
    unlocked: hasEntitlement(feature.key),
  }));
}
