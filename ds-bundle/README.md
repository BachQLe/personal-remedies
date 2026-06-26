# Personal Remedies Design System

**Version:** 1.0 · **Updated:** 2025

## Overview

Personal Remedies is a personalized nutrition app that recommends foods based on a user's chronic health conditions — connecting the dots between diet and disease through peer-reviewed research. The product is a mobile-first iOS/Android app with onboarding, a food browser, and a daily picks feed.

**Sources used to build this system:**
- Figma component library (ds-bundle export)
- In-product screenshots and screen recordings
- CSS token file (styles.css)
- HTML component specifications

---

## Visual Foundations

### Color Philosophy
The palette is nature-forward and clinical at the same time — forest greens for growth/benefit, navy for authority/trust, lavender for calm/wellness, and a strong signal system (green/yellow/red/blue) that tells users exactly how each food affects their body.

- **Forest / Lime** (`--forest-700` = `#628C22`) — primary CTAs, active states, success
- **Navy** (`--blue-950` = `#080E30`) — headings, hero backgrounds, data ink
- **Lavender** (`--lavender-300` = `#C8A8E8`) — onboarding panels, form surfaces
- **Yellow** (`--yellow-400` = `#F5CC30`) — accent, caution, breakfast badge
- **Warm neutrals** — charcoal → sand → paper; all neutrals have a warm brown undertone (never cool gray)
- **Signals**: Beneficial (#2F8C5A), Limit (#C98A2E), Avoid (#C04A2F), Info (#3F6E86)

### Typography
Three fonts with distinct roles:
- **Chillax** (`--font-display`) — display, hero headlines, food names. Geometric, slightly quirky, warm.
- **Quantico** (`--font-label`) — all UI labels, eyebrows, navigation, data. Technical, precise, monospaced feel without sacrificing legibility.
- **Switzer** (`--font-sans`) — body copy, chip/tag labels, descriptions. Neutral, clean, highly readable.

No IBM Plex Mono — data numerals use Quantico instead.

### Backgrounds & Surfaces
- Page background: `--paper-200` (#F5F5F0) — warm off-white, never pure white
- Cards: vibrant palette colors (--forest-100, --lavender-100, --blue-100, --yellow-100) — not white or tan
- Dark surfaces: `--blue-950` for hero bars, phone frames, dark cards
- Onboarding panels: `--lavender-300` (scrollable chip panels)

### Corner Radii
- Buttons: `--radius-xs` (6px) — slightly softened square, not fully rounded
- Cards: `--radius-xl` (28px) — generously rounded
- Inner elements (icon bg, chips): `--radius-pill` (999px) for chips; `--radius-md` (14px) for icon containers
- Phone frames: 46px outer / 36px inner

### Shadows
All shadows use a warm charcoal-brown base `rgba(45,36,24,…)` — never pure black. Cards use `--shadow-card`, FABs use `--shadow-lg`, sheets use `--shadow-sheet`.

### Animations & Interactions
- Hover: subtle background darkening (no opacity fade)
- Press: slight scale-down (0.97) on buttons
- Transitions: 150ms ease for color/bg; 200ms ease for transforms
- Bottom sheets: slide up from bottom, backdrop fade
- No aggressive motion — calm, clinical feel

### Iconography
SVG line icons, stroke-width 2–2.5px, rounded linecap/linejoin. Lucide icon style. No emoji in production UI (only in food thumbnails as placeholder). No icon font — raw SVG inline or as components. Navigation icons: Home, Search, Grid, BarChart2, User.

### Cards
- Surface: colored (100-level palette tints) — not white or tan
- Rounding: `--radius-xl` (28px) outer, `--radius-lg` (20px) inner cards
- Shadow: `--shadow-card`
- No border — shadow gives separation
- Inner elements (food icon bg, stat areas): `--sand-100` or transparent tints

### Spacing
4px base grid. Component padding: 16–32px. Section gaps: 16px (sibling cards), 80px (sections). Mobile: 14–18px horizontal padding.

---

## Content Fundamentals

**Voice:** Direct, evidence-forward, reassuring. No jargon. "This food helps with your Type 2 Diabetes — here's the study."

**Tone:** Clinical confidence meets warmth. Like a doctor who also cooks. Not preachy.

**Casing:** 
- Headlines: sentence case (Chillax)
- UI labels / eyebrows: ALL CAPS with letter-spacing (Quantico)
- Body: sentence case (Switzer)
- CTAs: Sentence case ("See my daily picks", not "SEE MY DAILY PICKS")

**Numbers:** Always surfaced prominently — study counts, food counts, nutrient grams, streaks.

**Emoji:** Exclusively for food thumbnails (as placeholders). Never in UI chrome.

**I vs You:** "Your daily picks", "your profile", "most helpful for you" — strongly second-person.

---

## Signal System

The four signals are the core of the product — they must be used consistently:

| Signal | Icon | Color | Use |
|--------|------|-------|-----|
| Beneficial | ✓ | `--benefit-600` / `--benefit-100` | Eat more of this |
| Limit | ! | `--caution-600` / `--caution-100` | Eat in moderation |
| Avoid | ✗ | `--avoid-600` / `--avoid-100` | Do not eat |
| Info | ⓘ | `--info-600` / `--info-100` | Neutral / informational |

---

## File Index

```
styles.css                    ← entry point (import this)
tokens/
  colors.css                  ← all color custom properties
  typography.css              ← font-family + scale tokens
  effects.css                 ← radii, shadows, spacing
  semantic.css                ← semantic aliases
guidelines/                   ← foundation specimen cards
  *.card.html
components/
  buttons/                    ← PrimaryButton, SecondaryButton, PillButton, FAB
  chips/                      ← SignalChip, ConditionTag, FilterTabs, MealTimeBadge
  cards/                      ← FoodCard, CategoryCard, StatRing, StudyCitationCard
  inputs/                     ← SearchInput, StepBar, Toggle, ServingSizeStepper
  feedback/                   ← Toast, EmptyState, AlertBanner, RatingDots
  navigation/                 ← BottomTabBar
  data/                       ← NutrientBar, GroceryChecklistRow
  layout/                     ← ProfileProgressCard, BottomSheet
ui_kits/
  mobile_app/                 ← Interactive app prototype
    index.html
```
