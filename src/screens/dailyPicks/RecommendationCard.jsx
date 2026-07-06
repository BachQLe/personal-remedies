/**
 * RecommendationCard — a single ranked pick.
 *
 * Credibility rule: tier LABEL + reference COUNT only. Never a numeric score.
 *   rank 1 → "Top match" (forest/beneficial emphasis) — this is a rank
 *     callout, not a claim about the underlying data's tier.
 *   tier "strong" → "Strong match"; tier "good" → "Good match"
 *   tier null/undefined (e.g. topdoordonts-sourced picks, which carry no
 *     tier data) → no badge is rendered. Never fabricate a label.
 *
 * Props:
 *   rec       — Recommendation { id, name, tier, referenceCount, rank, blurb, matchedConditions }
 *   emphasized — boolean, the rank-1 card gets the forest accent + "Top match" badge
 *   selected   — boolean, shows the "Added" state
 *   onToggle   — () => void, toggles the pick into / out of the plan
 */
import { motion } from "framer-motion";
import ConditionTag from "../../components/shared/ConditionTag.jsx";

const TIER_LABEL = {
  top: "Top match",
  strong: "Strong match",
  good: "Good match",
};

const cardEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] },
};

function TierBadge({ tier, emphasized }) {
  // The rank-1 "Top match" badge is a position callout (independent of
  // whether the source data carries a tier), so it always renders.
  if (emphasized) {
    return (
      <span className="inline-flex items-center gap-[7px] h-[30px] px-3 pl-2.5 rounded-pill font-sans text-sm font-semibold bg-signal-beneficial-tint text-signal-beneficial">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-signal-beneficial text-white flex-none">
          <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
            check
          </span>
        </span>
        {TIER_LABEL.top}
      </span>
    );
  }
  // No real tier data (e.g. topdoordonts-sourced picks) → hide the badge
  // rather than defaulting to a fabricated "Good match" label.
  if (!TIER_LABEL[tier]) return null;
  return (
    <span className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-pill font-sans text-sm font-semibold bg-sand-100 text-char-700">
      {TIER_LABEL[tier]}
    </span>
  );
}

export default function RecommendationCard({
  rec,
  emphasized = false,
  selected = false,
  onToggle,
}) {
  return (
    <motion.div
      layout
      initial={cardEnter.initial}
      animate={cardEnter.animate}
      transition={cardEnter.transition}
      className={`relative bg-white rounded-xl border shadow-card text-left
        transition-all duration-base ease-ds-out
        ${emphasized ? "p-[18px] border-forest-300" : "p-3.5 border-sand-200"}
        ${selected ? "ring-1 ring-forest-300 bg-forest-50/60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {(emphasized || TIER_LABEL[rec.tier]) && (
            <TierBadge tier={rec.tier} emphasized={emphasized} />
          )}
          <h3
            className={`font-sans font-semibold text-char-900 leading-tight ${
              emphasized || TIER_LABEL[rec.tier] ? "mt-2.5" : ""
            } ${emphasized ? "text-[17px]" : "text-[15px]"}`}
          >
            {rec.name}
          </h3>
          {rec.blurb && (
            <p className="mt-1 text-xs text-char-500 leading-snug">{rec.blurb}</p>
          )}
        </div>

        {/* Add / Added control */}
        <button
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${rec.name} from plan` : `Add ${rec.name} to plan`}
          className={`flex-none inline-flex items-center justify-center rounded-full
            transition-all duration-fast ease-ds-out
            active:translate-y-[1px] active:scale-[0.96]
            ${
              selected
                ? "w-9 h-9 bg-forest-700 text-white hover:bg-forest-800"
                : "w-9 h-9 bg-white border border-sand-200 text-forest-700 hover:border-forest-300 hover:bg-forest-50"
            }`}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
            {selected ? "check" : "add"}
          </span>
        </button>
      </div>

      {rec.matchedConditions?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {rec.matchedConditions.slice(0, 2).map((c) => (
            <ConditionTag key={c} condition={c} compact />
          ))}
          {rec.matchedConditions.length > 2 && (
            <span className="text-[11px] text-char-400 self-center">
              +{rec.matchedConditions.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-sand-100">
        <span className="material-symbols-rounded text-char-400" style={{ fontSize: 16 }}>
          menu_book
        </span>
        <p className="text-[12px] text-char-500">
          <span className="font-mono text-char-700">{rec.referenceCount}</span>{" "}
          {rec.referenceCount === 1 ? "reference" : "references"}
        </p>
        {selected && (
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-signal-beneficial">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              check_circle
            </span>
            Added
          </span>
        )}
      </div>
    </motion.div>
  );
}
