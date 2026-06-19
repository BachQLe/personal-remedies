# Personal Remedies → Remedy Design System Reskin — Job Pack

**Purpose:** Re-skin the entire `personal-remedies` site to match the **Remedy Design System** (deep-botanical + warm-editorial: forest + plum + honey on warm paper, Newsreader serif + Hanken Grotesk sans + IBM Plex Mono).

**How to use this doc:** Each `## JOB N` block is a **self-contained prompt** you paste into a fresh Sonnet sub-agent. Run **JOB 0 alone and first** — every other job depends on its output. After JOB 0 merges, JOBS 1–12 can run in parallel (file ownership is disjoint).

---

## GLOBAL CONTEXT (every job must read this)

- **Project:** `/Users/bachle/Desktop/personal-remedies/` — Vite + React + Tailwind v3 + Framer Motion + react-router-dom.
- **Run / verify:** `cd /Users/bachle/Desktop/personal-remedies && npm run build` must pass. `npm run dev` serves locally to eyeball.
- **Design system source (reference, read-only):** `/Users/bachle/Downloads/Remedy Design System Extracted/`
  - `tokens/*.css` — colors, typography, spacing, elevation, fonts, base, icons
  - `README.md` + `SKILL.md` — the full brand rulebook
  - `components/*/*.prompt.md` + `*.jsx` — reference implementations of Button, SignalChip, FoodCard, etc.
  - `ui_kits/mobile_app/`, `ui_kits/web_dashboard/` — full pattern recreations to copy from
- **After JOB 0, the in-repo source of truth is** `src/styles/remedy/` (tokens copied in) + the updated `tailwind.config.js`. Reference those, not the Downloads folder.

### Reconciled decisions (do not relitigate)
1. **Hero (JOB 2) is SKIN-ONLY:** change typography, container colors, background color, and remodel some animations. **Do not restructure its content or strip its product-demo emoji** — that is out of scope for the hero by owner's instruction.
2. **Every other surface is STRICT DS-CANON:** no emoji (use Material Symbols Rounded), replace any 1–10 / star / dot ratings with the three signals **Beneficial · Limit · Avoid** (`SignalChip`), numerals/units in IBM Plex Mono, sentence case, calm science-backed voice (guide, never shame, no hype).
3. **Hero background:** the WebGL sunset shader is **removed**. Hero sits on a **solid forest-900 dark surface** with white-on-dark text. (Flippable to paper later; not now.)
4. **Scope = everything:** marketing pages, PWA `/app/*` screens, onboarding, and KitchenSink.

---

## THE DS CONTRACT (shared cheat-sheet — embedded in every job)

**Fonts**
- Display / headlines / big numbers: **Newsreader** (serif, optical sizing, real italics). Weight 500–600, tracking `-0.02em`. Italics = editorial emphasis, often in plum.
- Body / UI / labels / controls: **Hanken Grotesk** (sans). 400–700.
- Data / vitals / units / numerals: **IBM Plex Mono**.
- Eyebrows/overlines: 12px, UPPERCASE, `0.14em` tracking, muted color.
- Min body 14px; line-height 1.5–1.65 (audience is 40+).

**Color tokens** (use the tailwind names JOB 0 defines)
- Forest (primary): `forest-900 #0F2A21` · `800 #143628` · `700 #1E4736` (primary) · `600 #2A5A45` · `500 #3A7058` · `300 #A7C0AC` (sage) · `100 #DCE9DF` · `50 #EDF3EE`
- Plum (secondary): `plum-900 #2E1626` · `800 #401F33` · `700 #5C2A47` · `600 #743A5C` · `400 #A86C8E` · `100 #EBDDE6` · `50 #F4ECF0`
- Honey (accent — a spark, not a field): `honey-700 #9C6F1E` · `600 #C2902F` · `500 #D6A642` · `100 #F3E6C7` · `50 #FAF3E2`
- Neutrals: `char-900 #211E1B` (ink, never pure black) · `char-700 #423D36` · `char-500 #6B645A` (text-secondary) · `char-400 #8A8377` (muted) · `char-300 #B7AF9F` · `sand-200 #E6E6E0` (hairline) · `sand-100 #EEEEE9` · `paper-200 #F5F5F0` (page) · `paper-100 #FAFAF8` · white cards.
- **Signals (load-bearing, never recolor):** Beneficial `#2F8C5A` (tint `#DCEDE2`) · Limit `#C98A2E` (tint `#F6E8CB`) · Avoid `#C04A2F` (tint `#F6DED5`) · Info `#3F6E86` (tint `#DDE8ED`).
- **Surfaces:** page = paper-200 (clean off-white, **NOT cream**); cards = pure white; dark surfaces = forest-700/800/900 or plum-700.
- Text on dark: `#F3EFE6`; muted on dark: `#BFC9BD`.

**Radii (generous, organic):** xs 6 · sm 10 · md 14 (fields) · lg 20 · xl 28 (cards) · 2xl 36 · pill 999 (chips/buttons fully pill).

**Shadows (warm brown-black `rgba(45,36,24,…)`, never pure black):**
- xs `0 1px 2px /.06` · sm `0 2px 8px /.06` · card `0 3px 16px /.07` · md `0 8px 24px /.10` · lg `0 14px 40px /.14, 0 4px 12px /.06` · sheet (upward) `0 -8px 32px /.12`.

**Motion (quiet & quick):** fast 120ms (hovers) · base 200ms (toggles) · slow 320ms (progress/sheets). Ease-out `cubic-bezier(0.22,0.61,0.36,1)`; gentle spring `cubic-bezier(0.34,1.4,0.64,1)` for toggles/checks. **No looping/decorative animation** (hero is the only exception). Hover: primary buttons darken forest-700→800; cards lift 2px + larger shadow. Press: translate 1px down + scale 0.99.

**Icons:** Material Symbols Rounded (`<span class="material-symbols-rounded">name</span>`). Outline default; `.fill` (FILL 1) = active/selected. Functional only, one per idea. **No emoji, no unicode glyph hacks.**

**Voice & content rules (strict jobs):** sentence case (except UPPERCASE eyebrows); second person ("your conditions", "your plan"); explain *why* in one short clause; the three signal words are sacred; numerals + units are concrete and monospaced (`128 / 82 mmHg`, `A1C 6.4%`); no emoji; no hype.

**Cards:** white surface, radius-xl (28), hairline `sand-200` border, shadow-card. Variants: flat, raised, warm (cream), inverted forest/plum for feature/CTA cards. No colored-left-border cards, no heavy outlines.

---

## EXECUTION ORDER

```
PHASE 1 (blocking, run alone):     JOB 0  — Foundation
PHASE 2 (parallel, after JOB 0):   JOB 1  — Shared UI primitives
                                   JOB 2  — Hero (skin-only)
                                   JOB 3  — Home marketing sections
                                   JOB 4  — Site chrome (Nav/Announce/Footer)
                                   JOB 5  — Marketing pages A (About/Science/News)
                                   JOB 6  — Marketing pages B (Providers/Developers/Contact)
                                   JOB 7  — Auth & legal (Login/Terms/Privacy)
                                   JOB 8  — Survey + Onboarding flow
                                   JOB 9  — App chrome + Home/Profile screens
                                   JOB 10 — App screens (Plan/Recipes/Lookup)
                                   JOB 11 — KitchenSink + final QA / consistency sweep
```

**Parallel-safety rule:** each job edits ONLY the files listed under "Files you own." Shared primitives are owned by **JOB 1** — other jobs **import and consume** them, never re-implement or edit them. If a primitive is wrong for your page, leave a `// DS-TODO(JOB1): …` comment and move on.

---

## JOB 0 — Design Foundation (BLOCKING — run first, alone)

> You are reskinning the `personal-remedies` Vite/React/Tailwind site to the **Remedy Design System**. This job builds the shared token layer that all other jobs depend on. Read THE DS CONTRACT and GLOBAL CONTEXT above in full.
>
> **Files you own (edit/create only these):**
> - `tailwind.config.js`
> - `src/index.css`
> - `src/styles/remedy/` (new folder — copy DS tokens here)
> - `index.html` (only to add the Material Symbols Rounded `<link>` if cleaner there)
>
> **Do:**
> 1. Copy `/Users/bachle/Downloads/Remedy Design System Extracted/tokens/*.css` into `src/styles/remedy/tokens/` and `assets/remedy-mark.svg` into `src/assets/remedy-mark.svg`. Import the token CSS at the top of `src/index.css` (before `@tailwind base`) so the raw `--forest-700`, `--surface-page`, etc. CSS custom properties are available app-wide.
> 2. **Fonts:** replace the Fraunces/Satoshi/Raleway `@import` lines in `src/index.css` with the DS font imports:
>    - `Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500;1,6..72,600`
>    - `Hanken+Grotesk:wght@400;500;600;700;800`
>    - `IBM+Plex+Mono:wght@400;500;600`
>    - Material Symbols Rounded: `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..700,0..1,-25..0`
> 3. **`tailwind.config.js`:** replace the entire `colors` block with the DS palette (forest/plum/honey scales, char neutrals, sand, paper, white, and `signal.beneficial|limit|avoid|info` each with a `DEFAULT` + `tint`). Keep a couple of legacy aliases only if removing them would break the build mid-flight — but prefer mapping old names to new (e.g. `forest.DEFAULT` → `#1E4736`, `cream`→ remove/redirect to `paper`). Set `fontFamily`: `display: ['"Newsreader"', 'ui-serif', 'Georgia', 'serif']`, `sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif']`, `mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']`. Set `borderRadius` (xs6 sm10 md14 lg20 xl28 2xl36 + pill via `9999px`), `boxShadow` (the warm stack: xs/sm/card/md/lg/sheet), `letterSpacing` (`eyebrow: 0.14em`, `tightish: -0.02em`), `transitionTimingFunction` (`ds-out`, `ds-spring`), `transitionDuration` (fast120 base200 slow320).
> 4. **`src/index.css` base layer:** body → `bg-paper-200 text-char-900 font-sans`; `h1–h4` → `font-display font-semibold tracking-[-0.02em] leading-[1.08]`; `::selection` → forest-100 bg / forest-900 text. Add a `.font-mono`/numeric helper for vitals.
> 5. **`src/index.css` component layer — rewrite the pill/tag classes to DS:**
>    - `.pill-forest` → bg-forest-700 text-[#F3EFE6], hover bg-forest-800, press translate-y/scale, radius-pill.
>    - `.pill-plum` → bg-plum-700 text-[#F3EFE6] (replaces amber as the secondary CTA).
>    - `.pill-ghost` → border sand-200, bg-white, text-char-900, hover forest-50 wash.
>    - `.pill-honey` → use sparingly for premium/highlight only.
>    - `.tag` (eyebrow) → 12px uppercase tracking-eyebrow text-char-500.
>    - Add a `.ds-card` helper (white, radius-xl, border sand-200, shadow-card, hover lift) and `.ds-num` (font-mono, tabular-nums) for the other jobs to reuse.
>    - Add `.material-symbols-rounded { font-variation-settings: 'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24 } .material-symbols-rounded.fill{ 'FILL' 1 }`.
> 6. Delete the old `slowPulse` decorative keyframe animation unless still referenced; add nothing decorative/looping (per DS motion rules) — except keep a minimal `pulse` available for the hero job.
>
> **Don't:** touch any component, page, or screen file. Don't introduce cream/orange/blue. Don't leave Fraunces/Satoshi references.
>
> **Acceptance:** `npm run build` passes. Grep shows no remaining `Fraunces`, `Satoshi`, `#F5F2EA`(cream), or `amber` token in `tailwind.config.js`/`index.css`. The four font families + Material Symbols load. CSS custom properties from DS tokens resolve in devtools.

---

## JOB 1 — Shared UI Primitives (strict DS-canon)

> Reskin the reusable component primitives to the Remedy DS. Read THE DS CONTRACT and GLOBAL CONTEXT. JOB 0 is already merged — use the tailwind tokens/classes it defined (`forest-700`, `plum-700`, `signal-*`, `ds-card`, `.pill-*`, `font-display/sans/mono`, radii, shadows). Reference DS implementations in `/Users/bachle/Downloads/Remedy Design System Extracted/components/`.
>
> **Files you own:** `src/components/` — Pill.jsx, PrimaryButton.jsx, SecondaryButton.jsx, Card.jsx, ConditionTag.jsx, SignalChip.jsx, FoodCard.jsx, RecipeCard.jsx, CategoryCard.jsx, StatRing.jsx, EmptyState.jsx, SearchInput.jsx, Stepper.jsx, StepProgress.jsx, DayStrip.jsx, SwipeDeck.jsx, BottomSheet.jsx, PageShell.jsx, Reveal.jsx. (Also delete `Differentiators.jsx.bak`.)
>
> **Do:**
> - **SignalChip** is brand-defining: exactly three tiers `beneficial|limit|avoid` (green/amber/terracotta from `signal-*` tokens), pill, optional glyph (check/dash/cross), `compact` + `label={false}` variants. Mirror `components/remedy/SignalChip.jsx`. **Never** add tiers or recolor.
> - **FoodCard** composes SignalChip: name + one short clinical `note` + signal + optional `meta`/image, tinted-initial fallback (no emoji). Mirror `components/remedy/FoodCard.jsx`.
> - **Buttons/Pill:** map to DS Button variants — `primary` (forest), `plum` (secondary), `secondary` (outline on card), `ghost`, `danger`. Pill radius, darken-on-hover, press translate+scale.
> - **Card:** white, radius-xl, hairline sand-200, shadow-card; support `flat|raised|warm|forest|plum` variants. No colored left borders.
> - **StatRing / progress / DayStrip:** numerals in `font-mono`. Replace any star/0–10 dot rating UI with SignalChip semantics where the component represents food guidance; if it's a generic progress meter keep it but recolor to forest/honey.
> - **Replace all emoji** with Material Symbols Rounded. **BottomSheet** uses upward `shadow-sheet` + light paper blur backdrop. **EmptyState** = calm icon + sentence-case line.
> - Motion: DS durations/easings only; no decorative loops.
>
> **Don't:** edit marketing sections, pages, screens, Nav/Footer/TabBar/FAB/Sidebar (other jobs own those). Don't change component prop signatures unless strictly necessary (pages import these) — if you must, document it at the top of the file.
>
> **Acceptance:** `npm run build` passes. No emoji or hex literals for colors (use tokens). SignalChip renders the three canonical signals. Grep for star/dot-rating remnants returns none in owned files.

---

## JOB 2 — Hero (SKIN-ONLY — special scope)

> Re-skin the homepage hero to the Remedy DS. **Scope is limited:** typography, container/chrome colors, background color, and remodeling some animations. **Preserve the existing content and structure** — including the superfood product-demo and its emoji (out of scope to remove here). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged.
>
> **Files you own:** `src/components/Hero.jsx`, `src/components/TrustStrip.jsx`.
>
> **Do:**
> 1. **Remove the entire WebGL sunset-clouds shader** (the `useEffect` building `gl`, VS/FS strings, canvas, the dark overlay, the cream fade-to-bottom gradient). Replace the background with a **solid forest-900 (`#0F2A21`) surface** (a subtle forest-900→forest-800 vertical solid is fine; **no gradient mesh**). Keep the hero text white-on-dark (`#F3EFE6`) and the eyebrow in honey-600.
> 2. **Typography:** headline → `font-display` Newsreader 500–600, tracking `-0.02em`; italic emphasis spans stay italic (tint them honey-100 or keep white). Subcopy → Hanken Grotesk. Eyebrow → 12px uppercase tracking-eyebrow.
> 3. **Container/chrome recolor:** kill the **blue gradient chrome bar** and blue glow on the app-window mock — recolor to forest/plum/honey (chrome bar = forest-800 with a honey status dot; window glow = warm `rgba(45,36,24,…)` shadow-lg, not blue). Chat user bubbles → forest gradient already close; switch to solid forest-700. Left panel bg → paper/sage (`forest-50`/`paper-100`) not `#E7EEE7` blue-grey; right chat pane → paper-100 not `#ECEFF5`. The hand-drawn underline → honey-600.
> 4. **Remodel animations to DS feel:** keep entrance fades/slide-ups but retune to DS ease-out `cubic-bezier(0.22,0.61,0.36,1)` and DS durations; the hand-drawn underline draw-on may stay (hero exception). Soften/keep the cursor + chat sim but ensure timings feel "quiet and quick," not bouncy.
> 5. The CTA button → `.pill-forest`. The `/10` rating dots in the demo may stay (hero content is preserved) but recolor dots to forest.
>
> **Don't:** restructure the hero, remove the demo, change copy, or touch other components. Don't reintroduce any blue or orange.
>
> **Acceptance:** no WebGL/canvas code remains; no blue/orange anywhere; background is solid forest; fonts are Newsreader/Hanken; `npm run build` passes; hero reads as deep-botanical editorial.

---

## JOB 3 — Home Marketing Sections (strict DS-canon)

> Reskin the homepage content sections to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import primitives from JOB 1 (Card, Button/Pill, SignalChip, FoodCard) rather than re-implementing.
>
> **Files you own:** `src/components/Differentiators.jsx`, `Stats.jsx`, `Nutri.jsx`, `TwoDoors.jsx`, `Pricing.jsx`, `FinalCTA.jsx`, `StudyReferences.jsx`.
>
> **Do:** page bg paper-200; section headers Newsreader serif (sentence case) with honey/forest eyebrows; body Hanken; all numerals/stats in `font-mono` (Stats.jsx especially). Cards = `ds-card`. Replace **all emoji** with Material Symbols Rounded. Replace any food good/bad ratings with `SignalChip` (Beneficial/Limit/Avoid). CTA cards (FinalCTA, Pricing featured tier) = inverted **forest** or **plum** surfaces with white text + honey accents. Pricing: pill buttons, forest primary / plum secondary, no amber. TwoDoors: the two paths styled as forest vs plum cards. Quiet DS motion only (no looping). Voice: calm, second-person, no hype.
>
> **Don't:** touch Hero, Nav, Footer, pages, screens, or JOB 1 primitives.
>
> **Acceptance:** no emoji; no star/dot ratings (SignalChips instead); numerals monospaced; no amber/cream/blue; `npm run build` passes.

---

## JOB 4 — Site Chrome: Nav / AnnouncementBar / Footer (strict)

> Reskin the marketing-site chrome to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged.
>
> **Files you own:** `src/components/Nav.jsx`, `src/components/AnnouncementBar.jsx`, `src/components/Footer.jsx`.
>
> **Do:** Nav → white/paper-100 surface with `shadow-nav` (warm), hairline sand-200 bottom border; logo uses `src/assets/remedy-mark.svg`; links Hanken sentage case; primary CTA = `.pill-forest`. AnnouncementBar → forest-700 or plum-700 bar, white text, honey accent, dismiss icon = Material Symbols. Footer → forest-900 dark surface, `#F3EFE6` text, sage muted links, honey accents, mono for any addresses/numbers, sentence case. Replace emoji/icons with Material Symbols Rounded. DS hover/press states.
>
> **Don't:** touch app chrome (TabBar/FAB/Sidebar — JOB 9), pages, or primitives.
>
> **Acceptance:** logo mark present; no emoji; warm shadows; no blue/amber/cream; `npm run build` passes.

---

## JOB 5 — Marketing Pages A: About / Science / News (strict)

> Reskin these marketing content pages to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import JOB 1 primitives.
>
> **Files you own:** `src/pages/About.jsx`, `src/pages/Science.jsx`, `src/pages/News.jsx`.
>
> **Do:** paper-200 page; Newsreader serif headlines (sentence case) with eyebrows; Hanken body at 16–18px, line-height 1.6 (40+ audience); `ds-card` for content blocks; Science page numerals/stats/citations in `font-mono`, study references as info-signal chips; News as editorial cards. Replace **all emoji** → Material Symbols. Inverted forest/plum CTA bands. Calm voice, no hype.
>
> **Don't:** touch other pages/components.
>
> **Acceptance:** no emoji; monospaced data on Science; no amber/cream/blue; `npm run build` passes.

---

## JOB 6 — Marketing Pages B: Providers / Developers / Contact (strict)

> Reskin these marketing pages to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import JOB 1 primitives.
>
> **Files you own:** `src/pages/Providers.jsx`, `src/pages/Developers.jsx`, `src/pages/Contact.jsx`.
>
> **Do:** same foundations as JOB 5. Developers page: any code blocks / API snippets / keys in `font-mono` on a sunken sand-100 surface; endpoints/badges use info-signal styling, not random colors. Providers: clinical-credible forest/plum cards, mono for any stats. Contact: DS form fields (radius-md, hairline border, 3px forest focus ring) — reuse JOB 1 form primitives if present; sentence-case labels. Replace **all emoji** → Material Symbols.
>
> **Don't:** touch other pages/components.
>
> **Acceptance:** no emoji; mono code/data; DS focus rings on inputs; no amber/cream/blue; `npm run build` passes.

---

## JOB 7 — Auth & Legal: Login / Terms / Privacy (strict)

> Reskin auth + legal pages to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import JOB 1 primitives.
>
> **Files you own:** `src/pages/Login.jsx`, `src/pages/TermsOfUse.jsx`, `src/pages/PrivacyPolicy.jsx`.
>
> **Do:** Login → centered card (`ds-card`, radius-xl) on paper-200, logo mark, DS inputs (radius-md, hairline, forest focus ring), `.pill-forest` submit, plum/ghost secondary, mono for any codes. Terms/Privacy → editorial long-form: Newsreader section headings (sentence case), Hanken body 16–18px line-height 1.65, generous `max-w-prose`, sand-200 hairline dividers, eyebrow section labels. Replace emoji → Material Symbols.
>
> **Don't:** touch other pages/components.
>
> **Acceptance:** legible long-form; DS form styling; no emoji; no amber/cream/blue; `npm run build` passes.

---

## JOB 8 — Survey + Onboarding Flow (strict)

> Reskin the multi-step survey + onboarding to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import JOB 1 primitives (Stepper/StepProgress, SignalChip, ConditionTag, Card).
>
> **Files you own:** `src/pages/Survey.jsx`, `src/components/onboarding/` (index.jsx, StepProgress.jsx, StepConditions.jsx, StepAllergies.jsx, StepMedications.jsx, StepDietary.jsx, StepTaste.jsx, StepDone.jsx).
>
> **Do:** paper-200 surfaces, white `ds-card` step panels, forest progress (radius-pill, mono step counts). **ConditionTag** uses the DS fixed per-condition hues (diabetes=plum, hypertension=steel, heart=garnet…). Selectable options = DS chips/checkbox/radio with spring-settle (no bounce), forest selected state. Replace **all emoji** → Material Symbols Rounded. StepDone = calm forest/plum success surface, no confetti emoji. Second-person sentence-case copy. ≥44px touch targets.
>
> **Don't:** touch app screens, marketing pages, or primitives.
>
> **Acceptance:** no emoji; condition hues consistent; mono step numbers; spring-not-bounce; ≥44px targets; `npm run build` passes.

---

## JOB 9 — App Chrome + Home/Profile Screens (strict)

> Reskin the PWA app chrome and two screens to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import JOB 1 primitives (FoodCard, SignalChip, Card, StatRing). Reference `ui_kits/mobile_app/` and `ui_kits/web_dashboard/` in the DS Extracted folder for exact patterns.
>
> **Files you own:** `src/components/TabBar.jsx`, `src/components/FAB.jsx`, `src/components/Sidebar.jsx`, `src/screens/home/HomeScreen.jsx`, `src/screens/profile/ProfileScreen.jsx`.
>
> **Do:** TabBar → fixed, paper blur backdrop, Material Symbols Rounded icons (FILL 1 = active tab in forest, outline inactive). FAB → forest-700 circle, `shadow-fab` warm, plus-icon. Sidebar (desktop) → forest-900 dark rail, `#F3EFE6` text, sage muted, honey active accent, logo mark. HomeScreen ("Today") → eyebrow `TODAY · <DAY>` (uppercase mono date), Newsreader day heading, FoodCards with SignalChips, vitals in IBM Plex Mono (`128 / 82 mmHg`, `A1C 6.4%`), focus-foods cards. ProfileScreen → conditions via ConditionTag (fixed hues), settings rows, mono numbers. **No emoji anywhere** → Material Symbols. Three-signal vocabulary only.
>
> **Don't:** touch Plan/Recipes/Lookup screens (JOB 10), marketing, or primitives.
>
> **Acceptance:** filled-icon active tabs; mono vitals; SignalChips for food guidance; no emoji; warm shadows; `npm run build` passes.

---

## JOB 10 — App Screens: Plan / Recipes / Lookup (strict)

> Reskin these three PWA screens to the Remedy DS (strict). Read THE DS CONTRACT + GLOBAL CONTEXT. JOB 0 merged; import JOB 1 primitives (FoodCard, RecipeCard, SignalChip, SearchInput, Card, DayStrip). Reference `ui_kits/mobile_app/` patterns.
>
> **Files you own:** `src/screens/plan/PlanScreen.jsx`, `src/screens/recipes/RecipesScreen.jsx`, `src/screens/lookup/LookupScreen.jsx`.
>
> **Do:** PlanScreen → weekly plan with DayStrip (mono dates), meal cards (`ds-card`), per-food SignalChips, "Focus foods this week" forest band. RecipesScreen → editorial recipe cards (Newsreader title, Hanken meta, mono times/servings, tinted-initial fallback, no emoji). LookupScreen → DS SearchInput, results as FoodCards with Beneficial/Limit/Avoid SignalChips tied to the member's conditions, food-detail BottomSheet (warm charcoal ~42% scrim + 2px blur, upward shadow-sheet). Numerals mono; sentence case; **no emoji** → Material Symbols.
>
> **Don't:** touch Home/Profile screens or app chrome (JOB 9), or primitives.
>
> **Acceptance:** SignalChips drive all food guidance; mono data; sheet scrim correct; no emoji; no amber/cream/blue; `npm run build` passes.

---

## JOB 11 — KitchenSink + Final QA / Consistency Sweep (strict)

> Reskin the KitchenSink dev page and run a whole-site consistency pass. Read THE DS CONTRACT + GLOBAL CONTEXT. **Run this LAST**, after JOBS 0–10 merge.
>
> **Files you own:** `src/pages/KitchenSink.jsx` — plus you have **read access to the whole `src/` tree** for the QA sweep; if you must fix a stray issue outside KitchenSink, make the **minimal** change and note it.
>
> **Do:**
> 1. Rebuild KitchenSink as a DS component gallery: show Buttons (all variants), SignalChip (3 tiers), FoodCard, ConditionTag (all condition hues), Cards (flat/raised/warm/forest/plum), inputs with focus rings, Tabs/SegmentedControl, Toast/EmptyState/ProgressBar, the type scale (Newsreader/Hanken/IBM Plex Mono specimens), the color tokens, radii, shadows. Mirror `guidelines/` specimens.
> 2. **QA sweep (report findings + fix trivial ones):** grep the whole `src/` for residual `Fraunces|Satoshi|Raleway`, `#F5F2EA|cream|#E7EEE7|#ECEFF5` (old cream/blue-grey), `amber`, blue gradients, emoji (regex for emoji ranges), and star/0–10/dot rating UIs. Verify every food-guidance surface uses SignalChip's three tiers, numerals use `font-mono`, headings use `font-display`, no pure-black shadows. Produce a short markdown report of anything left for a human (especially anything you flagged `DS-TODO`).
> 3. Confirm `npm run build` passes and `npm run dev` renders home, all marketing pages, onboarding, and all `/app/*` screens without console errors.
>
> **Acceptance:** KitchenSink showcases the DS faithfully; QA report lists zero residual Fraunces/Satoshi/cream/blue/amber/emoji (or itemizes survivors with file:line); build passes.

---

## NOTES & KNOWN TENSIONS (for the human running this)

- **Hero emoji exception:** JOB 2 keeps the hero's product-demo emoji/ratings per your explicit hero scope. If you later want the hero fully DS-canon (no emoji, SignalChips), re-run JOB 2 with the strict rules from JOB 3.
- **Hero background flip:** JOB 2 uses solid **forest-900**. To switch to warm **paper** instead, flip the hero surface to `paper-200` and the hero text from `#F3EFE6`/white to `char-900` ink + forest eyebrows — one localized change.
- **Prop-signature risk:** JOB 1 owns primitive prop shapes. If JOB 1 changes a prop, the consuming page jobs (3,5,6,7,8,9,10) may need a follow-up touch — JOB 11's QA sweep is where that surfaces. Keep JOB 1 prop changes minimal and documented.
- **`Differentiators.jsx.bak`** should be deleted (JOB 1).
- **RecipesScreen** is routed in `App.jsx` but wasn't in the initial file listing — JOB 10 should create/confirm it exists; if missing, build it from the DS recipe patterns.
