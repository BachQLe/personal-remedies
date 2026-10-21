import { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import TopDosTab from './TopDosTab.jsx';
import RequireEntitlement from '../../components/shared/RequireEntitlement.jsx';
import FoodGroupsTab from './FoodGroupsTab.jsx';
import { RecipesBrowser } from '../recipes/RecipesScreen.jsx';

// ── Constants ────────────────────────────────────────────────────────────────

// Screen-level title + description per tab, crossfaded in the shared
// PageHeader (replaces the per-tab <h1> each tab used to render itself).
//
// Food Groups (TAB_META.groups) covers BOTH the coarse 10-group browse and
// the 17 fine-group browse — basic and fine are two zoom levels of the same
// idea, not separate tabs. See FoodGroupsTab.jsx's docblock for the full
// reasoning. There is deliberately no TAB_META entry for 'suggest': it was a
// short-lived 4th top-level pill (Wave 2) that crowded the strip at phone
// width and forced "Dos & Don'ts" to be shortened just to make room; it has
// been folded into Food Groups' inner mode toggle instead. resolveTab()
// below still matches ?tab=suggest as a backward-compatible alias (resolving
// to 'groups'; FoodGroupsTab's own resolveMode() puts it in 'fine' mode) so
// any link shipped during that window keeps landing somewhere correct.
const TAB_META = {
  top: {
    title: "Top Dos & Don'ts",
  },
  groups: {
    title: 'Food Groups',
  },
  recipes: {
    title: 'Recipes',
  },
};

// Resolves the active tab from the URL: ?tab=recipes / ?tab=groups win
// outright; the retired ?tab=suggest aliases to 'groups' (see TAB_META's
// docblock above — FoodGroupsTab resolves the fine-mode half of that alias
// itself); anything else (including the legacy ?tab=bestworst) lands on Top
// Dos & Don'ts, the default.
function resolveTab(searchParams) {
  const tab = searchParams.get('tab');
  if (tab === 'recipes') return 'recipes';
  if (tab === 'groups') return 'groups';
  if (tab === 'suggest') return 'groups';
  return 'top';
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SuggestionsScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFood, setSelectedFood] = useState(null);

  // The active tab lives in the URL (checklist 4.10): a tab switch REPLACES the
  // current history entry (no new entry per tab), so Back from a group detail
  // screen returns to the exact tab the user was on.
  const activeTab = resolveTab(searchParams);
  const setActiveTab = (tab) => {
    if (tab !== activeTab) setSearchParams({ tab }, { replace: true });
  };

  // Back to 3 pills: the Wave 2 "Suggest" pill (the 17 fine food groups) now
  // lives as an inner mode toggle inside Food Groups (FoodGroupsTab) rather
  // than as a sibling top-level tab — it was the reason "Dos & Don'ts" had
  // to be shortened to "Do / Don't" to fit a crowded 4th pill. With only 3
  // pills the full label fits again with room to spare.
  const TAB_OPTIONS = [
    { key: 'top', label: "Dos & Don'ts" },
    { key: 'groups', label: 'Food Groups' },
    { key: 'recipes', label: 'Recipes' },
  ];

  // Legacy deep link: ?category=<coarseGroupId> used to open the Food Groups
  // tab with that group's detail panel expanded inline. Food group detail
  // now lives at its own route, so redirect there instead. Checked after all
  // hooks above so the hook call order never changes across renders.
  const category = searchParams.get('category');
  if (category) {
    return <Navigate to={'/app/suggestions/group/' + category} replace />;
  }

  return (
    // -mb-28 cancels the AppShell main's pb-28 navbar reserve so the
    // background reaches behind the floating TabBar (appshell-cream-fix
    // pattern); the shell's own pb-28 keeps the last row clear of the bar.
    <div className="bg-forest-300 flex flex-col -mb-28" style={{ minHeight: '100dvh' }}>

      <PageHeader label="Best & Worst Choices" className="pb-6">
        {/* Title crossfade between tabs — min-height keeps the slider from
            jumping while the title swaps. */}
        <div className="min-h-[44px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
            >
              <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
                {TAB_META[activeTab].title}
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="text-[11px] text-blue-950/60 font-sans mt-1">
          Ask your doctor before changing your diet, especially if you take medication.
        </p>
      </PageHeader>

      {/* Tab content — solid paper shell, the same container HomeScreen uses
          under its header: full-bleed (no side inset), rounded top corners
          only, own background + inner padding, and a soft upward shadow that
          lifts it off the green page. Its pb-28 both clears the floating
          TabBar and paints paper behind it (appshell-cream-fix). Shared by all
          three tabs so the panel doesn't change shape when you switch. */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-5 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col">
        {/* Tab switcher — shared PillSwitcher slider (same as Search). Lives
            inside the shell rather than the header so the paper container
            wraps the tab strip too, and the strip stays put while only the
            tab body below it crossfades. */}
        <div className="mb-4">
          <PillSwitcher options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
          >
            {activeTab === 'top' ? (
              <RequireEntitlement feature="top_dos_donts" variant="inline"><TopDosTab onSelectFood={setSelectedFood} /></RequireEntitlement>
            ) : activeTab === 'groups' ? (
              <FoodGroupsTab />
            ) : (
              // Same recipe browser as /app/recipes — one recipes page, two entry points.
              <RecipesBrowser />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Food detail card (self-loads facts + assessment from the id/name).
          Rendered unconditionally (not gated behind `{selectedFood && ...}`)
          so FoodDetailCard stays mounted through its own close animation —
          a gating wrapper here would unmount it the instant `onClose` fires,
          before it gets a chance to animate out. */}
      <FoodDetailCard
        item={selectedFood ? { foodId: selectedFood.id, name: selectedFood.name } : null}
        open={!!selectedFood}
        onClose={() => setSelectedFood(null)}
      />
    </div>
  );
}
