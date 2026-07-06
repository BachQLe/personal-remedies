/**
 * HomeScreen — containment / ordering / sizing hierarchy.
 *
 * The screen fills exactly one viewport and never scrolls above the fold. Its
 * height is the viewport minus the AppShell's bottom navbar reserve (pb-28 =
 * 7rem), so the content sits flush above the pinned TabBar with no overflow.
 *
 * Two layers:
 *   • Content layer — everything below; one fixed-height vertical column.
 *   • Fixed layer   — the navbar (TabBar), pinned to the viewport bottom in the
 *                     AppShell, rendered above this content.
 *
 * Content layer (top → bottom, outer → inner):
 *   1. Header zone (on base background, ABOVE the shell):
 *        Row 1 — screen label "Home" + round profile avatar button.
 *        Greeting — "Hi there, {firstName}" or "Good morning".
 *   2. Lower shell (full-bleed, own bg, rounded TOP corners only, own inner pad):
 *        2a "Your profile at a glance" — wide full-width button.
 *        2b Food Lookup / Natural Sources — two half-width buttons.
 *        2c Four compact action cards — Meal Planner, Top Dos & Don'ts,
 *           Dietary Guidance, Recipes.
 *        2d Discovery + carousel — taller block, FLEXES to fill the leftover
 *           viewport height. Stacks:
 *             • Discovery banner — first-join only, dismissable → daily picks.
 *             • Mealprep carousel — tallest element, fills remaining height.
 *           Dismiss/return behavior: when the banner is absent the carousel
 *           RISES to fill the freed space.
 *
 * Sizing hierarchy (visual weight, largest → smallest):
 *   carousel → 2d → action cards / 2c → half-width pair / 2b → wide button / 2a → navbar.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Icon from '../../components/shared/Icon.jsx';
import MealprepCarousel from './MealprepCarousel.jsx';
import SearchScreen from '../search/SearchScreen.jsx';
import { storage } from '../../api/storage.js';
import { getConditionNames } from '../../api/api.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [searchActive, setSearchActive] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(true);
  const [conditionNames, setConditionNames] = useState(null);

  // Read once — Home doesn't need to react to profile edits mid-session.
  const [profile] = useState(() => storage.get('profile', null));

  const firstName = typeof profile?.firstName === 'string' ? profile.firstName.trim() : '';

  useEffect(() => {
    let cancelled = false;
    const conditions = profile?.conditions?.length ? profile.conditions : DEFAULT_DEV_CONDITIONS;
    getConditionNames(conditions)
      .then((names) => { if (!cancelled) setConditionNames(names ?? []); })
      .catch(() => { if (!cancelled) setConditionNames([]); });
    return () => { cancelled = true; };
  }, [profile]);

  const conditionSummary =
    conditionNames && conditionNames.length > 0
      ? conditionNames.slice(0, 2).join(', ') +
        (conditionNames.length > 2 ? ` +${conditionNames.length - 2}` : '')
      : null;

  const dismissDiscovery = () => {
    setShowDiscovery(false);
  };

  return (
    // Content layer — a vertical column that fills at least one viewport and may
    // scroll if content is taller. `min-h-screen` ensures the colored background
    // always reaches the bottom; `-mb-28` cancels the AppShell main's pb-28 navbar
    // reserve so the lower shell's own pb-28 becomes the navbar clearance and its
    // paper-100 paints behind the navbar (no base cream ever peeks through).
    <div className="bg-forest-300 flex flex-col min-h-screen -mb-28">
      {/* ── 1. Header zone (above the shell) ──────────────────────────────── */}
      <div className="bg-forest-300 px-5 pt-6 pb-6">
        {/* Screen label + profile icon */}
        <div className="flex items-center justify-between">
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/60">
            Home
          </p>
          <button
            onClick={() => navigate('/app/profile')}
            aria-label="Profile"
            className="w-12 h-12 mt-2 ml-2 flex items-center justify-center rounded-full
              bg-white border border-sand-200 shadow-xs text-char-500
              transition-all duration-fast hover:border-forest-400 hover:text-forest-600 hover:shadow-sm
              active:scale-95"
          >
            <Icon name="user" size={18} />
          </button>
        </div>

        {/* Greeting */}
        <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
          {firstName ? `Hi there, ${firstName}` : 'Good morning'}
        </h1>
      </div>

      {/* In-place search surface (idle ↔ active) — Food Lookup's identity */}
      <SearchScreen
        active={searchActive}
        onClose={() => setSearchActive(false)}
        name={firstName}
      />

      {/* ── 2. Lower shell — full-bleed, rounded top, own bg + inner padding ─ */}
      <div className="bg-paper-100 rounded-t-2xl px-4 pt-4 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col flex-1">
        <div className="flex flex-col gap-3">
          {/* 2a. Profile at a glance — wide full-width button */}
          <button
            onClick={() => navigate('/app/profile')}
            className="w-full flex items-center gap-3.5 text-left rounded-xl border border-lavender-500/40
              bg-lavender-100 shadow-xs px-4 py-3.5
              transition-all duration-base ease-ds-out
              hover:border-lavender-500 hover:shadow-card hover:-translate-y-[1px]
              active:translate-y-[1px] active:scale-[0.99]"
          >
            <span className="w-10 h-10 shrink-0 rounded-lg bg-lavender-500/20 flex items-center justify-center text-lavender-700">
              <Icon name="user" size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display text-base font-semibold text-blue-950 leading-tight">
                Your profile at a glance
              </span>
              {conditionSummary && (
                <span className="block text-xs text-char-500 font-sans mt-0.5 truncate">
                  {conditionSummary}
                </span>
              )}
            </span>
          </button>

          {/* 2b. Food Lookup / Natural Sources — two half-width buttons, distinct identities */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSearchActive(true)}
              className="rounded-xl border border-yellow-500/40 bg-yellow-200 shadow-xs px-3.5 py-3.5 text-left
                transition-all duration-base ease-ds-out
                hover:border-yellow-500 hover:shadow-card hover:-translate-y-[1px]
                active:translate-y-[1px] active:scale-[0.99]"
            >
              <span className="w-9 h-9 rounded-lg bg-white/40 flex items-center justify-center text-yellow-950">
                <Icon name="search" size={18} />
              </span>
              <span className="block font-display text-sm font-semibold text-yellow-950 leading-tight mt-2">
                Food Lookup
              </span>
              <span className="block text-[11px] text-yellow-900/80 font-sans mt-0.5 leading-snug">
                Is this food good for me?
              </span>
            </button>

            <button
              disabled
              aria-disabled="true"
              className="rounded-xl border border-blue-500/30 bg-blue-200 shadow-xs px-3.5 py-3.5 text-left
                opacity-60 cursor-not-allowed"
            >
              <span className="w-9 h-9 rounded-lg bg-white/40 flex items-center justify-center text-blue-900">
                <Icon name="leaf" size={18} />
              </span>
              <span className="block font-display text-sm font-semibold text-blue-900 leading-tight mt-2">
                Natural Sources
              </span>
              <span className="block text-[11px] text-blue-900/70 font-sans mt-0.5 leading-snug">
                Coming soon
              </span>
            </button>
          </div>

          {/* 2c. Four compact action cards — fixed-height rows, 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/app/plan')}
              className="h-[72px] flex items-center gap-3 text-left rounded-xl border border-sand-200
                bg-white shadow-xs px-3.5
                transition-all duration-fast ease-ds-out
                hover:border-forest-400 hover:shadow-card active:scale-[0.99]"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-forest-100 flex items-center justify-center text-forest-700">
                <Icon name="calendar" size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-sm font-semibold text-char-900 leading-tight">
                  Meal Planner
                </span>
              </span>
            </button>

            <button
              onClick={() => navigate('/app/top')}
              className="h-[72px] flex items-center gap-3 text-left rounded-xl border border-sand-200
                bg-white shadow-xs px-3.5
                transition-all duration-fast ease-ds-out
                hover:border-forest-400 hover:shadow-card active:scale-[0.99]"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-forest-100 flex items-center justify-center text-forest-700">
                <Icon name="scale" size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-sm font-semibold text-char-900 leading-tight">
                  Top Dos &amp; Don'ts
                </span>
              </span>
            </button>

            <button
              onClick={() => navigate('/app/suggestions')}
              className="h-[72px] flex items-center gap-3 text-left rounded-xl border border-sand-200
                bg-white shadow-xs px-3.5
                transition-all duration-fast ease-ds-out
                hover:border-forest-400 hover:shadow-card active:scale-[0.99]"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-forest-100 flex items-center justify-center text-forest-700">
                <Icon name="clipboard-list" size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-sm font-semibold text-char-900 leading-tight truncate">
                  Dietary Guidance
                </span>
                <span className="block text-[10.5px] text-char-500 leading-snug truncate">
                  Best/worst foods, by group
                </span>
              </span>
            </button>

            <button
              onClick={() => navigate('/app/recipes')}
              className="h-[72px] flex items-center gap-3 text-left rounded-xl border border-sand-200
                bg-white shadow-xs px-3.5
                transition-all duration-fast ease-ds-out
                hover:border-forest-400 hover:shadow-card active:scale-[0.99]"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-forest-100 flex items-center justify-center text-forest-700">
                <Icon name="utensils" size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-sm font-semibold text-char-900 leading-tight truncate">
                  Recipes
                </span>
                <span className="block text-[10.5px] text-char-500 leading-snug truncate">
                  Condition-approved dishes
                </span>
              </span>
            </button>
          </div>

          {/* 2d. Discovery + carousel — sizes to its content; the carousel's
              3:4 cards drive the height (page scrolls if it exceeds the viewport). */}
          <div className="bg-neutral-00 rounded-xl border border-neutral-300/50 shadow-xs p-3 flex flex-col gap-3">
            {/* Discovery banner — first-join only, dismissable → daily picks */}
            {showDiscovery && (
              <div className="relative shrink-0">
                <button
                  onClick={() => navigate('/onboarding/daily-picks')}
                  className="w-full text-left rounded-lg bg-blue-950 text-white
                    px-4 py-3 pr-10 shadow-md
                    transition-all duration-base ease-ds-out
                    hover:bg-blue-900 hover:-translate-y-[1px] active:translate-y-[1px]"
                >
                  <span className="block font-display text-base font-semibold leading-snug">
                    Discover your Daily Picks
                  </span>
                  <span className="block text-xs text-white/70 font-sans leading-snug mt-0.5">
                    Today's foods chosen for your profile — tap to see what's good
                    for you right now.
                  </span>
                </button>
                <button
                  onClick={dismissDiscovery}
                  aria-label="Dismiss"
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center
                    rounded-full text-white/70 hover:text-white hover:bg-white/10
                    transition-colors duration-fast"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Mealprep carousel — its 3:4 cards set its own height */}
            <div>
              <MealprepCarousel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
