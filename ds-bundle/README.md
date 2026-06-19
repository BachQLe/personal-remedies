# Personal Remedies Design System

A health-focused design system for Personal Remedies — a personalized nutrition app that recommends foods based on medical conditions.

## Design Language

- **Warm, organic aesthetic**: cream backgrounds, forest greens, natural tones
- **Typography**: Fraunces (display/serif) + Satoshi (body/sans)
- **Corners**: generous rounding — 24px cards, full-round pills/chips
- **Shadows**: subtle card shadows (`0 2px 14px rgba(0,0,0,0.04)`)
- **Signals**: green (#34A853) = helpful, red (#E5573F) = avoid

## Components

### Buttons
- **PrimaryButton** — full-width rounded pill, forest green background
- **SecondaryButton** — full-width rounded pill, white with hairline border
- **PillButtons** — compact pills in forest/amber/ghost/ghost-dark variants

### Cards
- **Card** — base container with shadow-card and 24px radius
- **FoodCard** — horizontal card with emoji thumbnail, condition tags, signal chip
- **CategoryCard** — vertical card with category icon, label, count
- **StatRing** — SVG donut chart for helpful/avoid food counts

### Chips
- **ConditionTag** — color-coded by condition (diabetes=green, hypertension=blue, etc.)
- **SignalChip** — helpful/avoid/neutral indicator, full or compact
- **RatingDots** — 5-dot scale with numeric rating, used in Nutri recommendations

### Feedback
- **EmptyState** — centered icon + title + body + optional action

### Layout
- **BottomSheet** — iOS-style sheet with drag handle, backdrop, close button
- **HomeScreen** — full app home layout reference
