/**
 * HomeScreen — containment / ordering / sizing hierarchy.
 *
 * The screen targets exactly one viewport and doesn't scroll at default text
 * size. Its height is the viewport minus the AppShell's bottom navbar reserve
 * (pb-28 = 7rem), so the content sits flush above the pinned TabBar with no
 * overflow. At larger root font sizes (Dynamic Type / browser zoom), the
 * natural-height rows (2a/2b/2c) grow and can exceed that budget — rather
 * than clip that content, the root allows vertical scroll (`overflow-y-auto`)
 * so it stays reachable; see the comment on the root div below.
 *
 * Two layers:
 *   • Content layer — everything below; one fixed-height vertical column.
 *   • Fixed layer   — the navbar (TabBar), pinned to the viewport bottom in the
 *                     AppShell, rendered above this content.
 *
 * Content layer (top → bottom, outer → inner):
 *   1. Header zone (on base background, ABOVE the shell):
 *        Row 1 — screen label "Home" only (profile now lives on the TabBar).
 *        Greeting — "Hi there, {firstName}" or "Good morning".
 *   2. Lower shell (full-bleed, own bg, rounded TOP corners only, own inner pad):
 *        2a "Meal Planner" — wide full-width forest-tinted button, the primary
 *           destination and the largest entry tile → /app/plan.
 *        2b/2c Two half-width tiles side by side, together exactly as tall as
 *           2a (they share the TILE_H min-height token):
 *             2b "Best & Worst Choices" — lavender → /app/suggestions.
 *             2c "Food & Nutrient Lookup" — yellow → /app/search.
 *           Both stack icon-over-text, since the columns are narrow.
 *        2d Carousel — taller block, FLEXES to fill the leftover viewport
 *           height. Mealprep carousel is the tallest element on screen and
 *           fills all remaining height on its own; there is no longer
 *           anything stacked above it here.
 *
 * Sizing hierarchy (visual weight, largest → smallest):
 *   carousel → 2a "Meal Planner" (wide top button) → 2b/2c tiles (equal to each
 *   other, same height as 2a but half its width) → navbar.
 *
 * Note: the news/alerts banner (content-driven via src/api/messages.js
 * `getActiveMessages`/`dismissMessage`) was removed from this screen. Those
 * APIs and public/messages.json are left in place but currently have no
 * mount point anywhere in the app.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/shared/Icon.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import MealprepCarousel from './MealprepCarousel.jsx';
import { storage } from '../../api/storage.js';

// Shared height for the three entry tiles: the wide Meal Planner button (2a) and
// the two-up row under it (2b/2c) all use this, which is what makes the row exactly
// as tall as the button above it.
const TILE_H = 'min-h-[6rem]';

export default function HomeScreen() {
  const navigate = useNavigate();

  // Read once — Home doesn't need to react to profile edits mid-session.
  const [profile] = useState(() => storage.get('profile', null));

  const firstName = typeof profile?.firstName === 'string' ? profile.firstName.trim() : '';

  return (
    // Content layer — a vertical column sized to exactly one viewport (`h-[100dvh]`;
    // this fixed height, not `overflow-hidden`, is what keeps the colored background
    // reaching the bottom at default text size). `-mb-28` cancels the AppShell main's
    // pb-28 navbar reserve so the lower shell's own pb-28 becomes the navbar
    // clearance and its paper-100 paints behind the navbar (no base cream ever peeks
    // through) — this margin is load-bearing, don't remove it.
    //
    // `overflow-y-auto` (not `overflow-hidden`): at default text size content fits
    // inside the fixed 100dvh box exactly as designed, so this is a no-op — no
    // scrollbar, identical look. At larger root font sizes the natural-height rows
    // above the carousel (2a/2b/2c) grow past that budget; instead of clipping them
    // (unreachable content behind the TabBar — a real Dynamic Type bug, see
    // docs/a11y-checklist.md §4), the box now scrolls internally to reveal them.
    // `overflow-x-hidden` guards against any incidental horizontal scroll from that
    // growth; nothing in this layout is meant to scroll sideways.
    <div className="bg-forest-300 flex flex-col h-[100dvh] overflow-y-auto overflow-x-hidden -mb-28">
      {/* ── 1. Header zone (above the shell) ──────────────────────────────── */}
      <PageHeader
        label="Home"
        title={firstName ? `Hi there, ${firstName}` : 'Good morning'}
        className="bg-forest-300 pb-8"
      />

      {/* ── 2. Lower shell — full-bleed, rounded top, own bg + inner padding ─ */}
      <div className="bg-paper-100 rounded-t-2xl px-5 pt-4 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col flex-1 min-h-0">
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* 2a. Meal Planner — wide full-width button, the primary destination
              and the tallest of the entry tiles. TILE_H is shared with the 2b/2c
              row below so the row matches this button's height exactly; it's a
              min-height (not a fixed height) so both keep growing together under
              Dynamic Type instead of clipping. */}
          <button
            onClick={() => navigate('/app/plan')}
            className={`w-full flex items-center gap-3.5 text-left rounded-xl border border-forest-500/40
              bg-forest-100 shadow-xs px-4 py-3 ${TILE_H}
              transition-all duration-base ease-ds-out
              hover:border-forest-500 hover:shadow-card hover:-translate-y-[1px]
              active:translate-y-[1px] active:scale-[0.99]`}
          >
            <span className="w-11 h-11 shrink-0 rounded-lg bg-forest-500/20 flex items-center justify-center text-forest-700">
              <Icon name="calendar" size={22} aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display text-xl font-semibold text-blue-950 leading-tight">
                Meal Planner
              </span>
              <span className="text-xs text-char-500 font-sans mt-0.5 line-clamp-2">
                Queue &amp; saved recipes
              </span>
            </span>
          </button>

          {/* 2b/2c. Two half-width tiles side by side, same height as 2a (TILE_H).
              Narrow columns, so these stack icon-over-text instead of the wide
              tile's icon-beside-text. */}
          <div className="grid grid-cols-2 gap-2 items-stretch">
            {/* 2b. Best & Worst Choices */}
            <button
              onClick={() => navigate('/app/suggestions')}
              className={`w-full h-full flex flex-col items-start text-left rounded-xl border border-lavender-500/40
                bg-lavender-100 shadow-xs px-3.5 py-2.5 ${TILE_H}
                transition-all duration-base ease-ds-out
                hover:border-lavender-500 hover:shadow-card hover:-translate-y-[1px]
                active:translate-y-[1px] active:scale-[0.99]`}
            >
              <span className="w-7 h-7 shrink-0 rounded-lg bg-lavender-500/20 flex items-center justify-center text-lavender-700">
                <Icon name="clipboard-list" size={16} aria-hidden="true" />
              </span>
              <span className="block font-display text-lg font-semibold text-blue-950 leading-tight tracking-tight mt-1 line-clamp-2">
                Best &amp; Worst Choices
              </span>
              <span className="text-[10px] text-char-500 font-sans mt-0.5 line-clamp-1 leading-tight">
                Top Dos &amp; Don&apos;ts, food groups &amp; best recipes
              </span>
            </button>

            {/* 2c. Food & Nutrient Lookup */}
            <button
              onClick={() => navigate('/app/search')}
              className={`w-full h-full flex flex-col items-start text-left rounded-xl border border-yellow-500/40
                bg-yellow-200 shadow-xs px-3.5 py-2.5 ${TILE_H}
                transition-all duration-base ease-ds-out
                hover:border-yellow-500 hover:shadow-card hover:-translate-y-[1px]
                active:translate-y-[1px] active:scale-[0.99]`}
            >
              <span className="w-7 h-7 shrink-0 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-950">
                <Icon name="search" size={16} aria-hidden="true" />
              </span>
              <span className="block font-display text-xl font-semibold text-yellow-950 leading-tight tracking-tight mt-1 line-clamp-2">
                Food &amp; Nutrient Lookup
              </span>
              <span className="text-[10px] text-char-500 font-sans mt-0.5 line-clamp-1 leading-tight">
                Foods, recipes, nutrients &amp; herbal supplements
              </span>
            </button>
          </div>

          {/* 2d. Carousel — flexes to fill the leftover viewport height;
              its 3:4 portrait cards size themselves to that height (width
              follows from the aspect), so the block never over/underflows. */}
          <div className="bg-neutral-00 rounded-xl border border-neutral-300/50 shadow-xs p-1 flex flex-1 min-h-0">
            {/* Mealprep carousel — fills the leftover height; its 3:4 portrait
                cards derive their size from that height */}
            <div className="flex-1 min-h-0">
              <MealprepCarousel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
