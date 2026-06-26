/**
 * MealSection — one meal slot (breakfast / lunch / dinner / snack).
 *
 * Loads the first 3 ranked recs on mount, the rank-1 card is emphasized.
 * "+ more options" appends the next non-overlapping tranche of 3 (offsets
 * 3, 6, 9…). Hides itself once getSlotCount(slot) is reached.
 *
 * Props:
 *   slot         — MealSlot
 *   selectedIds  — Set<string> of picked rec ids (for the Added state)
 *   onToggle     — (rec) => void
 */
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { getRecommendations, getSlotCount } from "../../api/recommendations";
import RecommendationCard from "./RecommendationCard.jsx";

const SLOT_ICON = {
  breakfast: "wb_twilight",
  lunch: "lunch_dining",
  dinner: "dinner_dining",
  snack: "nutrition",
};

const PAGE = 3;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function MealSection({ slot, selectedIds, onToggle }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const total = getSlotCount(slot);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRecommendations(slot, 0, PAGE).then((first) => {
      if (alive) {
        setRecs(first);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [slot]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = await getRecommendations(slot, recs.length, PAGE);
    setRecs((prev) => {
      // Guard against any accidental overlap — keep unique ids, in order.
      const seen = new Set(prev.map((r) => r.id));
      const fresh = next.filter((r) => !seen.has(r.id));
      return [...prev, ...fresh];
    });
    setLoadingMore(false);
  };

  const hasMore = recs.length < total;

  return (
    <section className="mb-7">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-forest-50 text-forest-700">
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
            {SLOT_ICON[slot]}
          </span>
        </span>
        <div>
          <div className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans">
            Meal
          </div>
          <h2 className="font-display text-lg font-semibold tracking-tightish text-char-900 leading-none">
            {cap(slot)}
          </h2>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[92px] rounded-xl border border-sand-200 bg-white/60 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {recs.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                emphasized={rec.rank === 1}
                selected={selectedIds.has(rec.id)}
                onToggle={() => onToggle(rec)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* + more options */}
      {!loading && hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-3 inline-flex items-center gap-1.5 h-[38px] px-4 rounded-pill
            bg-white border border-sand-200 text-char-900 text-sm font-medium
            transition-all duration-fast ease-ds-out
            hover:border-forest-300 hover:bg-forest-50
            active:translate-y-[1px] active:scale-[0.99]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMore ? (
            <span className="w-4 h-4 border-2 border-forest-300 border-t-forest-700 rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              add
            </span>
          )}
          {loadingMore ? "Loading" : "More options"}
        </button>
      )}
    </section>
  );
}
