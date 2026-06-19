/**
 * FoodCard — food item row with thumbnail, name, clinical note, signal.
 *
 * Props (unchanged): food, onClick, showStudies
 * food shape: { name, photo, signal, note?, matchedConditions?, referenceCount? }
 */
import ConditionTag from "./ConditionTag.jsx";
import SignalChip from "./SignalChip.jsx";

const THUMB_BG = {
  beneficial: "bg-forest-600",
  limit: "bg-honey-600",
  avoid: "bg-signal-avoid",
};

export default function FoodCard({ food, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-white rounded-xl border border-sand-200
        p-3.5 shadow-xs text-left
        transition-all duration-base ease-ds-out
        hover:border-forest-300 hover:shadow-card hover:-translate-y-[1px]
        active:translate-y-[1px] active:scale-[0.99]"
    >
      {/* Thumbnail — image or tinted initial */}
      <div
        className={`w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center
          ${food.photo ? "" : THUMB_BG[food.signal] || "bg-forest-600"}`}
      >
        {food.photo ? (
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.parentElement.classList.add(
                THUMB_BG[food.signal] || "bg-forest-600",
              );
              const initial = document.createElement("span");
              initial.className =
                "font-display text-[22px] font-semibold text-paper-100";
              initial.textContent = food.name?.[0] || "";
              e.currentTarget.parentElement.appendChild(initial);
            }}
          />
        ) : (
          <span className="font-display text-[22px] font-semibold text-paper-100">
            {food.name?.[0] || ""}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="font-sans font-semibold text-char-900 text-sm truncate leading-tight">
          {food.name}
        </span>
        {food.note && (
          <span className="text-xs text-char-500 truncate">{food.note}</span>
        )}
        {food.matchedConditions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {food.matchedConditions.slice(0, 2).map((c) => (
              <ConditionTag key={c} condition={c} />
            ))}
            {food.matchedConditions.length > 2 && (
              <span className="text-xs text-char-400 self-center">
                +{food.matchedConditions.length - 2}
              </span>
            )}
          </div>
        )}
        {food.referenceCount > 0 && (
          <p className="text-[11px] text-char-400 mt-0.5">
            <span className="font-mono">{food.referenceCount}</span>{" "}
            {food.referenceCount === 1 ? "study" : "studies"}
          </p>
        )}
      </div>

      {/* Right — signal + chevron */}
      <div className="flex-none flex flex-col items-end gap-1">
        <SignalChip signal={food.signal} />
      </div>

      <span className="flex-shrink-0 text-char-400 material-symbols-rounded" style={{ fontSize: 18 }}>
        chevron_right
      </span>
    </button>
  );
}
