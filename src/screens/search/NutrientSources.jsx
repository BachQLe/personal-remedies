import { useCallback } from 'react';
import BackButton from '../../components/shared/BackButton.jsx';
import DataState from '../../components/shared/DataState.jsx';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { getTopNutrientSources } from '../../api/api.js';
import { PICKABLE_NUTRIENTS, getNutrientMeta, formatAmount } from '../../api/nutrientFacts.js';

const GROUP_ORDER = ['Macros', 'Core', 'Minerals', 'Vitamins'];
const GROUP_LABELS = { Macros: 'Macros', Core: 'Fiber, fats and sugars', Minerals: 'Minerals', Vitamins: 'Vitamins' };

/**
 * NutrientPicker — chip list of every nutrient we hold USDA data for.
 * Shown in the Search idle view ("Natural sources by nutrient").
 */
export function NutrientPicker({ onPick }) {
  return (
    <div className="flex flex-col gap-4" data-testid="nutrient-picker">
      <div>
        <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-700">Natural sources</p>
        <p className="text-base text-char-700 font-sans mt-1">Pick a nutrient to see which foods have the most.</p>
      </div>
      {GROUP_ORDER.map((group) => (
        <div key={group}>
          <p className="text-sm font-semibold text-char-700 font-sans mb-2">{GROUP_LABELS[group]}</p>
          <div className="flex flex-wrap gap-2">
            {PICKABLE_NUTRIENTS.filter((n) => n.group === group).map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => onPick(n.key)}
                className="px-4 py-2.5 rounded-pill border border-sand-200 bg-white text-base text-char-900 font-sans
                  transition-all duration-fast ease-ds-out hover:border-forest-400 hover:bg-forest-50 active:bg-sand-100"
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * TopSources — the top ~20 foods for one nutrient, ranked per 100 g (the
 * only fair comparison), each row opening the normal food card. A per-serving
 * figure appears only when USDA's portion is a realistic eaten serving.
 */
export default function TopSources({ nutrientKey, onBack, onOpenFood }) {
  const meta = getNutrientMeta(nutrientKey);
  const fetcher = useCallback(() => getTopNutrientSources(nutrientKey, { limit: 20 }), [nutrientKey]);
  const { status, data, retry } = useAsyncData(fetcher, [nutrientKey], { isEmpty: (d) => !d || d.length === 0 });

  return (
    <div className="flex flex-col gap-3" data-testid="top-sources">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} aria-label="Back to nutrients" />
        <h2 className="font-display text-xl font-semibold text-blue-950 leading-tight">
          Top sources of {meta?.label ?? 'this nutrient'}
        </h2>
      </div>
      <p className="text-base text-char-700 font-sans">Ranked by amount per 100 g, so foods compare fairly.</p>

      <DataState
        status={status}
        onRetry={retry}
        emptyTitle="No data"
        emptyBody={`No foods with USDA data for ${meta?.label ?? 'this nutrient'}.`}
        screenName="top sources"
      >
        <div className="flex flex-col gap-2.5">
          {(data || []).map((row, i) => (
            <button
              key={row.food.id}
              type="button"
              onClick={() => onOpenFood({ id: row.food.id, name: row.food.name })}
              className="flex-none w-full text-left pl-4 pr-4 py-4 rounded-sm bg-white text-char-900 border border-sand-200
                shadow-sm font-sans flex items-center gap-3 transition-all duration-fast ease-ds-out hover:border-forest-400 hover:shadow-md"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-forest-100 text-forest-700 text-base font-semibold">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-base text-char-900 leading-tight">{row.food.name}</span>
                {row.perServing != null && (
                  <span className="block text-sm text-char-500 mt-1">
                    {formatAmount(row.perServing)} {row.unit} per serving ({formatAmount(row.serving.grams)} g
                    {row.serving.label ? `, ${row.serving.label}` : ''})
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 text-right">
                <span className="block font-display text-lg font-semibold text-forest-700 leading-tight">
                  {formatAmount(row.per100g)} {row.unit}
                </span>
                <span className="block text-sm text-char-500">per 100 g</span>
              </span>
            </button>
          ))}
        </div>
      </DataState>

      <p className="text-sm text-char-500 font-sans leading-snug pb-2">
        Only foods with USDA FoodData Central data can be ranked. Foods without a match, recipes and
        non-food items are left out. Serving amounts are shown only for everyday portions.
      </p>
    </div>
  );
}
