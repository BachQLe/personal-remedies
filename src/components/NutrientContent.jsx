import { useEffect, useState } from 'react';
import Icon from './shared/Icon.jsx';
import Skeleton from './shared/Skeleton.jsx';
import {
  LEVELS,
  NUTRIENTS,
  formatAmount,
  getFoodContent,
  getTopSources,
  isContentNutrient,
} from '../api/contentTable.js';

const BOX = 'rounded-xl border border-blue-950/10 shadow-xs bg-white p-4';
const EYEBROW = 'eyebrow mb-3';

// Level is about amount, not goodness, so never green/red.
function Dots({ level }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < level ? 'bg-blue-950' : 'bg-neutral-300'}`} />
      ))}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <Skeleton shape="text" className="w-3/4" />
      <Skeleton shape="text" className="w-2/3" />
      <Skeleton shape="text" className="w-1/2" />
    </div>
  );
}

// undefined = loading, null = unavailable.
function useLoaded(load, foodId) {
  const [state, setState] = useState({ foodId, data: undefined });
  useEffect(() => {
    let cancelled = false;
    load(foodId).catch(() => null).then((data) => { if (!cancelled) setState({ foodId, data }); });
    return () => { cancelled = true; };
  }, [load, foodId]);
  return state.foodId === foodId ? state.data : undefined;
}

function FoodContent({ foodId }) {
  const data = useLoaded(getFoodContent, foodId);
  const unit = data?.servingGrams ? 'one serving' : '100 g';
  const byLevel = [3, 2, 1, 0]
    .map((level) => ({ level, rows: (data?.rows ?? []).filter((r) => r.level === level) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className={BOX}>
      <p className={EYEBROW}>Nutrient content</p>
      {data === undefined ? (
        <Loading />
      ) : data === null ? (
        <p className="text-sm text-char-500 font-sans">Nutrient content isn&apos;t available for this food yet.</p>
      ) : (
        <>
          <p className="text-xs text-char-500 mb-2">
            {data.servingGrams ? `Per ${data.servingGrams} g serving` : 'Per 100 g'}
          </p>
          <div className="flex flex-col gap-2">
            {byLevel.map(({ level, rows }) => (
              <div key={level} className="flex items-start gap-2">
                <span className="mt-1.5"><Dots level={level} /></span>
                <p className="text-sm text-char-700 font-sans">
                  <span className="font-semibold text-char-900">{LEVELS[level]}</span>
                  {' · '}
                  {rows.map((r) => r.label).join(', ')}
                </p>
              </div>
            ))}
          </div>
          <details className="group mt-2">
            <summary className="list-none flex items-center justify-between min-h-[44px] cursor-pointer text-sm font-semibold text-forest-700">
              Show amounts
              <Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div>
              {data.rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-sand-100 last:border-b-0 text-sm font-sans">
                  <span className="text-char-700">{r.label}</span>
                  <span className="text-char-900">
                    {formatAmount(r.amount)} {r.unit}
                    {r.percentDV != null && ` · ${r.percentDV}% DV`}
                  </span>
                </div>
              ))}
            </div>
          </details>
          <p className="text-xs text-char-500 mt-3">
            Levels compare {unit} to the Daily Value: 20%+ very high, 10–19% high, 2–9% some, under 2% little or none.
          </p>
        </>
      )}
    </div>
  );
}

function TopSources({ foodId, onOpenFood }) {
  const label = NUTRIENTS.find((n) => n.id === Number(foodId))?.label;
  const data = useLoaded(getTopSources, foodId);

  return (
    <div className={BOX}>
      <p className={EYEBROW}>Top sources of {label}</p>
      {data === undefined ? (
        <Loading />
      ) : !data?.length ? (
        <p className="text-sm text-char-500 font-sans">No foods ranked for {label} yet.</p>
      ) : (
        <>
          <ol>
            {data.map((s, i) => {
              const inner = (
                <>
                  <span className="flex-none w-7 h-7 rounded-full bg-forest-100 text-forest-700 font-semibold text-sm flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-char-900">{s.name}</span>
                    <span className="block text-xs text-char-500">
                      {formatAmount(s.amount)} {s.unit} per {s.servingGrams} g serving
                    </span>
                  </span>
                  {s.level != null && (
                    <span className="flex-none flex flex-col items-end gap-1">
                      <Dots level={s.level} />
                      <span className="text-xs text-char-500">{LEVELS[s.level]}</span>
                    </span>
                  )}
                </>
              );
              const cls = 'w-full flex items-center gap-3 min-h-[44px] py-1.5 px-1 text-left';
              return (
                <li key={s.foodId}>
                  {onOpenFood ? (
                    <button
                      type="button"
                      onClick={() => onOpenFood({ foodId: s.foodId, name: s.name })}
                      className={`${cls} rounded hover:bg-sand-50`}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-char-500 mt-3">Ranked by amount in one serving.</p>
        </>
      )}
    </div>
  );
}

export default function NutrientContent({ foodId, onOpenFood }) {
  return isContentNutrient(foodId)
    ? <TopSources foodId={foodId} onOpenFood={onOpenFood} />
    : <FoodContent foodId={foodId} />;
}
