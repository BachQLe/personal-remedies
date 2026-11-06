import { PLAN_SLOTS } from '../../api/config.js';

/**
 * plannerCopy.js - every user-facing string of the My Favorites + New Meal Plan
 * flow (checklist 1.24), in one file so the copy review is a one-file job.
 * Health wording stays on the neutral "ranked low for your profile" form.
 */

/** Layer for this flow's sheets: above the app-shell toast (z-50), so a toast never covers a sheet's title. */
export const SHEET_Z = 'z-[60]';

// At or below this many favorites for a meal, the randomizer repeats itself.
const NUDGE_AT_OR_BELOW = 3;

/**
 * Labels of the meals too short on favorites for the plan to vary day to day (1.25).
 * @param {Object<string, Array>} bySlot - favoritesBySlot's result
 * @returns {string[]}
 */
export function mealsShortOnFavorites(bySlot) {
  return PLAN_SLOTS.filter((slot) => bySlot[slot.key].length <= NUDGE_AT_OR_BELOW).map((slot) => slot.label);
}

export const COPY = {
  // Step labels: one instruction at the top of each page (checklist 1.24).
  // DRAFT pending copy review (C13).
  stepFavorites: 'Select your favorite recipes and foods from everything we recommend for your health profile.',
  stepGenerate: "We'll suggest a meal plan for each day of the week using your favorites.",
  stepDay: 'Keep or remove items for each day to build your plan.',
  stepSave: 'Save a day or week you like so you can reuse it later.',

  stepPick: 'Pick your favorites',
  // How to use page (Home), the interim stand-in for the 9.10 slideshow. DRAFT (C13).
  howToUseNote:
    "Important note: if you change your health profile, we'll remove any favorites and meal plans that are no longer recommended for you, and show you which ones first.",
  planTitle: 'Meal Planner',

  // My Favorites page
  favoritesTitle: 'My Favorites',
  sectionRecipes: 'Favorites',
  sectionDays: 'Favorite Daily Meal Plans',
  sectionWeeks: 'Favorite Weekly Meal Plans',
  groupLabel: 'Group favorites',
  groupRecent: 'Most recent',
  groupMeal: 'By meal type',
  browseRecipes: 'Browse recipes',
  chooseMoreRecipes: 'Choose more recipes',
  emptyTitle: 'No favorites yet',
  emptyBody: 'Save favorites you like and they show up here. Your meal plans are built from them.',
  noSavedDays: 'No Favorite Daily Meal Plans yet. Use Save day on any day of your plan.',
  noSavedWeeks: 'No Favorite Weekly Meal Plans yet. Use Save week on your plan.',
  savedOn: (date) => `Saved ${date}`,
  peekHint: 'Load a day from the plan. Load a week with Load week on the plan.',
  meals: 'Meals',
  dayN: (n) => `Day ${n}`,
  delete: 'Delete',
  deleted: (name) => `Deleted “${name}”`,

  // Plan screen
  caloriesMissing: (n) => `Doesn't include ${n} ${n === 1 ? 'item' : 'items'} without calorie data.`,
  tabPlan: 'My Meal Plan',
  newPlan: 'New meal plan',
  firstRunTitle: 'No meal plan yet',
  firstRunBody: 'Choose your favorite recipes, then build a meal plan around it.',
  firstRunCta: 'Build my meal plan',
  pickFavoritesCta: 'Pick favorite recipes',
  saveWeek: 'Save week',
  saveDay: 'Save day',
  loadDay: 'Load day',
  loadWeekButton: 'Load week',
  addFromFavorites: 'Add from favorites',
  removed: 'Removed from plan',
  unsavedChanges: (name) => `Unsaved changes to “${name}”`,
  save: 'Save',
  saveAsNew: 'Save as new',
  planCreated: 'Meal plan created',
  weekLoaded: 'Week loaded',
  weekLoadedReplaced: 'Week loaded. Unsaved changes were replaced.',
  weekSaved: (name) => `Saved as “${name}”`,
  weekUpdated: 'Saved',
  weekCap: (max) => `You can save up to ${max} weeks. Delete one in My Favorites first.`,
  daySaved: (name) => `Saved “${name}”`,
  dayCap: (max) => `You can save up to ${max} days. Delete one in My Favorites first.`,
  dayLoaded: (name) => `Loaded “${name}” into this day`,
  nothingToSave: 'Nothing to save yet. Build a plan first.',
  couldNotSave: 'Could not save. Try again.',
  couldNotLoad: 'Could not load that. Try again.',
  couldNotBuild: 'Could not build a plan. Try again.',
  couldNotShare: 'Could not share. Try again.',
  copied: 'Copied to clipboard',
  prunePending: 'Still updating your favorites for your new profile. Try again in a moment.',

  // Add-from-favorites sheet (the + tile)
  addTitle: (slotLabel) => `Add to ${slotLabel}`,
  addNone: (slotLabel) => `You have no ${slotLabel} favorites yet.`,
  addAllUsed: (slotLabel) => `All your ${slotLabel} favorites are already in this day.`,
  alreadyInDay: 'Already in this day',
  added: (name) => `Added ${name}`,
  goToFavorites: 'Go to My Favorites',
  chooseMealRecipes: (slotLabel) => `Choose ${slotLabel} recipes`,

  // Name sheets
  nameDayTitle: 'Save this day',
  nameWeekTitle: 'Save this week',
  nameLabel: 'Name (optional)',
  update: (name) => `Update “${name}”`,
  orSaveNew: 'Or save as a new week',

  // Load day sheet
  loadDayTitle: 'Load a favorite day',
  loadDayHint: 'This replaces the meals on the day you are viewing.',

  // New Meal Plan sheet
  newPlanTitle: 'New meal plan',
  randomize: 'Randomize from my favorites',
  randomizeHint: 'Builds a full week in one tap',
  building: 'Building…',
  loadWeek: 'Load a favorite week',
  loadWeekHint: (n) => `${n} saved`,
  loadWeekNone: 'No Favorite Weekly Meal Plans yet',
  loadWeekTitle: 'Load a favorite week',
  loadWeekSheetHint: 'This replaces your whole week. You can undo right after.',
  nudge: 'Tip: pick more than 3 favorites per meal for more variety',
  nudgeShort: (labels) => `Short on: ${labels.join(', ')}`,
  noFavorites: 'None of your favorites fit a meal yet. Pick a few first, then come back.',
  backToOptions: 'Back to new meal plan options',

  // Calorie gap sheet (fires once, right after a week is created)
  gapTitle: "My meal plan doesn't reach enough calories",
  gapQuestion: 'What would you like to do?',
  gapPlanned: (planned, need) => `${planned} cal planned today, target ${need} cal`,
  gapShort: (n) => `About ${n} cal short.`,
  gapContinue: 'Continue',
  gapAddMore: 'Add more favorites',

  // Condition-change notice
  noticeTitle: 'Your favorites changed',
  noticeBody:
    'Your health profile changed. These favorites now rank low for your profile and will be removed from My Favorites, Favorite Daily Meal Plans and Favorite Weekly Meal Plans:',
  noticeOk: 'OK',
};

/** How to Use entries. `key` picks the icon in HowToUseSheet. */
export const HELP_ITEMS = [
  { key: 'add', title: 'Add (+)', body: 'The Add from favorites tile at the end of each meal adds one of your favorite recipes for that meal.' },
  { key: 'remove', title: 'Remove (X)', body: 'The X on a recipe takes it off that day. Undo is right there if you tap it by mistake.' },
  { key: 'day', title: 'Save day / Load day', body: 'Save day keeps the meals of the day you are viewing under a name. Load day replaces that day with one you saved.' },
  { key: 'week', title: 'Save week / Load week', body: 'Save week keeps your whole week under a name; Load week brings one back. If you loaded one of your Favorite Weekly Meal Plans, you can update it or save a new copy.' },
  { key: 'new', title: 'New meal plan', body: 'Builds a fresh week from your favorites in one tap, or loads a week you saved.' },
  { key: 'favorites', title: 'My Favorites', body: 'The My Favorites tab at the top opens your favorite recipes and foods, Favorite Daily Meal Plans and Favorite Weekly Meal Plans.' },
  { key: 'print', title: 'Print & Share', body: 'The icons in the top-right corner print or share a plain, ink-friendly summary of your week.' },
];
