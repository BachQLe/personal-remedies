# Accessibility checklist — Remedi PWA

*Last updated: September 8, 2026 (Task W2 — recorded Bach's brand-palette
contrast decision in §1/§3/§5; see those sections for the token changes).
Previously updated August 11, 2026 (Task T7D — corrected several unsupported
"done" citations left by T6D; see the T7D notes inline below). Originally
written Task T6D. This is a working checklist, not a report — update the
status column in place as items move. Statuses used:*

- **done** — verified automatable (a test/script asserts it, or code review +
  headless Playwright confirmed it) and not expected to regress silently.
- **needs-device** — cannot be meaningfully verified without a real iOS
  device at native conversion (VoiceOver rotor behavior, Dynamic Type at the
  OS level, haptics, Safari-specific viewport quirks). Headless/simulator
  checks are not a substitute; tracked here so native conversion has a
  concrete punch list instead of starting from zero.
- **blocked** — known issue, not fixed this wave, with the reason it's
  blocked (usually: fixing it is a content/design decision outside this
  task's authorization, e.g. brand palette).

---

## 1. Automated / tooling-backed

| Check | Status | How it's verified |
|---|---|---|
| Color contrast (WCAG 2.x AA) | **done** | `scripts/check-contrast.mjs` computes real ratios from `tailwind.config.js` tokens; all 34/34 pairings pass AA as of the W2 palette pass (Sep 8, 2026). `scripts/check-contrast.test.js` locks this as a regression guard — `KNOWN_FAILURES` is now empty, so any new failure fails CI outright. See §3 for the current summary and which tokens changed. |
| Reduced motion | **done** | `<MotionConfig reducedMotion="user">` wraps the whole app in `src/main.jsx` — every `motion.*` component (21+ across onboarding/carousels/sheets) auto-disables transform/opacity animation when the OS "Reduce Motion" setting is on, with no per-component opt-in needed. Verified by code (single wrap point, can't be bypassed per-screen) rather than a runtime test, since jsdom has no `prefers-reduced-motion` media query to assert against. |
| Touch target size (WCAG 2.5.5, 44×44px) | **done** (screens/components swept this wave) | `.tap-target` utility in `src/index.css` (invisible `::after`, `max(100%, 44px)` in both dimensions) applied across every icon-sized (`w-6/7/8 h-6/7/8`) interactive element found in a fresh grep of `src/screens/**`, `FoodDetailCard.jsx`, `onboarding/**`, `TabBar.jsx`, and the owned `shared/` subset (`SaveButton`, `FoodImageCard`, `RankedRow`, `BestRecipesRails`, `TiltCarousel`). `TabBar.jsx` NavLinks already carry explicit `min-w-[44px] min-h-[44px]`. Not exhaustive outside the owned-file list (see `.qa2`/other agents' scope for `src/components/shared/*` not listed above). **[T7D correction]** the prior wording cited "Playwright scenario (d) in the T6D verification run" as evidence — no such report/script exists anywhere in this repo (checked `find`/`grep` across the whole tree); that citation was fabricated and has been removed. Re-verified for real this wave instead: Playwright `getComputedStyle(el, '::after')` on `HomeScreen.jsx`'s news-banner Dismiss button (a live `.tap-target` instance, visual box 28×28px) measured the pseudo-element hit area at exactly `44px × 44px`, confirming the mechanism works as described on at least one real instance. |
| Accessible names (every interactive element) | **done** (owned files) | Every `<button>`/`role="button"` in the owned-file sweep has either visible text content or an explicit `aria-label`; every purely decorative icon (lucide or the shared `Icon` wrapper) sibling to a labeled control has `aria-hidden="true"`. Fixed this wave: `CoverageNotice.jsx` info icon (`src/screens/suggestions/CoverageNotice.jsx:73`), `GroupsTab.jsx` tile icon, `MealprepCarousel.jsx` fallback leaf icon, `ProfileScreen.jsx` saving-spinner icon, `RecipesScreen.jsx` chevron + meal-type icon, `SearchScreen.jsx` loading spinner, `ProfileBuilder.jsx`'s "Continue" button (had **no** accessible name at all while `saving` — the "Continue" text disappears and nothing replaced it; now `aria-label={saving ? 'Saving your profile' : 'Continue'}`, confirmed present at `ProfileBuilder.jsx:204`). No automated test asserts this globally yet (would need an axe-core-style DOM sweep, which isn't wired into this repo). **[T7D correction]** the prior wording cited "Playwright scenario (e) below" — no such scenario is listed anywhere in this document or elsewhere in the repo; that citation was fabricated and has been removed. Re-spot-checked this wave via `grep` against every file named above — all the cited `aria-hidden`/`aria-label` additions are real and present at the cited locations. Still code-review-level, not a regression-proof automated sweep. |
| aria-label guardrail (no numeric score, no health claim) | **done** | Every `aria-label` added or reviewed this wave describes UI factually ("Save recipe", "Remove from plan", "Add to picks") — none interpolate `numericId`/`descriptionNumericID`. `FoodRating`/`SaveButton`'s existing labels were already compliant (reviewed, not owned this wave). |
| `aria-current="page"` on the active tab | **done** | Not custom code — react-router v7's `NavLink` (`src/components/layout/TabBar.jsx`) sets `aria-current="page"` on the active link by default (confirmed in `node_modules/react-router/dist/development/chunk-QUQL4437.mjs`: `"aria-current": ariaCurrentProp = "page"`). No app code needed to add this. |
| BottomSheet dialog semantics | **done** | `role="dialog"`, `aria-modal="true"`, focus trap, `Escape` closes + returns focus — implemented in `src/components/shared/BottomSheet.jsx` (prior wave). **[T7D correction]** the prior wording cited "Playwright scenario (c)" as having verified this — no such scenario record exists anywhere in the repo; that citation was fabricated. Actually run for real this wave (T7D): Playwright, `/app/profile` → click "Daily calorie target" row → sheet opens with `role="dialog"` + `aria-modal="true"` present, focus lands inside the sheet → `Escape` pressed → dialog count on page drops to 0 (closed) and `document.activeElement` is confirmed back on the triggering row button. All assertions passed. |
| Error states never render as empty | **done** (api.js + adapter.js) | Binding project rule, not narrowly an a11y item, but affects screen-reader users equally (an empty list reads as "nothing here" either way it's rendered). `src/api/adapter.js`'s `getMealPlanSuggestions` and `src/api/api.js`'s `searchFoodsAndRecipes`/`searchNaturalSourceItems` now throw on total failure, degrade honestly on partial failure, and never throw on a real empty/220 result. Guarded by `src/api/__tests__/adapter.mealPlanOutage.test.js` and `src/api/__tests__/api.searchHonesty.test.js` — both files confirmed to exist and pass (T7D: `npx vitest run` → 472/472 green at that time; full suite as of Oct 2026: 863/863 green, includes these). |

---

## 2. Per-screen checklist (`/app/*`)

Columns: **Reading order** (does the DOM order match the visual/logical
order a screen-reader user would expect — headers before content, related
controls grouped) · **Focus order** (tab order matches visual order; nothing
traps focus outside an intentional modal) · **Target sizes** (interactive
elements ≥44×44px, this wave's sweep) · **Reduced motion** (respects the
global `MotionConfig` wrap) · **No color-only meaning** (state is never
conveyed by color alone).

| Screen | Reading order | Focus order | Target sizes | Reduced motion | No color-only meaning |
|---|---|---|---|---|---|
| `/app/home` | done | done | done | done (global wrap) | done — condition/save state pairs a color with an icon or text, never color alone |
| `/app/search` | done | done | done | done | done |
| `/app/suggestions` (+ tabs, `/group/:id`) | done | done | done | done | needs-device — `SignalChip`'s beneficial/limit/avoid tinting is reviewed as icon+text+color (not owned this wave, believed compliant); confirm with VoiceOver + Increase Contrast on-device |
| `/app/recipes` | done | done | done | done | done |
| `/app/plan` (Day / Week / Saved recipes) | done | done | done | done | done — `DayStrip`'s selected-day highlight uses a sliding filled pill (shape + color), not color alone |
| `/app/profile` | done | done | done | done | done |
| `/app/upgrade` (Paywall) | done | done | done | done | done |
| `/onboarding` (Welcome, Build profile, Backup) | done — reading order intentionally sequences the word-reveal animation before interactive controls become focusable (`showButton` gates `pointer-events`); do not "fix" this, it's the preserved "scroll-up transition" the animation is built around | done | done | done — the word-by-word reveal already honors `useReducedMotion()` internally (`instant` short-circuits all timers) | done |

**T7D spot-check note:** this table's cells were inherited from a prior
wave's code review with no per-cell evidence citation, so T7D re-checked what
could be cheaply re-verified rather than re-walking all 40 cells from
scratch: **Focus order** — a repo-wide `grep -rn tabIndex src/` found only
`tabIndex={0}` (used correctly, on custom `role="button"` elements that need
to join the natural tab order) and one `tabIndex={-1}` (`BottomSheet.jsx`'s
programmatic focus target); no positive `tabIndex` anywhere, so nothing
skips or reorders the DOM tab sequence on any screen — this genuinely
supports "done" across the whole column. **Reduced motion** — provably
"done" everywhere per the global `MotionConfig` wrap in §1; no per-screen
opt-out exists. **No color-only meaning** — the two specific claims in this
table were spot-checked against source and both hold: `DayStrip.jsx`'s
selected-day highlight is a `framer-motion` `layoutId` sliding
`rounded-xl bg-blue-950` fill (shape, not just color), and `SignalChip.jsx`
pairs each of beneficial/limit/avoid with a distinct icon
(`check`/`alert-triangle`/`x`) per an explicit in-code comment ("no
color-only signals"). **Reading order** — confirmed `PageHeader`/`h1` is
present and precedes the main content block in every screen file listed
(grep'd each); this is not a full screen-reader DOM-order walkthrough for
every screen, just confirmation the claimed heading-first structure is real.
**Target sizes** — relies on the touch-target sweep in §1, which already
documents its own non-exhaustiveness; not independently re-verified per
screen here.

**Not verified this wave (out of this task's owned-file scope):** the
marketing site (`/`, `/providers`, `/developers`, `/science`, `/about`,
`/news`, `/contact`, `/terms`, `/privacy`), `/login`, `/survey`,
`/kitchen-sink`. These share the same design-system primitives (buttons,
`Icon.jsx`, contrast tokens) so are unlikely to be worse off than the `/app/*`
sweep above, but nobody has walked them screen-by-screen this wave.

---

## 3. Contrast summary (from `node scripts/check-contrast.mjs`, run Sep 8 2026)

**W2 update:** Bach made the palette call this wave — the 15 failing
pairings from the Aug 11 audit (§3 below is rewritten to match) were fixed
by nudging four token *values* and moving a handful of call sites to an
existing, already-darker step of the same token family. No new colors were
invented and no component styling changed beyond the class name of the
shade referenced.

**34 / 34 pairings pass AA.** Zero fail. Token changes:

- **`forest-700`** (`#628C22` → `#4F7118`) and **`forest-800`**
  (`#4A6E18` → `#3D5812`) — `forest-700` is the primary-action token
  (`PrimaryButton.jsx`, `.pill-forest`, `DataState.jsx` retry button,
  `StudyReferences.jsx` link, `PillSwitcher.jsx` positive thumb,
  `Pill.jsx` selected state, `EmptyState.jsx` icon). It was the single
  biggest lever in the audit — darkening it alone cleared six of the
  fifteen failures (`primary-btn-text`, `pill-forest-text`,
  `retry-btn-text`, `studyreferences-link`, `pillswitcher-selected-positive`,
  `pill-selected`) in one move, since they all shared the same background
  token.
- **`caution-700`** (`#9C6A18` → `#8A5D15`) — a small nudge past the AA
  line for `SignalChip.jsx`'s "limit" tinted text/dot
  (`signalchip-limit-text`, `signalchip-limit-dot`), which needed the
  darkest ratio in the audit (2.42:1 → now 4.74:1 / 5.74:1).
- **`honey-700`** (`#9C6F1E` → `#94691C`) plus a new **`honey-800`**
  (`#6F4E14`) — `.pill-honey` in `src/index.css` moved its background from
  `honey-600` to the (slightly darkened) `honey-700`, with `hover:` bumped
  to the new `honey-800` so the hover state keeps a visible step down from
  the resting state.
- **Call-site moves to an existing darker step (no new color, no value
  change):** `SignalChip.jsx`'s "beneficial" and "avoid" signals moved from
  `benefit-600`/`avoid-600` to the already-existing `benefit-700`/
  `avoid-700` (those hexes were untouched — the tokens already existed at
  the right contrast, just weren't the ones in use). `PillSwitcher.jsx`'s
  negative thumb moved from `red-500` to the existing `red-600`.
  `EmptyState.jsx`'s icon moved from `forest-600` to `forest-700`.
  `SearchInput.jsx`, `OtpCodeEntry.jsx`, and `DataState.jsx`'s offline-cloud
  label all moved their muted/placeholder text from `char-300`/`char-400`
  to the existing `char-500` step (covering `muted-text-on-white` and
  `searchinput-placeholder`).

No brand-new colors were added to the palette other than `honey-800`, which
exists solely as `.pill-honey`'s hover step one shade below the new
`honey-700` resting color.

---

## 4. Dynamic Type / zoom

| Check | Status | Notes |
|---|---|---|
| 200% browser zoom (`font-size: 32px` on `<html>`) | **done** (T7D, real headless run — see findings below) | **[T7D correction]** the previous wording here claimed "done (headless, this wave)" and pointed to "the T6D verification report" for screenshots. Neither was true: no such report exists anywhere in this repo (confirmed by searching the whole tree), no screenshots were ever taken, and this scenario had never actually been run. Replaced with real findings below, genuinely run and screenshotted this wave — one real bug found and fixed on `/app/home`, one real bug found on `/app/profile` and logged as an open follow-up (not fixed — outside this task's file ownership), `/app/plan` clean. |
| iOS Dynamic Type at max (Accessibility Sizes, "AX5") | **needs-device** | Browser `font-size` zoom is a reasonable proxy for text reflow but does not exercise iOS's actual Dynamic Type category stepping, `UIFontMetrics` scaling of icons/spacing, or how Safari's own chrome shrinks the viewport at max sizes. Needs a real device pass at native conversion. |
| VoiceOver rotor / heading navigation | **needs-device** | Screens use semantic headings (`h1`/`h2`) but the rotor's "Headings" list has never been walked on-device. No blocker known; not yet confirmed. |
| Switch Control / full keyboard-only pass | **needs-device** | Keyboard focus order was reviewed in code (tab order follows DOM order, no positive `tabIndex`), and BottomSheet's Escape/focus-trap is Playwright-verified, but a full switch-control pass through every flow (search → save → plan → checkout-equivalent) hasn't been run. |

### 200% zoom — full findings (T7D)

**Method:** Playwright, viewport 430×800, seeded profile (`remedi.v1`
= `{profile:{firstName:'QA', conditions:[203], allergies:[], dietaryPattern:
'omnivore', religiousRestriction:'none', medications:[]}}`), single dev
server on :5173, `page.addStyleTag({content:'html{font-size:32px !important}'})`,
then programmatic overflow/scroll-reachability checks plus screenshots that
were visually reviewed (not just measured).

**Results:**

- **`/app/home` — real bug found, fixed this wave.** The root container
  (`src/screens/home/HomeScreen.jsx`) carried a fixed `h-[100dvh]
  overflow-hidden -mb-28`. At 32px root font size the natural-height rows
  above the carousel (Dietary Guidance / Meal Planner / Food Lookup /
  Natural Sources Lookup) grow taller than the fixed budget, and
  `overflow-hidden` clipped the excess with **no way to scroll to it** — the
  Food Lookup and Natural Sources Lookup buttons ended up stranded behind
  the bottom TabBar, confirmed by `boundingBox()` measurement (button
  bottom edge below the TabBar's top edge) and by screenshot (only
  fragments of the button text, e.g. "es"/"kup", peeking out above the
  bar). **Fix:** changed the root's `overflow-hidden` to
  `overflow-y-auto overflow-x-hidden`, keeping `h-[100dvh]` and `-mb-28`
  unchanged. `-mb-28` cancels `AppShell`'s `pb-28` navbar reserve so the
  lower shell's own `pb-28` paints the navbar-clearance area — that's
  load-bearing (per the "AppShell cream fix" project note) and was left
  alone. At default text size, content already fits inside the fixed
  100dvh box exactly as designed, so `overflow-y-auto` is a no-op — no
  scrollbar, pixel-identical layout (confirmed: `boundingBox()` on both
  lookup buttons returned the exact same `x/y/width/height` before and
  after the change, and before/after screenshots at default size are
  visually indistinguishable). At 32px, the box now scrolls internally;
  scrolling to the bottom reaches both buttons fully clear of the TabBar
  (`boundingBox()` bottom edge now above the TabBar's top edge), and no
  horizontal scrollbar appears (`document.documentElement.scrollWidth`
  never exceeds `clientWidth` in either mode). Screenshots before and
  after were visually reviewed at both zoom levels to confirm this, not
  just measured programmatically.
- **Subtitle truncation — deliberate fix, not left accidental.** Two
  `<span>`s (the Dietary Guidance and Meal Planner card subtitles) used
  `truncate` (single-line ellipsis), which at 32px cut off meaningful
  text entirely. Changed to `line-clamp-2` (allow wrapping to 2 lines,
  then ellipsis) instead of keeping truncation, since these cards are
  natural-height (not flex-constrained) and can absorb the extra height
  without breaking the layout — confirmed by screenshot. Note for anyone
  touching this again: Tailwind's `line-clamp-N` utility sets its own
  `display: -webkit-box`, and combining it with the `block` utility
  silently loses the clamp (`block`'s `display` wins the cascade tie —
  `display` core-plugin is registered after `lineClamp` in
  `corePlugins.js`, so `.block` sorts later in the generated stylesheet).
  The original markup had both classes together; `block` was removed so
  clamping actually takes effect (verified via
  `getComputedStyle().webkitLineClamp` and a rendered-height check before
  and after the removal).
- **`/app/plan` — clean.** Zero clipped elements, no horizontal scroll.
- **`/app/profile` — real bug found, NOT fixed (out of scope, open
  follow-up).** One `<span className="text-[11px] text-char-400 font-sans
  truncate">` (`src/screens/profile/ProfileScreen.jsx:217`) clips a
  condition description (e.g. "Slow down of aging process. Maximal Life
  Span…") at 32px root font. `ProfileScreen.jsx` is outside this task's
  file ownership, so this is recorded here as a follow-up rather than
  fixed — see §5.

---

## 5. Known gaps / explicitly not attempted this wave

- **Marketing site + auth/onboarding-adjacent routes** (see §2's "not
  verified" note) — same primitives, not walked screen-by-screen.
- **`src/components/shared/*` outside the owned subset** (`SaveButton.jsx`,
  `FoodImageCard.jsx`, `RankedRow.jsx`, `BestRecipesRails.jsx`,
  `TiltCarousel.jsx`) — everything else in that directory was a different
  wave's ownership; assumed done per the T6D task brief, not re-audited here.
- **No automated axe-core / DOM a11y linter wired into CI.** The accessible-
  name and target-size checks in §1 are code-review + Playwright spot-checks,
  not a regression-proof automated sweep the way contrast is. A future task
  could add `@axe-core/playwright` to the existing Playwright setup
  (`.claude/skills/verify/SKILL.md`) for continuous coverage.
- **Brand palette contrast failures** (§3) — resolved. Bach made the call
  Sep 8, 2026: darken `forest-700`/`forest-800` and `caution-700`, nudge
  `honey-700` and add `honey-800`, and move several call sites to an
  existing darker step of the same token family (no new colors invented).
  All 34/34 pairings now pass AA; see §3 for the full breakdown.
- **`ProfileScreen.jsx` condition-description truncation at 200% zoom**
  (§4) — `src/screens/profile/ProfileScreen.jsx:217`'s
  `<span className="text-[11px] text-char-400 font-sans truncate">` clips
  condition descriptions at 32px root font (found T7D). Real bug, not
  fixed — `ProfileScreen.jsx` is outside this task's file ownership. Likely
  the same fix as HomeScreen's subtitles (`truncate` → `line-clamp-N`,
  minding the `block`+`line-clamp` cascade conflict documented in §4).
