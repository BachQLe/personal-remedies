/**
 * NonFoodGuidance — short, general-information tips shown on the opened card
 * for lifestyle/therapy (non-food) items. Copy lives in
 * src/data/nonFoodGuidance.js (DRAFT for Sunny's review). Renders nothing
 * for real foods, recipes and nutrient/herbal items.
 */
import { getNonFoodGuidance } from '../../data/nonFoodGuidance.js';

export default function NonFoodGuidance({ foodId, group, fineGroup, longDescription }) {
  const g = getNonFoodGuidance({ foodId, group, fineGroup, longDescription });
  if (!g) return null;
  return (
    <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4" data-testid="nonfood-guidance">
      <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-2">
        {g.title}
      </p>
      {g.about && (
        <p className="text-sm text-char-600 font-sans leading-snug mb-3">{g.about}</p>
      )}
      <ul className="flex flex-col gap-2">
        {g.tips.map((tip, i) => (
          <li key={i} className="flex gap-2 text-sm text-char-700 font-sans leading-snug">
            <span aria-hidden="true" className="mt-[7px] w-1.5 h-1.5 rounded-full bg-forest-700 flex-none" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-char-500 font-sans leading-snug mt-3 pt-3 border-t border-neutral-200">
        {g.note}
      </p>
    </div>
  );
}
