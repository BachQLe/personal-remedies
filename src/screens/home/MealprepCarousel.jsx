/**
 * Home meal discovery: RECIPES ONLY, grouped by meal category. What shows (and
 * in what order) is a helpfulness-weighted random pick (see pickRecipes.js),
 * saved with a timestamp so Home keeps the same set for a day and re-picks when
 * it expires or the profile's conditions change. Categories with no recipes
 * are hidden. Native swipe, shared recipe saves.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, Leaf } from 'lucide-react';
import { buildRecipeDetail, getMealPlanSuggestions, getRecipes } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { getSaveBlockReason } from '../../utils/saveGate.js';
import { addToLibrary, getLibrary, removeFromLibrary, subscribeLibrary } from '../../state/library.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import DataState, { SlowLoadingNote } from '../../components/shared/DataState.jsx';
import { dragScrollProps } from '../../components/shared/dragScroll.js';
import Skeleton from '../../components/shared/Skeleton.jsx';
import FoodRating from '../../components/shared/FoodRating.jsx';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { pickRecipes } from './pickRecipes.js';
import './MealprepCarousel.css';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'beverages', label: 'Beverages' },
];

// Persisted picks: { at, stamp, picks: { [mealKey]: id[] } } via storage.js.
const PICKS_KEY = 'homeRecipePicks';
const PICKS_TTL_MS = 24 * 60 * 60 * 1000; // re-pick once a day
const PICKS_PER_MEAL = 6;

// Short decorative tag shown over each card's photo. Purely visual — the
// full category name is already carried by the open/save button aria-labels.
const MEAL_TAG_ABBR = {
  breakfast: 'B',
  lunch: 'L',
  dinner: 'D',
  snacks: 'S',
  beverages: 'BV',
};

function getProfile() {
  const saved = storage.get('profile', null);
  return { ...saved, conditions: saved?.conditions ?? [] };
}

function MealCard({ card, label, mealKey, saved, onOpen, onSave }) {
  const [imageFailed, setImageFailed] = useState(false);
  const canSave = saved || !getSaveBlockReason(card);
  return (
    <div className="home-meals__photo">
      <button type="button" className="home-meals__open" onClick={() => onOpen(card)} aria-label={`View ${card.name}`}>
        {card.image && !imageFailed ? (
          <img src={card.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="home-meals__photo-fallback"><Leaf size={72} strokeWidth={1.2} aria-hidden="true" /></div>
        )}
        <span className="home-meals__scrim" aria-hidden="true" />
        <span className="home-meals__tag" aria-hidden="true">{MEAL_TAG_ABBR[mealKey]}</span>
        <span className="home-meals__caption">
          <FoodRating numericId={card.numericId} tone="dark" className="home-meals__rating" />
          <span className="home-meals__name font-display font-semibold">{card.name}</span>
          <span className="home-meals__subtitle">{card.sourceName || `${label} inspiration`}</span>
        </span>
      </button>
      <button
        type="button"
        className={`home-meals__save${saved ? ' is-saved' : ''}`}
        aria-label={canSave ? `${saved ? 'Unsave' : 'Save'} ${card.name}` : `View details for ${card.name}`}
        aria-pressed={canSave ? saved : undefined}
        onClick={() => canSave ? onSave(card) : onOpen(card)}
      >
        {canSave ? <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

function MealRail({ cards, label, mealKey, library, onOpen, onSave }) {
  const railRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function moveTo(index) {
    const rail = railRef.current;
    const slide = rail?.children[index];
    if (!slide) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    rail.scrollTo({ left: slide.offsetLeft - rail.offsetLeft, behavior: reduceMotion ? 'instant' : 'smooth' });
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail) return;
    let nearest = 0;
    let distance = Infinity;
    Array.from(rail.children).forEach((slide, index) => {
      const current = Math.abs(slide.offsetLeft - rail.offsetLeft - rail.scrollLeft);
      if (current < distance) { nearest = index; distance = current; }
    });
    setActiveIndex(nearest);
  }

  return (
    <div className="home-meals__carousel" role="region" aria-roledescription="carousel" aria-label={`${label} ideas`}>
      <div
        {...dragScrollProps}
        className="home-meals__rail rail-scrollbar"
        ref={railRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="Meal cards. Use the left and right arrow keys to browse."
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            moveTo(Math.max(0, Math.min(cards.length - 1, activeIndex + (event.key === 'ArrowRight' ? 1 : -1))));
          }
        }}
      >
        {cards.map((card, index) => (
          <article
            className="home-meals__slide"
            key={card.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${cards.length}`}
            inert={index !== activeIndex}
          >
            <MealCard card={card} label={label} mealKey={mealKey} saved={library.some((item) => item.id === card.id)} onOpen={onOpen} onSave={onSave} />
          </article>
        ))}
      </div>
      {cards.length > 1 && (
        <div className="home-meals__navigation">
          <button type="button" onClick={() => moveTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label={`Previous ${label.toLowerCase()} idea`}><ChevronLeft size={19} aria-hidden="true" /></button>
          <span aria-live="polite" aria-atomic="true">{activeIndex + 1}<span aria-hidden="true"> / </span><span className="sr-only"> of </span>{cards.length}</span>
          <button type="button" onClick={() => moveTo(activeIndex + 1)} disabled={activeIndex === cards.length - 1} aria-label={`Next ${label.toLowerCase()} idea`}><ChevronRight size={19} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

function MealRecommendations({ profile }) {
  const id = useId();
  const [mealKey, setMealKey] = useState('breakfast');
  const [selectedItem, setSelectedItem] = useState(null);
  const [library, setLibrary] = useState(getLibrary);
  const detailRequest = useRef(0);
  const tabRefs = useRef([]);

  useEffect(() => subscribeLibrary(setLibrary), []);
  useEffect(() => () => { detailRequest.current += 1; }, []);

  const fetcher = useCallback(async () => {
    const result = await getMealPlanSuggestions(profile);
    // Suggestions already share the recipe cache. Read it again to retain
    // real ingredients, which the lean PlanCandidate shape omits.
    const recipeResult = await getRecipes(profile).catch(() => ({ recipes: [] }));
    const recipeMap = new Map(recipeResult.recipes.map((recipe) => [recipe.id, recipe]));

    // Keep yesterday-or-newer picks for the same conditions; otherwise re-pick.
    const stamp = [...profile.conditions].sort().join(',');
    const saved = storage.get(PICKS_KEY, null);
    const fresh = saved?.stamp === stamp && Date.now() - saved.at < PICKS_TTL_MS && !!saved.picks;
    let repicked = !fresh;
    const picks = {};
    const candidates = Object.fromEntries(MEALS.map(({ key }) => {
      const pool = result.candidates[key] ?? [];
      const kept = (fresh ? saved.picks[key] ?? [] : []).map((savedId) => pool.find((item) => item.id === savedId)).filter(Boolean);
      const chosen = kept.length ? kept : pickRecipes(pool, Math.random, PICKS_PER_MEAL);
      if (!kept.length && chosen.length) repicked = true;
      picks[key] = chosen.map((item) => item.id);
      return [key, chosen.map((item) => ({
        ...recipeMap.get(item.id),
        ...item,
        foodId: item.id,
        matchedConditions: result.conditionNames,
      }))];
    }));
    if (repicked) storage.set(PICKS_KEY, { at: fresh ? saved.at : Date.now(), stamp, picks });
    return { ...result, candidates };
  }, [profile]);

  const { status, data, retry } = useAsyncData(fetcher, [], {
    isEmpty: (result) => !Object.values(result.candidates).some((items) => items.length),
  });
  // Categories without recipes are hidden, not padded. Until data arrives every
  // tab shows, so the row doesn't jump while loading.
  const tabs = data ? MEALS.filter((item) => data.candidates[item.key]?.length) : MEALS;
  const meal = tabs.find((item) => item.key === mealKey) ?? tabs[0] ?? MEALS[0];
  const cards = data?.candidates[meal.key] ?? [];

  function closeDetail() {
    detailRequest.current += 1;
    setSelectedItem(null);
  }

  function openDetail(card) {
    const request = ++detailRequest.current;
    const seed = {
      ...card,
      foodId: card.id,
      conditions: card.matchedConditions ?? [],
      realIngredients: card.ingredients,
      isRecipe: card.kind === 'recipe',
    };
    setSelectedItem(seed);
    buildRecipeDetail(card, profile).then((detail) => {
      if (request === detailRequest.current) setSelectedItem({ ...seed, ...detail, isRecipe: seed.isRecipe });
    }).catch(() => { /* Keep the usable seed if enrichment is unavailable. */ });
  }

  function toggleSave(card) {
    // Read the store at activation time, so rapid repeated clicks and saves
    // made from the detail sheet cannot race a stale render's heart state.
    if (getLibrary().some((item) => item.id === card.id)) removeFromLibrary(card.id);
    else if (!getSaveBlockReason(card)) addToLibrary(card);
  }

  function selectTab(index) {
    setMealKey(tabs[index].key);
    tabRefs.current[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }

  return (
    <section className="home-meals" aria-label="Meal inspiration">
      <FoodDetailCard item={selectedItem} open={!!selectedItem} onClose={closeDetail} />
      {tabs.length > 0 && <div className="home-meals__tabs" role="tablist" aria-label="Meal categories">
        {tabs.map((item, index) => (
          <button
            type="button"
            key={item.key}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`${id}-${item.key}-tab`}
            role="tab"
            aria-selected={meal.key === item.key}
            aria-controls={`${id}-panel`}
            tabIndex={meal.key === item.key ? 0 : -1}
            className="home-meals__tab font-sans"
            onClick={() => selectTab(index)}
            onKeyDown={(event) => {
              let next;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = tabs.length - 1;
              if (next == null) return;
              event.preventDefault();
              selectTab(next);
              tabRefs.current[next]?.focus({ preventScroll: true });
            }}
          >{item.label}</button>
        ))}
      </div>}
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={tabs.length > 0 ? `${id}-${meal.key}-tab` : undefined}>
        {status === 'loading' ? (
          <>
            <div className="home-meals__loading" role="status" aria-label="Loading recipes">
              <Skeleton shape="card" className="home-meals__photo" />
            </div>
            <SlowLoadingNote className="pt-3" />
          </>
        ) : (
          <DataState status={status} onRetry={retry} emptyTitle="No recipes yet" emptyBody={data?.unscorableReason || undefined} screenName="recipes">
            <MealRail key={meal.key} cards={cards} label={meal.label} mealKey={meal.key} library={library} onOpen={openDetail} onSave={toggleSave} />
          </DataState>
        )}
      </div>
    </section>
  );
}

export default function MealprepCarousel() {
  const [profile, setProfile] = useState(getProfile);
  useEffect(() => storage.onWrite((key) => {
    if (key === 'profile') setProfile(getProfile());
  }), []);
  // A remotely hydrated or edited profile starts a fresh request and closes
  // old details, instead of showing/saving recommendations for stale data.
  return <MealRecommendations key={JSON.stringify(profile)} profile={profile} />;
}
