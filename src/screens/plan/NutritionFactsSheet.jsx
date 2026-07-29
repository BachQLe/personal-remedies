import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { estimateDayTotals, estimateNutrition } from '../../data/nutritionEstimates.js';

/**
 * NutritionFactsSheet — rough per-day nutrition estimate for a Scheduler
 * day's items. Estimates are derived by food group, NOT measured values —
 * every figure here is labeled "Estimated" per the app's honesty rules.
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
        <p className="text-sm text-blue-950/60 py-2">No estimate available for this day.</p>
      )}

      {list.length > 0 && (
        <>
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/50 mt-5 mb-2">
            Per item
          </p>
          <div className="flex flex-col gap-2">
            {list.map((item) => {
              const est = estimateNutrition(item, item.fromSlot);
              return (
                <div key={item.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="text-blue-950 truncate">{item.name}</span>
                  {est ? (
                    <span className="text-char-500 shrink-0">~{est.calories} kcal</span>
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
