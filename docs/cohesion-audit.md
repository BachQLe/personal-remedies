# Cohesion audit and cleanup (Build Prompt C)

Branch: `cohesion-cleanup`. Styling only. Audited 13 Nov 2026 against the working tree that became commit `88e36c6`.

Sections 1 to 4 were written before any change. Sections 5 and 6 record what was changed and how it was verified.

## 1. The design language the app already has

- **Surfaces.** Lime `forest-300` header band, a `paper-100` content panel with 36px top corners, white cards and rows on top of it.
- **Ink and action colour.** Navy `blue-950` for titles, primary buttons, selected states and the tab bar family. Forest green and the avoid red are signal colours (good for you, avoid), not button colours.
- **Type.** Chillax (`font-display`) for titles, Switzer (`font-sans`) for everything read or tapped, Quantico (`font-label`) for uppercase eyebrows. All sizes are rem, so iOS text-size settings scale the app. The enforced floor is 14px (`src/__tests__/typeFloor.test.js`).
- **Shape.** Five roles, which is what this cleanup makes consistent:

| Role | Radius | Tailwind class in this repo |
|---|---|---|
| Buttons, toggles, slider, inputs, tab bar, toasts | 14px | `rounded-md` |
| Tappable list rows | 10px | `rounded-sm` |
| Photo cards, info notes | 28px | `rounded-xl` |
| Big white cards, content panels, sheets | 36px | `rounded-2xl` |
| Icon buttons, tags, chips, badges | round | `rounded-full` / `rounded-pill` |

Note for anyone editing: this repo overrides Tailwind's radius scale (`tailwind.config.js:178-186`). `rounded-lg` is 20px and `rounded-xl` is 28px here, not 8px and 12px. Code written from memory of Tailwind's defaults is one source of the drift.

## 2. Where the drift came from

- `a096aaa` raised the type floor to 14px by bulk-swapping px sizes, leaving three class names for the same 14px (`text-xs`, `text-sm`, `text-[0.875rem]`).
- `e61d1a4`, `3518445`, `9e943d1` restyled Home, Favorites and recipe cards and spread a navy pill button through Plan and Favorites, while Profile and Paywall kept the older forest-green 6px button from `ds-bundle/`.
- Three design sources disagree: `ds-bundle/README.md` (forest buttons, 6px), `REMEDY_RESKIN_JOBS.md` (pill buttons), `CLAUDE_CODE_BUILD_GUIDE.md` (assumes default Tailwind radii).
- The shared primitives were never adopted: `PrimaryButton`, `Card`, `Pill`, `SearchInput`, `SignalChip`, `StatRing` render only in KitchenSink. Every screen hand-rolls its buttons (92 `<button>` elements in the app).

## 3. Inconsistencies found

Paths are relative to `src/`. Line numbers are from commit `88e36c6`.

### Buttons
- **Two primary styles, nine radii.** Navy pill, 14px label: `screens/plan/MealQueueScreen.jsx:434,521`, `screens/recipes/RecipesScreen.jsx:410`, `screens/favorites/FavoritesScreen.jsx:88`, `screens/plan/CalorieGapSheet.jsx:51`, `screens/plan/NameSheet.jsx:31,65`, `screens/plan/AddFavoriteSheet.jsx:58`, `screens/favorites/FavoritesPruneNotice.jsx:75`, onboarding `RemediWelcome.jsx:35`, `PersonalDetails.jsx:139`, `ConsentStep.jsx:56`, `ProfileBuilder.jsx:150`. Navy 14px corner: `MealQueueScreen.jsx:490` (64px tall, 18px label), `FavoritesScreen.jsx:108`. Navy 28px corner with display font: `components/FoodDetailCard.jsx:727,1005`, `screens/plan/NewPlanSheet.jsx:17`. Forest 6px: `screens/profile/ProfileScreen.jsx:92,166,531`, `screens/paywall/PaywallScreen.jsx:126`, `components/shared/RequireEntitlement.jsx:29`. Others: `ProfileScreen.jsx:68` (forest, 20px), `:573` (charcoal, round), `components/auth/OtpCodeEntry.jsx:168` (charcoal, 6px).
- **The same label styled three ways.** "Create meal plan" at `MealQueueScreen.jsx:490` and `RecipesScreen.jsx:410`; two links to recipes on one screen at `FavoritesScreen.jsx:88` and `:108`.
- **Retry buttons.** Forest 6px in `components/shared/DataState.jsx:77`, `screens/suggestions/ProfileSetupAction.jsx:11`, `FoodDetailCard.jsx:826`, `screens/search/GoodForMeSheet.jsx:93`; navy round in `components/shared/ErrorBoundary.jsx:40,94`. All about 40px tall, under the 44px tap minimum.
- **Secondary buttons.** Seven recipes: `MealQueueScreen.jsx:445,456,544,555`, `screens/home/HomeScreen.jsx:37`, `CalorieGapSheet.jsx:44`, `screens/favorites/SavedPeekSheet.jsx:35`, `NameSheet.jsx:65`, `ProfileScreen.jsx:588`, `components/shared/SecondaryButton.jsx:18`. Several rely on a `border-sand-200` border that is white on a white sheet, so they read as plain text.

### Toggles and the slider
- `components/shared/PillSwitcher.jsx:43-65` is fully round while the tab bar (`components/layout/TabBar.jsx:22-40`) is 14px.
- The `xs` toggle used for Do / Don't (`screens/suggestions/TopDosTab.jsx:87`) and Broad / Narrow (`FoodGroupsTab.jsx:68`) is 28px tall to tap.
- The onboarding age slider (`components/onboarding/PersonalDetails.jsx:63-84`) is fully round with a fixed 46px height that cannot grow with text.

### Do's & Don'ts rows versus food-group rows
- Same container recipe copied by hand in `components/shared/RankedRow.jsx:56`, `screens/suggestions/GroupsTab.jsx:73`, `SuggestTab.jsx:142`.
- Row gap `gap-2` (`TopDosTab.jsx:112`) versus `gap-2.5` (`GroupsTab.jsx:65`, `SuggestTab.jsx:130`).
- Subtitle is 11px at `GroupsTab.jsx:84`, below the floor; this is the one failing test in the baseline.
- Row titles are 16px with a photo and 14px without (`RankedRow.jsx:67`), so the same food reads smaller inside a group.
- Skeletons do not match the rows they stand in for: `CategoryDetailPanel.jsx:69` and `FineGroupDetailScreen.jsx:55` use a 28px corner for a 10px row.

### Titles, eyebrows and text
- Page titles are 32px (`text-title`) on nine headers and 24px on `GroupDetailScreen.jsx:63`, `FineGroupDetailScreen.jsx:140`, `PaywallScreen.jsx:49`.
- Onboarding headings set their font with inline styles and no colour class, so they fall back to warm black while body copy is navy.
- Four eyebrow recipes with two letter-spacings and four colours: `FavoritesScreen.jsx:28`, `ProfileScreen.jsx:743`, `FoodDetailCard.jsx:791`, `SuggestTab.jsx:134` and their copies.
- Two 15px outliers: `ProfileScreen.jsx:357`, `OtpCodeEntry.jsx:123`, `ProfileBuilder.jsx:296`.
- Reading copy (How to use, Important notes, What's new, empty states) is 14px.

### Panels, rows, inputs
- The paper content panel is copy-pasted with eight variants (padding, shadow, radius): `SuggestionsScreen.jsx:79`, `MealQueueScreen.jsx:424`, `FavoritesScreen.jsx:102`, `RecipesScreen.jsx:403`, `ProfileScreen.jsx:736`, `PaywallScreen.jsx:55`, `HowToUseScreen.jsx:20`, `ImportantNotesScreen.jsx:48`, plus `HomeScreen.css:21` at 32px.
- List rows use 10px, 20px and 28px corners: `GroupsTab.jsx:73`, `PaywallScreen.jsx:96`, `SavedList.jsx:28`, `SchedulerView.jsx:50`.
- Six input recipes: `SearchScreen.jsx:423`, `ProfileScreen.jsx:63,326,357`, `NameSheet.jsx:58` (no focus style), `OtpCodeEntry.jsx:149`, onboarding `PersonalDetails.jsx:133`.

### Invisible and mismatched details
- `sand-50/100/200` are all `#FFFFFF`. Skeleton bars inside white rows (`TopDosTab.jsx:46`, `GroupsTab.jsx:52`, `SuggestTab.jsx:100`), the sheet drag handle and title divider (`components/shared/BottomSheet.jsx:135,138`) are white on white.
- Snackbar is 28px (`Snackbar.jsx:59`), the update toast is 14px (`main.jsx:132`).
- Chips with fixed px heights that can clip at large text: `ConditionTag.jsx:25`, `SignalChip.jsx:73`.
- `FoodDetailCard.jsx:777` uses a lucide chevron for "back" where the rest of the app uses the custom back arrow.
- `FoodDetailCard.jsx` and `IngredientSwaps.jsx` use Tailwind's default grey for borders; nothing else does.

## 4. Decisions

**4.1 One button family, navy, 14px corners.** Navy is already the majority primary (13 uses against about 10 forest) and matches the tab bar, the selected day and the toggles. Green stays reserved for "good for you" signals, which keeps a green button from reading as a health verdict. The 14px corner was confirmed with Bach ("the same squarishness"); it is the tab bar's corner, so the most visible control in the app sets the rule. Labels are 16px, height at least 56px, because the audience is older and the previous 14px labels on 44 to 48px buttons were the smallest primary actions in the app.

**4.2 Standards live as named classes in `src/index.css`.** `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`, `.field`, `.eyebrow`, `.list-row`, `.paper-panel`, next to the existing `.tap-target`. Each call site becomes a class swap with no change to the JSX structure, which is what "styling only" allows. Adopting the unused `PrimaryButton` component instead would have meant replacing elements and props in 40 places.

**4.3 Toggles and the slider take the same corner.** Track 14px, thumb 10px so the inner corner is concentric with the 4px inset. The small Do / Don't and Broad / Narrow toggles keep their look but get a 44px hit area through `.tap-target`.

**4.4 Do's & Don'ts rows and food-group rows share `.list-row`.** Same gap, same title size, same skeleton corner. The 11px subtitle returns to 14px.

**4.5 Nothing gets smaller.** Reading copy and button labels go up to 16px; row titles are 16px everywhere; the 11px and 15px outliers go up. No size is reduced anywhere.

**4.6 Secondary buttons get a visible border** (`blue-950/15`) instead of the white-on-white one, so they read as buttons on sheets.

**4.7 White-on-white placeholders use `paper-200`.** The `sand` token itself is left alone: changing it would recolour 40 borders at once, which is a redesign, not a cleanup.

**4.8 Kept on purpose.** Round icon buttons (back, save, close), pill tags and chips, the photo-card radius, the compact 36px pills on Home and Plan (radius only), the green and red thumbs on the Eat / Avoid toggle, every animation and gesture.

## 5. Skipped, and why

| Item | Why |
|---|---|
| GlassPanel on the group-detail screens and Search's glass panel versus the paper panel | Different component and wrapper structure; swapping is a layout change. |
| One empty-state and one loading pattern everywhere | Needs different elements, not different classes. |
| Duplicate save-button logic in FoodDetailCard, Snackbar mounted twice, sheet z-index order | Behaviour, not styling. |
| Replacing the Material Symbols icon font (ProfileBuilder, ConditionTag, Profile) | Swaps glyph elements and loading. |
| Deleting or adopting the unused shared components | Not needed for cohesion; a separate tidy-up. |
| Renaming the three class names for 14px | No visible change, 260 edits of pure churn. |
| Marketing pages and KitchenSink | Out of the product app. |
| DailyPicks swipe flow | It no longer exists (removed in `63ba737`). The remaining swipe and drag code (Plan day swipe, card drag-to-dismiss) was not touched. |

## 6. Calls flagged for Bach

1. **All remaining 14px text to 16px.** About 250 captions, eyebrows and secondary lines are still 14px. Raising them all would be good for the audience but changes wrapping on nearly every screen, which is more than a light cleanup.
2. **The sage colours on the onboarding conditions step** (`ProfileBuilder.jsx`, seven private hex values). They differ from the rest of the app's tokens but are recent deliberate work, so they were left.
3. **The Eat / Avoid toggle uses `red-600`** while every other "avoid" uses the `avoid` token. Changing a signal colour was left for a decision.
4. **No typecheck exists.** The repo is plain JSX with no TypeScript config, so "typecheck passes" cannot be confirmed; build, tests and lint stand in for it.

## 7. Baseline before changes

- Tests: 1 failed, 1112 passed (the failure is the 11px class in `GroupsTab.jsx`).
- Lint: 60 errors, 3 warnings, all in files outside this cleanup (`ds-bundle/`, `nutridigm-mcp/`, `scripts/`, marketing, KitchenSink, PhoneFrame) plus one warning in `FoodDetailCard.jsx`.
- Before screenshots: `output/cohesion/before/normal/` and `output/cohesion/before/largest/` (393 × 852, WebKit; "largest" is a 53px root size, the largest iOS accessibility setting).

## 8. What changed, screen by screen

Screenshots are local (the `output/` folder is gitignored). Each scene exists four times: `output/cohesion/{before,after}/{normal,largest}/<file>.png`. They are regenerated with `node .qa_tmp/cohesion-shots-app.mjs <dir>` and `node .qa_tmp/cohesion-shots-flows.mjs <dir>` against a running dev server.

| Screen | Change | Screenshot file |
|---|---|---|
| Home | Panel corner 32px to 36px; "How to use" / "Important Notes" pills take the 14px corner; "Today's meals" label uses `.eyebrow` | `01-home` |
| Choices: Dos & Don'ts | Tabs and Do / Don't toggle squarish, toggle taps at 44px; rows use `.list-row` with the food-group gap; "Show more" is a bordered secondary button; subtitle contrast up | `02-choices-dos`, `03-choices-donts` |
| Choices: Food Groups | Rows share `.list-row`; the 11px uppercase sub-line is 14px sentence case; group headers use `.eyebrow`; skeleton bars visible | `04-choices-groups-broad`, `05-choices-groups-narrow` |
| Choices: Top Recipes | Panel uses `.paper-panel` (no visible change intended) | `06-choices-top-recipes` |
| Group detail, fine-group detail | Title 24px to 32px; food names 14px to 16px; Eat / Avoid toggle squarish; row gap and skeleton corner match the rows | `07-group-detail`, `08-group-detail-avoid`, `09-fine-detail` |
| Choose recipes | "Build my meal plan" is the standard navy button with a 16px label | `10-recipes`, `11-plan-empty-redirect` |
| Favorites | "Browse recipes" and "Choose more recipes" are the same button; select and saved rows take the squarish and row corners | `12-favorites-empty`, `13-favorites-filled` |
| Plan | "New meal plan" squarish; Save week / Load week and Save day / Load day are one grey squarish style at 44px (the day pair was 36px); section labels use `.eyebrow` | `14-plan-filled` |
| Search | Field squarish with a navy focus border (was amber); result titles 14px to 16px; "Check against my profile" squarish; section labels use `.eyebrow` | `15-search-empty`, `16-search-results`, `40-search-good-for-me-sheet` |
| Profile | Green 6px buttons become the navy standard; inputs are 16px with a visible border; condition picker and its search squarish; calorie presets squarish with a navy selected state; Delete is the danger button, Cancel a bordered secondary | `17-profile`, `47` to `51` |
| Important notes, How to use, What's new | Reading copy 14px to 16px; panels and labels use the shared classes | `18-important-notes`, `19-how-to-use`, `49-profile-whats-new-sheet` |
| Paywall (not reachable today) | Title 32px; navy button; rows take the row corner | `20-paywall` |
| Onboarding | Four Continue buttons squarish; headings navy and set by class; name field, age slider and condition search squarish | `30` to `34` |
| Food and recipe card | Both main buttons are standard buttons (no display font); "Overview" uses the app's back arrow with a 14px corner; link rows take the row corner; borders faint navy; labels use `.eyebrow` | `35` to `38` |
| Sheets (Plan, Favorites, Recipes) | Drag handle and title divider visible; primary and secondary buttons standard; name field uses `.field` | `39`, `41` to `46` |
| Login | Navy standard button, navy heading, bordered Google button | `52-login` |

Two standards were adjusted after verification and are part of the shared set:

- `.btn-secondary` carries `border-solid`. The repo's base rule `button { border: none }` otherwise removes the border, which is also why the old white-bordered buttons never showed one.
- `.row-title` (16px, capped at `11.8vw`) is used only for titles that were 14px before. It keeps them 16px at normal sizes and no wider than the old 14px text at the largest accessibility size, so names such as "Swordfish" do not break mid-word there.

## 9. Verification

Done by two agents that made none of the changes, with their claims spot-checked against the images and the code.

- **Screenshots.** 43 scenes × 2 text sizes, before and after (172 images). Automatic checks (horizontal overflow; text elements wider or taller than their box) are identical before and after in all 86 after captures; no scene overflows horizontally.
- **Build.** `npm run build` passes.
- **Tests.** 1113 of 1113 pass (baseline: 1 failing).
- **Lint.** 60 errors and 3 warnings, the same count and the same files as the baseline; none in files this cleanup touched except one pre-existing warning in `FoodDetailCard.jsx`.
- **Typecheck.** Not run: the repo has none.

Known and left as found:

- At the largest text size the onboarding steps 2 to 4 already clipped the name field, checkbox and Continue button off-screen before this work, and still do. Fixing it needs layout changes.
- At the largest text size the Choices tabs, the small toggles and several long words already broke mid-word before this work. The cleanup does not add new breaks in titles. The food-group sub-line, which used to be a fixed 11px that ignored the text-size setting, now scales with it and wraps more.
- In the "Overview" control the back arrow looks light next to the label at the largest text size.
- The Name sheet's "Update" button label is 16px instead of 14px, so at the largest size it wraps to three lines instead of two.
- One false alarm worth recording: the recipe card button reads "Open recipe" or "View recipe at …" depending on live data (`src/utils/foodDetailCard.js`); the cleanup did not change it.
