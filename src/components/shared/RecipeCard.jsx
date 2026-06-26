/**
 * RecipeCard — recipe item (row or grid layout).
 *
 * Props (unchanged): recipe, onClick, layout ("row"|"grid")
 */
import Icon from "./Icon.jsx";
import ConditionTag from "./ConditionTag.jsx";

export default function RecipeCard({ recipe, onClick, layout = "row" }) {
  if (layout === "grid") {
    return (
      <button
        onClick={onClick}
        className="flex flex-col bg-paper-200 rounded-none border border-sand-200 overflow-hidden shadow-card text-left
          transition-all duration-base ease-ds-out
          hover:-translate-y-[2px] hover:shadow-lg
          active:translate-y-[1px] active:scale-[0.99]"
      >
        <div className="w-full h-40 bg-paper-200">
          <img
            src={recipe.photo}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4 pb-3 flex flex-col bg-white rounded-t-sm -mt-5 relative">
          <p className="font-sans font-semibold text-char-900 text-sm leading-snug line-clamp-2 h-[2.625rem]">
            {recipe.title}
          </p>
          <p className="text-xs text-char-500 mt-1">{recipe.sourceName}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.matchedConditions?.slice(0, 2).map((c) => (
              <ConditionTag key={c} condition={c} compact truncate />
            ))}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-white rounded-xl border border-sand-200
        p-3.5 shadow-xs text-left
        transition-all duration-base ease-ds-out
        hover:border-forest-300 hover:shadow-card hover:-translate-y-[1px]
        active:translate-y-[1px] active:scale-[0.99]"
    >
      <div className="w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 bg-paper-200">
        <img
          src={recipe.photo}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans font-semibold text-char-900 text-sm leading-snug">
          {recipe.title}
        </p>
        <p className="text-xs text-char-500 mt-0.5">{recipe.sourceName}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {recipe.matchedConditions?.slice(0, 2).map((c) => (
            <ConditionTag key={c} condition={c} />
          ))}
        </div>
      </div>
      <span className="flex-shrink-0 text-char-400">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  );
}
