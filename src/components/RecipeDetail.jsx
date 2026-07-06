/**
 * RecipeDetail — context-aware recipe detail (bottom sheet).
 *
 * Shared by the Recipes screen and the Home search surface so a recipe row
 * opens the same rich card everywhere. Shows hero photo, title/source, the
 * profile-match banner, and a per-ingredient breakdown with expandable studies.
 *
 * Props:
 *   recipe  — Recipe object (title, photo, sourceName, matchedConditions, ingredients)
 *   profile — Profile (to highlight matched conditions + fetch references)
 *   onClose — dismiss callback
 */
import { useState, useEffect } from 'react';
import { api } from '../api/api.js';
import BottomSheet from './shared/BottomSheet.jsx';
import ConditionTag from './shared/ConditionTag.jsx';
import SignalChip from './shared/SignalChip.jsx';
import StudyReferences from './shared/StudyReferences.jsx';
import Icon from './shared/Icon.jsx';

// Per-ingredient accordion row inside the detail sheet
// `profileConditionNames` — the profile's healthConditionIDs already resolved
// to display-name strings (see RecipeDetail below), so we can compare like
// with like against `matchedConditions` (also display names).
function IngredientRow({ ingredient, profileConditionNames }) {
  const [refs, setRefs] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const relevantConditions = ingredient.matchedConditions.filter((c) => profileConditionNames.includes(c));
  const displayConditions = relevantConditions.length ? relevantConditions : ingredient.matchedConditions;

  async function handleExpand() {
    if (!expanded && refs === undefined && displayConditions.length > 0) {
      setLoading(true);
      const r = await api.getIngredientReferences(ingredient.name, displayConditions[0]);
      setRefs(r);
      setLoading(false);
    }
    setExpanded((o) => !o);
  }

  const isBeneficial = ingredient.signal === 'beneficial';

  return (
    <div className={`rounded-xl p-3.5 ${isBeneficial ? 'bg-signal-beneficial-tint' : 'bg-sand-100'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-char-900 font-sans">{ingredient.name}</span>
            <SignalChip signal={ingredient.signal} compact />
          </div>
          {displayConditions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {displayConditions.slice(0, 2).map((c) => (
                <ConditionTag key={c} condition={c} />
              ))}
            </div>
          )}
        </div>
        {displayConditions.length > 0 && (
          <button
            onClick={handleExpand}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs
              transition-all duration-fast ease-ds-out hover:shadow-sm"
            aria-label={expanded ? 'Collapse studies' : 'Expand studies'}
          >
            <span className={`text-char-500 transition-transform duration-base ${expanded ? 'rotate-180' : ''}`}>
              <Icon name="chevron-down" size={14} />
            </span>
          </button>
        )}
      </div>

      {expanded && displayConditions.length > 0 && (
        <div className="mt-3 pl-1">
          <StudyReferences references={refs} loading={loading} />
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {import('../api/types.js').Recipe} props.recipe
 * @param {import('../api/types.js').Profile} props.profile
 * @param {() => void} props.onClose
 */
export default function RecipeDetail({ recipe, profile, onClose }) {
  const helpful = recipe.ingredients.filter((i) => i.signal === 'beneficial');
  const neutral = recipe.ingredients.filter((i) => i.signal !== 'beneficial');

  // profile.conditions is healthConditionID[] for real profiles, but the
  // ghost/demo profile (GHOST_PROFILE) carries display-name strings already.
  // Resolve numeric IDs to names so they can be compared against
  // matchedConditions (always display names, e.g. via ConditionTag)
  // like-for-like; the string case needs no async resolution.
  const conditions = profile?.conditions ?? [];
  const isNameStrings = conditions.every((c) => typeof c === 'string');
  const [resolvedConditionNames, setResolvedConditionNames] = useState([]);

  useEffect(() => {
    if (isNameStrings || !conditions.length) return;
    let alive = true;
    api.getConditionNames(conditions)
      .then((names) => { if (alive) setResolvedConditionNames(names); })
      .catch(() => { if (alive) setResolvedConditionNames([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the profile identity, not the derived locals
  }, [profile]);

  const profileConditionNames = isNameStrings ? conditions : resolvedConditionNames;

  const matchedToUser = recipe.matchedConditions.filter((c) => profileConditionNames.includes(c));
  const displayConditions = matchedToUser.length ? matchedToUser : recipe.matchedConditions;

  return (
    <BottomSheet open onClose={onClose}>
      {/* Hero image */}
      <div className="-mx-5 -mt-4 mb-5">
        <div className="w-full h-52 bg-sand-100 overflow-hidden">
          <img
            src={recipe.photo}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      </div>

      {/* Title + source */}
      <div className="mb-5">
        <h2 className="font-display text-xl font-semibold text-blue-950 tracking-tightish leading-snug">{recipe.title}</h2>
        <p className="text-sm text-char-500 mt-1 font-sans">
          from <span className="font-semibold text-char-900">{recipe.sourceName}</span>
        </p>
      </div>

      {/* Profile match banner */}
      <div className="bg-signal-beneficial-tint rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <Icon name="check" size={16} className="text-signal-beneficial" />
          <span className="text-sm font-bold text-signal-beneficial font-sans">Matched to your profile</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {displayConditions.map((c) => (
            <ConditionTag key={c} condition={c} />
          ))}
        </div>
        <p className="text-xs text-signal-beneficial font-medium font-sans">
          <span className="font-mono">{helpful.length}</span> beneficial {helpful.length === 1 ? 'ingredient' : 'ingredients'} · <span className="font-mono">{recipe.ingredients.length}</span> total
        </p>
      </div>

      {/* Ingredients */}
      <div className="mb-6">
        <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500 mb-3">Ingredients</p>
        <div className="flex flex-col gap-2">
          {helpful.map((ing) => (
            <IngredientRow key={ing.name} ingredient={ing} profileConditionNames={profileConditionNames} />
          ))}
          {neutral.map((ing) => (
            <IngredientRow key={ing.name} ingredient={ing} profileConditionNames={profileConditionNames} />
          ))}
        </div>
      </div>

      {/* Get the recipe — new-tab web search (no recipe URLs exist in the API) */}
      <button
        onClick={() => {
          const query = `${recipe.title} ${recipe.sourceName || 'Food Network'} recipe`;
          window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
        }}
        className="w-full py-3.5 rounded-pill bg-forest-700 text-white text-sm font-semibold font-sans
          flex items-center justify-center gap-2 mb-3
          transition-all duration-fast ease-ds-out
          hover:bg-forest-800 active:scale-[0.98]"
      >
        <Icon name="external-link" size={16} />
        Get the recipe
      </button>

      {/* Dismiss */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-pill border border-sand-200 text-sm font-semibold text-char-500 font-sans
          transition-all duration-fast ease-ds-out
          hover:bg-sand-100 active:bg-sand-200"
      >
        Dismiss
      </button>
    </BottomSheet>
  );
}
