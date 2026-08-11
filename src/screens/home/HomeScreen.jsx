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
 *        Row 1 — screen label "Home" only (profile now lives on the TabBar).
 *        Greeting — "Hi there, {firstName}" or "Good morning".
 *   2. Lower shell (full-bleed, own bg, rounded TOP corners only, own inner pad):
 *        2a "Dietary Guidance" — wide full-width lavender button → /app/suggestions.
 *        2b "Meal Planner" — wide full-width forest-tinted card → /app/plan.
 *        2c Food Lookup / Natural Sources — two half-width buttons, both live.
 *        2d News + carousel — taller block, FLEXES to fill the leftover
 *           viewport height. Stacks:
 *             • News banner — content-driven (src/api/messages.js
 *               `getActiveMessages`), dismissable, persists dismissal via
 *               `dismissMessage`. Renders nothing when there are no active,
 *               non-dismissed messages. Navigation is fixed (→ best recipes)
 *               regardless of which message is showing — messages.json
 *               carries no per-message nav target.
 *             • Mealprep carousel — tallest element, fills remaining height.
 *           Dismiss/return behavior: when the banner is absent the carousel
 *           RISES to fill the freed space.
 *
 * Sizing hierarchy (visual weight, largest → smallest):
 *   carousel → 2a "Dietary Guidance" (tallest button) → 2d → 2b "Meal Planner"
 *   → 2c half-width pair (compact rows) → navbar.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Icon from '../../components/shared/Icon.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import MealprepCarousel from './MealprepCarousel.jsx';
import { storage } from '../../api/storage.js';
import { getActiveMessages, dismissMessage } from '../../api/messages.js';

export default function HomeScreen() {
  const navigate = useNavigate();

  // Active, non-dismissed news messages (src/api/messages.js — master plan
  // §4.7). Only the first is ever shown — this slot is a single banner
  // surface, not a stack — so a second messages.json entry (e.g. the
  // placeholder-plus-announcement seed row) simply waits its turn. Starts
  // `null` (not `[]`) so the banner renders nothing during the initial fetch
  // rather than flashing empty-then-populated.
  const [messages, setMessages] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getActiveMessages().then((active) => {
      if (!cancelled) setMessages(active);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const banner = messages?.[0] ?? null;

  // Read once — Home doesn't need to react to profile edits mid-session.
  const [profile] = useState(() => storage.get('profile', null));

  const firstName = typeof profile?.firstName === 'string' ? profile.firstName.trim() : '';

  const dismissBanner = () => {
    if (!banner) return;
    dismissMessage(banner.id);
    setMessages((prev) => (prev ?? []).filter((m) => m.id !== banner.id));
  };

  return (
    // Content layer — a vertical column locked to exactly one viewport; never
    // scrolls. `h-[100dvh] overflow-hidden` ensures the colored background always
    // reaches the bottom and content never overflows; `-mb-28` cancels the
    // AppShell main's pb-28 navbar reserve so the lower shell's own pb-28 becomes
    // the navbar clearance and its paper-100 paints behind the navbar (no base
    // cream ever peeks through).
    <div className="bg-forest-300 flex flex-col h-[100dvh] overflow-hidden -mb-28">
      {/* ── 1. Header zone (above the shell) ──────────────────────────────── */}
      <PageHeader
        label="Home"
        title={firstName ? `Hi there, ${firstName}` : 'Good morning'}
        className="bg-forest-300 pb-8"
      />

      {/* ── 2. Lower shell — full-bleed, rounded top, own bg + inner padding ─ */}
      <div className="bg-paper-100 rounded-t-2xl px-4 pt-2 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col flex-1 min-h-0">
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {/* 2a. Dietary Guidance — wide full-width button, tallest on screen */}
          <button
            onClick={() => navigate('/app/suggestions')}
            className="w-full flex items-center gap-3.5 text-left rounded-xl border border-lavender-500/40
              bg-lavender-100 shadow-xs px-4 py-6
              transition-all duration-base ease-ds-out
              hover:border-lavender-500 hover:shadow-card hover:-translate-y-[1px]
              active:translate-y-[1px] active:scale-[0.99]"
          >
            <span className="w-12 h-12 shrink-0 rounded-lg bg-lavender-500/20 flex items-center justify-center text-lavender-700">
              <Icon name="clipboard-list" size={22} aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display text-lg font-semibold text-blue-950 leading-tight">
                Dietary Guidance
              </span>
              <span className="block text-xs text-char-500 font-sans mt-0.5 truncate">
                Top Dos &amp; Don&apos;ts, best recipes &amp; foods for you
              </span>
            </span>
          </button>

          {/* 2b. Meal Planner — wide full-width card, forest tint */}
          <button
            onClick={() => navigate('/app/plan')}
            className="w-full flex items-center gap-3.5 text-left rounded-xl border border-forest-500/40
              bg-forest-100 shadow-xs px-4 py-3
              transition-all duration-base ease-ds-out
              hover:border-forest-500 hover:shadow-card hover:-translate-y-[1px]
              active:translate-y-[1px] active:scale-[0.99]"
          >
            <span className="w-10 h-10 shrink-0 rounded-lg bg-forest-500/20 flex items-center justify-center text-forest-700">
              <Icon name="calendar" size={20} aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display text-base font-semibold text-blue-950 leading-tight">
                Meal Planner
              </span>
              <span className="block text-xs text-char-500 font-sans mt-0.5 truncate">
                Queue &amp; saved recipes
              </span>
            </span>
          </button>

          {/* 2c. Food Lookup / Natural Sources — two half-width compact rows, distinct identities */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/app/search')}
              className="flex items-center gap-2.5 rounded-xl border border-yellow-500/40 bg-yellow-200 shadow-xs px-3.5 py-2.5 text-left
                transition-all duration-base ease-ds-out
                hover:border-yellow-500 hover:shadow-card hover:-translate-y-[1px]
                active:translate-y-[1px] active:scale-[0.99]"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-white/40 flex items-center justify-center text-yellow-950">
                <Icon name="search" size={18} aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-[15px] font-semibold text-yellow-950 leading-tight">
                  Food Lookup
                </span>
              </span>
            </button>

            <button
              onClick={() => navigate('/app/search?mode=natural')}
              className="flex items-center gap-2.5 rounded-xl border border-blue-500/30 bg-blue-200 shadow-xs px-3.5 py-2.5 text-left
                transition-all duration-base ease-ds-out
                hover:border-blue-500 hover:shadow-card hover:-translate-y-[1px]
                active:translate-y-[1px] active:scale-[0.99]"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-white/40 flex items-center justify-center text-blue-900">
                <Icon name="leaf" size={18} aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-[15px] font-semibold text-blue-900 leading-tight">
                  Natural Sources Lookup
                </span>
              </span>
            </button>
          </div>

          {/* 2d. News + carousel — flexes to fill the leftover viewport
              height; the carousel absorbs whatever height the banner leaves,
              and its 3:4 portrait cards size themselves to that height (width
              follows from the aspect), so the block never over/underflows. */}
          <div className="bg-neutral-00 rounded-xl border border-neutral-300/50 shadow-xs p-1 flex flex-col gap-1.5 flex-1 min-h-0">
            {/* News banner — content from messages.json via getActiveMessages
                (master plan §4.7); renders nothing while loading or when
                there's no active, non-dismissed message. Navigation is fixed
                (→ best recipes), independent of which message is showing. */}
            {banner && (
              <div className="relative shrink-0">
                <button
                  onClick={() => navigate('/app/suggestions?tab=recipes')}
                  className="w-full text-left rounded-lg bg-blue-950 text-white
                    px-4 py-2.5 pr-10 shadow-md
                    transition-all duration-base ease-ds-out
                    hover:bg-blue-900 hover:-translate-y-[1px] active:translate-y-[1px]"
                >
                  <span className="block font-display text-base font-semibold leading-snug">
                    {banner.title}
                  </span>
                  <span className="block text-xs text-white/70 font-sans leading-snug mt-0.5">
                    {banner.body}
                  </span>
                </button>
                <button
                  onClick={dismissBanner}
                  aria-label="Dismiss"
                  className="tap-target absolute top-2 right-2 w-7 h-7 flex items-center justify-center
                    rounded-full text-white/70 hover:text-white hover:bg-white/10
                    transition-colors duration-fast"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}

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
