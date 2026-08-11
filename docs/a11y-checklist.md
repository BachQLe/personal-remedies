# Accessibility checklist — Remedi PWA

*Last updated: August 11, 2026 (Task T6D). This is a working checklist, not a
report — update the status column in place as items move. Statuses used:*

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
| Color contrast (WCAG 2.x AA) | **done** (tooling), **blocked** (15 pairings) | `scripts/check-contrast.mjs` computes real ratios from `tailwind.config.js` tokens; `scripts/check-contrast.test.js` locks the current failing set as a regression guard (new failures fail CI, `KNOWN_FAILURES` documents the rest). See §3 for the current summary — do not re-derive it by hand, run the script. |
| Reduced motion | **done** | `<MotionConfig reducedMotion="user">` wraps the whole app in `src/main.jsx` — every `motion.*` component (21+ across onboarding/carousels/sheets) auto-disables transform/opacity animation when the OS "Reduce Motion" setting is on, with no per-component opt-in needed. Verified by code (single wrap point, can't be bypassed per-screen) rather than a runtime test, since jsdom has no `prefers-reduced-motion` media query to assert against. |
| Touch target size (WCAG 2.5.5, 44×44px) | **done** (screens/components swept this wave) | `.tap-target` utility in `src/index.css` (invisible `::after`, `max(100%, 44px)` in both dimensions) applied across every icon-sized (`w-6/7/8 h-6/7/8`) interactive element found in a fresh grep of `src/screens/**`, `FoodDetailCard.jsx`, `onboarding/**`, `TabBar.jsx`, and the owned `shared/` subset (`SaveButton`, `FoodImageCard`, `RankedRow`, `BestRecipesRails`, `TiltCarousel`) — see Playwright scenario (d) in the T6D verification run for `boundingBox()` measurements on real fixed buttons. `TabBar.jsx` NavLinks already carry explicit `min-w-[44px] min-h-[44px]`. Not exhaustive outside the owned-file list (see `.qa2`/other agents' scope for `src/components/shared/*` not listed above). |
| Accessible names (every interactive element) | **done** (owned files) | Every `<button>`/`role="button"` in the owned-file sweep has either visible text content or an explicit `aria-label`; every purely decorative icon (lucide or the shared `Icon` wrapper) sibling to a labeled control has `aria-hidden="true"`. Fixed this wave: `CoverageNotice.jsx` info icon, `GroupsTab.jsx` tile icon, `MealprepCarousel.jsx` fallback leaf icon, `ProfileScreen.jsx` saving-spinner icon, `RecipesScreen.jsx` chevron + meal-type icon, `SearchScreen.jsx` loading spinner, `ProfileBuilder.jsx`'s "Continue" button (had **no** accessible name at all while `saving` — the "Continue" text disappears and nothing replaced it; now `aria-label={saving ? 'Saving your profile' : 'Continue'}`). No automated test asserts this globally yet (would need an axe-core-style DOM sweep, which isn't wired into this repo) — verified by code review + Playwright scenario (e) below. |
| aria-label guardrail (no numeric score, no health claim) | **done** | Every `aria-label` added or reviewed this wave describes UI factually ("Save recipe", "Remove from plan", "Add to picks") — none interpolate `numericId`/`descriptionNumericID`. `FoodRating`/`SaveButton`'s existing labels were already compliant (reviewed, not owned this wave). |
| `aria-current="page"` on the active tab | **done** | Not custom code — react-router v7's `NavLink` (`src/components/layout/TabBar.jsx`) sets `aria-current="page"` on the active link by default (confirmed in `node_modules/react-router/dist/development/chunk-QUQL4437.mjs`: `"aria-current": ariaCurrentProp = "page"`). No app code needed to add this. |
| BottomSheet dialog semantics | **done** | `role="dialog"`, `aria-modal="true"`, focus trap, `Escape` closes + returns focus — implemented in `src/components/shared/BottomSheet.jsx` (prior wave). Verified this wave via Playwright scenario (c): open Profile → edit calorie target → Escape closes + focus returns. |
| Error states never render as empty | **done** (api.js + adapter.js) | Binding project rule, not narrowly an a11y item, but affects screen-reader users equally (an empty list reads as "nothing here" either way it's rendered). `src/api/adapter.js`'s `getMealPlanSuggestions` and `src/api/api.js`'s `searchFoodsAndRecipes`/`searchNaturalSourceItems` now throw on total failure, degrade honestly on partial failure, and never throw on a real empty/220 result. Guarded by `src/api/__tests__/adapter.mealPlanOutage.test.js` and the new `src/api/__tests__/api.searchHonesty.test.js`. |

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

**Not verified this wave (out of this task's owned-file scope):** the
marketing site (`/`, `/providers`, `/developers`, `/science`, `/about`,
`/news`, `/contact`, `/terms`, `/privacy`), `/login`, `/survey`,
`/kitchen-sink`. These share the same design-system primitives (buttons,
`Icon.jsx`, contrast tokens) so are unlikely to be worse off than the `/app/*`
sweep above, but nobody has walked them screen-by-screen this wave.

---

## 3. Contrast summary (from `node scripts/check-contrast.mjs`, run Aug 11 2026)

**19 / 34 pairings pass AA.** 15 fail — all are existing brand-palette
choices (forest-700 buttons, honey/caution/avoid tinted chips, muted
char-300/400 text), not something this task changes. Per the script's own
header and `scripts/check-contrast.test.js`: *"Bach decides palette changes,
not you."* Full per-pairing ratios are the script's output, not duplicated
here — run it for the live numbers. The 15 failing pairing ids, for
reference (each maps 1:1 to a component in `KNOWN_FAILURES`):

`muted-text-on-white` · `primary-btn-text` · `pill-forest-text` ·
`pill-honey-text` · `retry-btn-text` · `signalchip-beneficial-text` ·
`signalchip-limit-text` · `signalchip-limit-dot` · `signalchip-avoid-text` ·
`studyreferences-link` · `pillswitcher-selected-positive` ·
`pillswitcher-selected-negative` · `pill-selected` ·
`searchinput-placeholder` · `emptystate-icon`

Two are UI-component ratios (need 3:1, not 4.5:1): `signalchip-limit-dot`,
`emptystate-icon` — still fail even at the lower bar.

**Action for Bach:** these cluster around three token choices —
`forest-700`/`forest-600` as button/pill fill (used white-on-forest in 5+
places, all landing 2.8–4.0:1), the `honey`/`caution`/`avoid` tinted-chip
family (text-on-100-bg pattern, 2.4–3.8:1), and `char-300`/`char-400` as
muted/placeholder text (2.2–3.75:1). Fixing any one token likely clears
several failures at once rather than needing 15 individual changes.

---

## 4. Dynamic Type / zoom

| Check | Status | Notes |
|---|---|---|
| 200% browser zoom (`font-size: 32px` on `<html>`) | **done** (headless, this wave) | Verified via Playwright on `/app/home` and `/app/plan` — see T6D verification report for the specific screenshots and any clipping called out there. Real findings live in that report, not duplicated here to avoid drift. |
| iOS Dynamic Type at max (Accessibility Sizes, "AX5") | **needs-device** | Browser `font-size` zoom is a reasonable proxy for text reflow but does not exercise iOS's actual Dynamic Type category stepping, `UIFontMetrics` scaling of icons/spacing, or how Safari's own chrome shrinks the viewport at max sizes. Needs a real device pass at native conversion. |
| VoiceOver rotor / heading navigation | **needs-device** | Screens use semantic headings (`h1`/`h2`) but the rotor's "Headings" list has never been walked on-device. No blocker known; not yet confirmed. |
| Switch Control / full keyboard-only pass | **needs-device** | Keyboard focus order was reviewed in code (tab order follows DOM order, no positive `tabIndex`), and BottomSheet's Escape/focus-trap is Playwright-verified, but a full switch-control pass through every flow (search → save → plan → checkout-equivalent) hasn't been run. |

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
- **Brand palette contrast failures** (§3) — intentionally not changed;
  Bach's call.
