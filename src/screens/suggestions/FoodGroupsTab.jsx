/**
 * FoodGroupsTab — wrapper for the Food Groups tab's inner "basic/fine" mode
 * toggle. Owns the mode state, the PillSwitcher that drives it, and the
 * subtitle line that explains whichever mode is active, then renders the
 * matching list (GroupsTab for 'basic', SuggestTab for 'fine') beneath.
 *
 * Why basic and fine share ONE tab instead of being sibling tabs: coarse
 * food groups (GroupsTab, 10 broad buckets like "Meat, Fish & Poultry") and
 * fine food groups (SuggestTab, the 17 narrower groups bucketed under those
 * same coarse families, e.g. "Fish & Seafood" on its own) are the same kind
 * of thing — a food-group browse list — at two different zoom levels, not
 * two different jobs. They were briefly shipped as a crowded 4th top-level
 * pill ("Suggest") alongside Food Groups, which forced "Dos & Don'ts" to be
 * shortened to "Do / Don't" just to make 4 pills fit at phone width. Folding
 * fine groups into Food Groups as an inner toggle — the same PillSwitcher
 * pattern TopDosTab already uses for its Do/Don't toggle — fixes the
 * crowding AND is the more honest information architecture: a user zooming
 * from "broad look" to "find a swap" is still in Food Groups, not switching
 * to a different feature.
 *
 * GroupsTab and SuggestTab keep their own data fetching, loading skeletons,
 * and graceful label-failure degrades exactly as before — this wrapper only
 * decides which of the two mounts and owns the chrome (toggle + subtitle)
 * that used to be duplicated at each tab's own top.
 *
 * Mode lives in the URL, like SuggestionsScreen's tab (checklist 4.10): it is
 * read from ?mode=fine / ?mode=basic (default 'basic'; the retired
 * ?tab=suggest aliases to 'fine' so old links from the short-lived 4th-pill
 * era keep landing on the right list), and a toggle tap REPLACES the current
 * history entry, so Back from a group detail screen returns to the mode the
 * user was in.
 */
import { useSearchParams } from 'react-router-dom';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import GroupsTab from './GroupsTab.jsx';
import SuggestTab from './SuggestTab.jsx';

const MODE_OPTIONS = [
  { key: 'basic', label: 'Basic groups', tone: 'neutral' },
  { key: 'fine', label: 'Fine groups', tone: 'neutral' },
];

const SUBTITLE = {
  basic: 'Ten broad categories, good for an everyday look.',
  fine: 'Narrower groups, good for finding a swap for a food.',
};

// Exported for the mode-resolution/deep-link tests. ?tab=suggest is the
// retired Wave 2 4th-pill alias (see this file's docblock) — it always wins
// as 'fine' regardless of any ?mode also present, since it's a link minted
// before 'mode' existed at all. Otherwise ?mode=fine is the only way to land
// in 'fine'; anything else (including no mode param) is 'basic'.
// eslint-disable-next-line react-refresh/only-export-components
export function resolveMode(searchParams) {
  if (searchParams.get('tab') === 'suggest') return 'fine';
  return searchParams.get('mode') === 'fine' ? 'fine' : 'basic';
}

export default function FoodGroupsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = resolveMode(searchParams);
  const setMode = (next) => {
    if (next !== mode) setSearchParams({ tab: 'groups', mode: next }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <PillSwitcher options={MODE_OPTIONS} value={mode} onChange={setMode} size="sm" variant="outline" />

      <p className="text-sm text-blue-950/70 font-sans">{SUBTITLE[mode]}</p>

      {mode === 'fine' ? <SuggestTab /> : <GroupsTab />}
    </div>
  );
}
