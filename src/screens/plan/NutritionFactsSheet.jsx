import DataState from '../../components/shared/DataState.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { estimateDayTotals } from '../../data/nutritionEstimates.js';
import { resolveNutrition } from '../../api/nutrition.js';

/**
 * NutritionFactsSheet — per-day nutrition for a Scheduler day's items.
 *
 * The day TOTAL still comes from `estimateDayTotals` (unchanged) — it's
 * always labeled "Estimated" up top, same as before. The PER-ITEM rows
 * (Task T3D) resolve through `resolveNutrition` (src/api/nutrition.js)
 * instead, so a real recipe-panel or USDA figure is labeled honestly: no
 * tilde for real per-serving data, an explicit "per 100 g" note when USDA
 * only had a 100 g figure (not a serving), and a "~N kcal · estimated"
 * tilde-plus-label treatment for stand-in group estimates (the tilde alone
 * isn't a strong enough cue once real per-item rows exist alongside it). An
 * item with no data anywhere still renders "No estimate" — never a
 * fabricated number.
 */
export default function NutritionFactsSheet({ open, onClose, dayLabel, items }) {
  const list = items ?? [];
  const totals = estimateDayTotals(list);

  return (
    <BottomSheet open={open} onClose={onClose} title="Nutrition Facts">
      <div className="flex items-center justify-between mb-1">
        <span className="font-sans text-sm font-semibold text-blue-950">{dayLabel}</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sand-200 text-char-500">
          Estimated
        </span>
      </div>
      <p className="text-xs text-char-500 mb-4">
        Rough estimates by food group — not measured values.
      </p>

      {totals ? (
        <>
          <div className="mb-2">
            <span className="font-display text-4xl font-semibold text-blue-950">
              {totals.calories}
            </span>
            <span className="ml-2 text-xs text-char-500">kcal · estimated</span>
          </div>

          <div className="flex justify-between py-2 border-b border-sand-200 text-sm">
            <span className="text-blue-950">Protein</span>
            <span className="font-semibold text-blue-950">{totals.protein} g</span>
          </div>
          <div className="flex justify-between py-2 border-b border-sand-200 text-sm">
            <span className="text-blue-950">Carbs</span>
            <span className="font-semibold text-blue-950">{totals.carbs} g</span>
          </div>
          <div className="flex justify-between py-2 border-b border-sand-200 text-sm">
            <span className="text-blue-950">Fat</span>
            <span className="font-semibold text-blue-950">{totals.fat} g</span>
          </div>
        </>
      ) : (
        <DataState
          status="empty"
          screenName="nutrition"
          emptyTitle={null}
          emptyBody="No estimate available for this day."
        />
      )}

      {list.length > 0 && (
        <>
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/50 mt-5 mb-2">
            Per item
          </p>
          <div className="flex flex-col gap-2">
            {list.map((item) => {
              const resolved = resolveNutrition(item, item.fromSlot);
              // A tier can resolve (panel/USDA/estimate) with `calories`
              // itself `null` — e.g. a C1 overlay panel that has macros but
              // no calorie figure (recipeIngestion.js's nutrition
              // relaxation). Never render a calorie string for that case:
              // no fabricated number, no "undefined kcal"/"null kcal" — the
              // same honest "no estimate" treatment as a fully unresolved
              // item (see MealQueueScreen.jsx's print view: "foods only, no
              // calories, no fabricated placeholders").
              const hasCalories = resolved && resolved.calories != null;
              return (
                <div key={item.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="text-blue-950 truncate">{item.name}</span>
                  {hasCalories ? (
                    <span className="text-char-500 shrink-0">
                      {resolved.estimated
                        ? `~${resolved.calories} kcal · estimated`
                        : resolved.basis === 'per100g'
                          ? `${resolved.calories} kcal per 100 g`
                          : `${resolved.calories} kcal`}
                    </span>
                  ) : (
                    <span className="text-char-500/50 shrink-0">No estimate</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
