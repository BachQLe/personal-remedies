import { useState } from 'react';
import { getNutrientPanel, formatAmount } from '../api/nutrientFacts.js';

/**
 * NutrientFactsPanel — real USDA nutrient values for one food (Food Facts).
 *
 * Per serving by default with a "Per 100 g" toggle. Matched foods name the
 * USDA record they were matched to; unmatched foods say so plainly — values
 * are never estimated here. Nutrients USDA did not report are omitted (a
 * missing number is not a zero).
 */
export default function NutrientFactsPanel({ foodId }) {
  const panel = foodId != null ? getNutrientPanel(foodId) : null;
  const [basis, setBasis] = useState('serving');

  return (
    <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4" data-testid="nutrient-facts">
      <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-3">Nutrition facts</p>

      {!panel ? (
        <p className="text-base text-char-700 font-sans">Nutrition data not available</p>
      ) : (
        <PanelBody panel={panel} basis={basis} onBasis={setBasis} />
      )}
    </div>
  );
}

function PanelBody({ panel, basis, onBasis }) {
  const hasServing = Boolean(panel.perServing);
  const active = basis === 'serving' && hasServing ? 'serving' : 'per100';
  const rows = active === 'serving' ? panel.perServing : panel.per100g;
  const heading =
    active === 'serving'
      ? `Per serving (${formatAmount(panel.serving.grams)} g${panel.serving.label ? `, ${panel.serving.label}` : ''})`
      : 'Per 100 g';

  return (
    <>
      {hasServing && (
        <div className="flex gap-2 mb-3" role="group" aria-label="Nutrient basis">
          {[
            ['serving', 'Per serving'],
            ['per100', 'Per 100 g'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onBasis(id)}
              aria-pressed={active === (id === 'serving' ? 'serving' : 'per100')}
              className={`flex-1 py-2.5 rounded-pill border text-base font-semibold font-sans transition-colors duration-fast ${
                active === (id === 'serving' ? 'serving' : 'per100')
                  ? 'bg-forest-700 border-forest-700 text-white'
                  : 'bg-white border-sand-200 text-char-900 hover:bg-sand-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <p className="text-base font-semibold text-blue-950 font-sans mb-1" data-testid="nutrient-basis">{heading}</p>
      {!hasServing && (
        <p className="text-sm text-char-500 font-sans mb-1">No everyday serving size is available for this food.</p>
      )}

      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-3 py-2 border-b border-sand-200 last:border-b-0">
            <span className="text-base text-char-900 font-sans">{r.label}</span>
            <span className="text-base font-semibold text-char-900 font-sans whitespace-nowrap">
              {formatAmount(r.value)} {r.unit}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-char-500 font-sans mt-3 leading-snug">
        Source: USDA FoodData Central
        <br />
        Matched to: {panel.matchedName} ({panel.dataType})
        <br />
        Nutrients USDA did not report for this food are not shown.
      </p>
    </>
  );
}
