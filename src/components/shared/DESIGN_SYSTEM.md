# Food Image Card — Design System

## Overview

`FoodImageCard` is the universal design system component for displaying food cards across Remedi. It establishes a consistent visual language for recipes, ingredients, and food items.

## Visual Pattern

```
┌─────────────────────┐
│ [Badge] IMAGE    ACTION
│                        │
│                        │
│   (gradient overlay)   │
│                        │
│     NAME              │
│   description text    │
└─────────────────────┘
```

**Key properties:**
- **Aspect ratio:** 4:5 (full-screen on mobile, configurable)
- **Image:** Full-frame background with gradient overlay
- **Badge:** Top-left corner, tier/status indicator
- **Title:** Bottom-left, primary text (name)
- **Subtitle:** Small text below title (ingredients, description, source)
- **Action:** Optional top-right button (favorite, add, etc.)

## Basic Usage

```jsx
import FoodImageCard from '@/components/shared/FoodImageCard.jsx';

<FoodImageCard
  id="recipe-123"
  image="https://example.com/recipe.jpg"
  badge="Top pick"
  title="Grilled Salmon"
  subtitle="Rich in omega-3s, selenium"
  onClick={(id) => navigate(`/recipe/${id}`)}
/>
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | string | required | Unique identifier |
| `image` | string \| React component | required | Image URL or component |
| `imageAlt` | string | `''` | Alt text for image |
| `numericId` | number \| null | optional | Verdict ladder id 1-7 → 3-star / 3-skull row above the title |
| `badge` | string \| `{label, variant?}` | optional | Badge label or object |
| `title` | string | required | Card heading |
| `subtitle` | string | optional | Secondary text (ingredients, source) |
| `aspectRatio` | string | `'4/5'` | CSS aspect-ratio value |
| `onClick` | `(id) => void` | optional | Tap handler |
| `onBadgeClick` | `() => void` | optional | Badge click handler |
| `gradient` | string | `'from-char-900/85 via-char-900/20 to-transparent'` | Tailwind gradient classes |
| `action` | React node \| function | optional | Top-right action button content |
| `actionOnClick` | `() => void` | optional | Action button click handler |
| `loading` | `'lazy'` \| `'eager'` | `'lazy'` | Image loading strategy |
| `className` | string | `''` | Additional Tailwind classes |

## Badge Variants

Badges support three visual variants tied to tier signals:

```jsx
// Primary (default) — white bg, dark text
<FoodImageCard badge="Top pick" {...props} />

// Success — green/benefit color
<FoodImageCard badge={{label: 'Top', variant: 'success'}} {...props} />

// Info — blue color
<FoodImageCard badge={{label: 'Recommended', variant: 'info'}} {...props} />
```

## Action Button

The action button (top-right) is optional and can be any icon/element:

```jsx
import { Heart } from 'lucide-react';

<FoodImageCard
  action={<Heart size={16} className="text-forest-700" />}
  actionOnClick={() => favorite(id)}
  {...props}
/>
```

Or as a custom function:

```jsx
<FoodImageCard
  action={() => (
    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
      <CustomIcon />
    </div>
  )}
  {...props}
/>
```

## Layout Examples

### Recipe Card (Browse)
```jsx
<FoodImageCard
  id={recipe.id}
  image={recipe.photo}
  badge={{label: 'Breakfast', variant: 'info'}}
  title={recipe.title}
  subtitle={recipe.sourceName}
  action={<Calendar size={16} className="text-forest-700" />}
  actionOnClick={() => addToPlanner(recipe)}
  onClick={() => viewRecipe(recipe)}
/>
```

### Ingredient/Food Card
```jsx
<FoodImageCard
  id={food.id}
  image={getTierImage(food.tier)} // or food image
  badge={{label: food.tier, variant: getTierVariant(food.tier)}}
  title={food.name}
  subtitle={`${food.referenceCount} studies`}
  action={<BookmarkPlus size={16} className="text-forest-700" />}
  actionOnClick={() => addToLibrary(food)}
  onClick={() => viewDetails(food)}
/>
```

### Carousel Card (like MealprepCarousel)
```jsx
<FoodImageCard
  id={card.id}
  image={card.image}
  badge={TIER_LABEL[card.tier]}
  title={card.name}
  subtitle={card.blurb}
  onClick={() => navigate('/app/recipes')}
  className="w-full h-full shadow-lg"
/>
```

## Styling

Cards inherit from your design system color tokens:
- **Text:** `text-white` (on dark overlay)
- **Badges:** `text-char-900`, `text-white`, `text-benefit-600`
- **Gradient overlay:** `from-char-900/85 via-char-900/20 to-transparent`

To customize the gradient for a different image/context:

```jsx
<FoodImageCard
  gradient="from-blue-900/90 to-transparent"
  {...props}
/>
```

## Interaction States

- **Hover:** Slight upward lift (`-translate-y-[2px]`), shadow enhancement
- **Active:** Downward press (`translate-y-[1px]`), slight scale reduction
- **Disabled:** (Implement as needed by disabling onClick)

## Migration Guide

### From MealprepCarousel
**Before:**
```jsx
<button className="...shadow-lg...">
  <img src={card.image} className="..." />
  <div className="...gradient..." />
  <div className="...badge...">Top pick</div>
  <div className="...bottom content...">
    <span>{card.name}</span>
    <span>{card.blurb}</span>
  </div>
</button>
```

**After:**
```jsx
<FoodImageCard
  id={card.id}
  image={card.image}
  badge="Top pick"
  title={card.name}
  subtitle={card.blurb}
  onClick={() => navigate('/app/recipes')}
  className="w-full h-full shadow-lg"
/>
```

### Updating other food/recipe cards
Use `FoodImageCard` when you want the full-frame image layout. Keep list-view components (e.g. `RankedRow`) for list-view layouts.

## Accessibility

- Images use `alt` prop (required if `imageAlt` not provided)
- Badges and actions are clickable buttons with proper `aria-label` support
- Keyboard-navigable (native button behavior)
- High contrast on text overlays (white on dark gradient)

## Performance Notes

- Image loading defaults to `lazy` for carousel usage
- Use `loading="eager"` for above-the-fold cards
- CSS transforms used for hover/active states (GPU-accelerated)
- No layout shift on interaction (transforms only)

---

# Carousel Edge Fade

## Pattern

Horizontal carousels use **fading vertical bars** — not a CSS gradient — to create the edge bleed effect. Five thin strips overlay each edge, each 8 px wide with a 2 px gap, stepping down in opacity from ~60 % to 3 %. The strips are offset 4 px outward so they partially sit outside the scroll lane, hiding the hard card edge.

```
opacity: 0.60 | 0.38 | 0.20 | 0.09 | 0.03   →  scroll content
```

## Why bars, not `bg-gradient-to-r`

A CSS gradient fades linearly and tends to look washed out. The stepped bars produce a sharper, more deliberate "scan-line" look that reads as intentional UI chrome rather than a fade artifact.

## Usage

Match `bg-{color}` to the carousel's parent background color.

```jsx
{/* Left edge */}
<div className="absolute inset-y-0 left-0 flex gap-[2px] items-stretch pointer-events-none z-10 -translate-x-[4px]">
  {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
    <div key={i} className="w-[8px] bg-neutral-50" style={{ opacity: op }} />
  ))}
</div>

{/* Right edge */}
<div className="absolute inset-y-0 right-0 flex flex-row-reverse gap-[2px] items-stretch pointer-events-none z-10 translate-x-[4px]">
  {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
    <div key={i} className="w-[8px] bg-neutral-50" style={{ opacity: op }} />
  ))}
</div>
```

## Color reference

| Container bg | Bar color |
|---|---|
| `bg-neutral-50` | `bg-neutral-50` |
| `bg-neutral-100` | `bg-neutral-100` |
| `bg-white` | `bg-white` |

Always match bar color to the surrounding background. Do not use a CSS gradient for carousel edges.

## When to skip the fade

The bars only read as intentional chrome over an empty/solid background. If a rail's cards can run flush to the container edge (e.g. a photo card with no padding, like `FoodImageCard`), translucent bars laid over that photo wash it out and look like a gradient anyway — the exact artifact this pattern exists to avoid. `BestRecipesRails.jsx` (Recipes screen, Meal Planner picker) dropped the edge fade entirely for this reason. Prefer no fade over a fade that lands on photo content.

---

## Future Enhancements

- Video support (bg-video)
- Skeleton loader variant
- Conditional subtitle (overflow handling)
- Custom gradient presets (food, ingredient, recipe)
