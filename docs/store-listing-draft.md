# Store listing draft (checklist #66, #72)

Prepared 4 Oct 2026 for Mory. Nothing here is submitted or final. Anything that depends on a decision that is still open is marked **OPEN**, with what has to be decided. Privacy answers come from `docs/storage-map.md` and from reading the code, not from guesses; they must be re-checked against the final privacy policy (`docs/privacy-terms-gap-review.md`).

## Decisions that change this document

| Open item | Affects | Decision needed |
|---|---|---|
| App name ("Personal Remedies", decided) | Name, subtitle, description, keywords, screenshots | Mory picks one name before the trademark and App Store collision check (master plan C7) |
| Pricing and free/paid split (master plan C10) | Description paragraph about pricing, in-app purchase answers, "Purchases" privacy row, age/promo text | Free vs paid, price, trial strategy |
| Nutridigm proxy deployment (who hosts it, what it logs) | Whether health data counts as "collected" by a third party, Data Safety "shared" answer | Where the proxy runs, and Nutridigm's log retention |
| Account deletion not built yet | Both privacy forms ("users can request deletion"), App Review | Build it (see `privacy-terms-gap-review.md` section 1) |
| Legal entity and support URL | "Seller" name, privacy policy URL, support URL | Mory (open questions #4 and #11 in `questions-for-mory-store-submission.md`) |
| Image hosting (Unsplash hot-links in `src/api/ingredientImages.js`) | Whether a third party sees user network addresses | Bundle images or disclose |
| Native conversion (Phase 8) | Everything: the app is a web app today with no bundle ID, no 1024x1024 icon and no screenshots | Phase 8 must happen first |

## 1. Listing text

### App name

`[APP NAME]` (30 characters maximum on both stores). OPEN: name not chosen. Do not put condition names or claims in the name field.

### Subtitle (Apple, 30 characters maximum)

Option A, 30 characters: **Food ideas for your conditions**
Option B, 29 characters: **Meals matched to your profile**

Option B avoids naming conditions and is lower risk against `docs/health-claim-audit.md`. Recommend B. (Google Play uses a "short description" of up to 80 characters instead; see below.)

### Promotional text (Apple, 170 characters maximum; can be changed without a new build)

> Pick your health topics, see foods and recipes ranked for them, then build a weekly meal plan around the results. General information, not medical advice.

154 characters.

### Google Play short description (80 characters maximum)

> Foods and recipes ranked for your health topics. Not medical advice.

(68 characters.)

### Description (Apple 4,000 maximum; Google 4,000 maximum)

> [APP NAME] helps you find foods and recipes that fit the health topics you care about.
>
> Choose the health conditions, allergies and dietary preferences that matter to you. [APP NAME] then ranks everyday foods against your profile, so you can see which are rated higher and which are rated lower for each condition you picked, using a star-and-skull rating you can read at a glance.
>
> WHAT YOU CAN DO
> - Browse "Best & Worst Choices" across food groups, ranked for your profile
> - Look up any food and check how it is rated against your profile
> - Get recipe ideas that match your profile, with links to the original recipe source
> - Build a weekly meal plan with breakfast, lunch, dinner and snack slots, shuffle ideas, and swap items
> - Save recipes to your own cookbook and keep saved plans to reuse
> - See rough nutrition estimates for your plan, and look up which foods are richest in a nutrient
> - Print or share your plan
> - Optional: sign in with your email to back up your profile, saved recipes and plan, and pick them up on another device
>
> WHERE THE INFORMATION COMES FROM
> Food guidance comes from Nutridigm. Nutrient numbers come from the USDA FoodData Central database. Recipes link to their original publishers.
>
> IMPORTANT
> [APP NAME] provides general food and nutrition information for educational purposes. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. It is not a substitute for advice from your doctor or another qualified health professional. Always check with your doctor before changing your diet, especially if you have a medical condition or take medication.
>
> [OPEN, PRICING: add one sentence once the free/paid split and price are decided, for example "Core features are free. [Plan name] unlocks [features] for [price] per [period]." Apple requires renewal and cancellation terms to be stated if there is a subscription.]
>
> Published by [LEGAL ENTITY NAME]. Privacy policy: [URL]. Terms: [URL].

Notes on this draft:

- The "not a medical device and does not diagnose, treat, cure, or prevent any medical condition" sentence is Google's required wording for non-medical health apps (https://support.google.com/googleplay/android-developer/answer/16679511). It is included on purpose.
- It does not say "helps manage" or "improves" any condition. Keep it that way (`health-claim-audit.md` rows A3 and A7).
- It does not name Food Network or MedlinePlus as partners, to avoid implying endorsement. Attribution of sources is already in the app (Important Notes screen). OPEN: Mory to confirm what the content terms with those sources allow.
- Every feature listed exists in the code today. "Nutrient look-up" is the Natural Sources screen (`NutrientSources.jsx`); the master plan had it as a possible "Coming soon", so confirm it is on by release. The paywall is a placeholder, so nothing about paid features is stated.
- Ingredient lists for recipes are deliberately not mentioned (checklist #31 was dropped).

### Keywords (Apple, 100 characters maximum, comma-separated, no spaces after commas)

> food,nutrition,meal plan,recipes,diet,allergies,healthy eating,grocery,cookbook,meal prep,diabetes

98 characters. Do not repeat the app name, the category, or competitor names. The last word is the only condition name; it is allowed but is the one most likely to draw a reviewer's attention to medical use, so drop it if the audit is not fully clear. OPEN: final keywords depend on the app name.

### Category

- **Primary: Health & Fitness.** Secondary: **Food & Drink**.
- Do not choose "Medical". It increases scrutiny under Apple guideline 1.4.1 and is not an accurate description: the app makes no diagnosis.
- On Google Play: category "Health & Fitness" (not "Medical"), and complete the **Health apps declaration** in Play Console, App content. Select that it is a non-medical health app (nutrition and diet information).

### Age rating notes

Both stores use a questionnaire; the final rating comes from the answers. Answer from what the app does:

- No user-generated content, chat, social features, gambling, or purchases of real goods.
- **Medical or wellness topics:** yes. The app discusses health conditions and diet.
- **Alcohol, tobacco and drug references:** the lifestyle items in the guidance include "Keeping an eye on alcohol" and a quit-smoking block (`src/data/nonFoodGuidance.js`). These are informational and discourage use, so answer "infrequent / mild" where the form asks, not "none".
- **Web access:** recipe cards open the original publisher's website in a browser. Answer according to Apple's current wording for links that leave the app (it is not an unrestricted browser).
- **Children:** the app is for adults. The onboarding age choices are "Adult" and "Senior (65+)" only. Do not enrol in the Kids category. Apple should land at a low rating (4+ to 12+ depending on the medical and substance answers); I cannot confirm the exact number without running the questionnaire, so run it in App Store Connect and record the result here.
- Google: complete the IARC questionnaire. Target audience: 18 and over (OPEN: Mory to confirm, and to match the privacy policy's children wording).

## 2. Apple App Privacy ("nutrition label") answers

Apple's definitions (https://developer.apple.com/app-store/app-privacy-details/): data counts as **collected** when it leaves the device and can be accessed for longer than needed to serve a request in real time. Data processed only on the device is not collected. **Linked to you** means connected to an account or identity. **Tracking** means linking with third-party data for advertising or sharing with a data broker. User-entered health information goes under Health & Fitness > Health, not "Other user content".

Key fact driving most answers: by default everything stays on the device. Data leaves the device in two cases: (a) signed-in sync to Supabase, and (b) condition and food identifiers sent to Nutridigm with each guidance request.

| Apple data type | Collected? | Linked to user? | Used for tracking? | Purpose | Source of the answer |
|---|---|---|---|---|---|
| Contact Info: Email Address | Yes, only if the user signs in to back up | Yes | No | App functionality (account) | Supabase login, `AuthContext.jsx:127` |
| Contact Info: Name | Yes, only if signed in (first name is inside the synced profile) | Yes | No | App functionality (personalization) | `PersonalDetails.jsx`, `profileSync.js` (`preferences` blob) |
| Health & Fitness: Health (conditions, allergies, medications, dietary pattern) | Yes, only if signed in | Yes | No | App functionality | `profileSync.js`; columns `conditions`, `preferences` |
| Health & Fitness: Health, sent to Nutridigm | See below | See below | No | App functionality | `nutridigm.js` request URLs carry condition IDs |
| Sensitive Info (religious dietary restriction, listed under "religious beliefs") | Yes, only if signed in, and only if the user sets it | Yes | No | App functionality | `religiousRestriction` field in the synced profile |
| User Content: Other User Content (saved recipes, meal plans, saved plans) | Yes, only if signed in | Yes | No | App functionality | `library`, `daily_plan` columns |
| Identifiers: User ID | Yes, only if signed in (Supabase account ID) | Yes | No | App functionality | Supabase `auth.users` |
| Purchases | **OPEN** | OPEN | No | App functionality | Depends on whether in-app purchase ships and through RevenueCat (master plan 6.3) |
| Usage Data, Diagnostics, Location, Contacts, Photos, Search History, Advertising Data | No | n/a | n/a | n/a | No analytics, crash or ad SDK in `package.json` or `src/`. Recent searches are kept on the device only (`storage-map.md`). |

**Nutridigm row, OPEN.** Each ranking request sends the user's condition IDs (and food or group IDs) to Nutridigm, through a proxy in production (`src/api/config.js`). It carries no name, email or account ID. Apple counts it as "collected" only if it can be accessed longer than needed to serve the request. If the proxy or Nutridigm logs requests with network addresses, answer Yes, Health, **not linked** to the user (no identifier), not used for tracking. Needed: where the proxy runs and what Nutridigm and the host log. Until known, the cautious answer is to declare Health as collected, not linked.

**Tracking: No.** No data is combined with other companies' data and none goes to a data broker. This lets Apple's App Tracking Transparency prompt be skipped.

**Optional disclosure.** Email sign-in is optional, but Apple's optional-disclosure exemption does not apply because account data is a core feature when used, so declare it.

**Account deletion and the answer "Yes, users can request deletion".** Apple does not ask this on the label, but 5.1.1(v) requires in-app deletion. Not built yet.

## 3. Google Play Data Safety answers

Google's questions (https://support.google.com/googleplay/android-developer/answer/13327111 for deletion; the Data safety form in Play Console, App content): for each type, is it collected, is it shared, is it optional, why.

Definitions used: **collected** = transmitted off the device; **shared** = transferred to a third party, except a service provider processing data on the developer's behalf, and except transfers the user starts. Supabase and the host are service providers; Nutridigm is a data source whose handling is OPEN.

| Google data type | Collected | Shared | Required or optional | Purpose |
|---|---|---|---|---|
| Personal info: Email address | Yes (only if signed in) | No | Optional | Account management, app functionality |
| Personal info: Name | Yes (first name, only if signed in) | No | Optional | App functionality, personalization |
| Personal info: User IDs | Yes (only if signed in) | No | Optional | Account management |
| Personal info: Religion or beliefs (religious dietary restriction) | Yes (only if set and signed in) | No | Optional | Personalization |
| Health and fitness: Health info (conditions, allergies, medications) | Yes (only if signed in) | **OPEN** | Optional for sync; the app needs at least one condition to give rankings | App functionality, personalization |
| App activity: Other user-generated content (saved recipes, plans) | Yes (only if signed in) | No | Optional | App functionality |
| App activity: In-app search history | No (stays on device) | n/a | n/a | n/a |
| Financial info / purchase history | **OPEN** | OPEN | OPEN | Depends on in-app purchase |
| Device or other IDs, Location, Contacts, Photos, App info and performance | No | No | n/a | n/a |

Other Data Safety questions:

- **Is all data encrypted in transit?** Yes. The Supabase and Nutridigm endpoints are HTTPS (`config.js`, Supabase URL). Confirm the proxy URL is HTTPS before answering.
- **Do you provide a way for users to request data deletion?** The honest answer today is **No**. It becomes Yes once in-app deletion and a web deletion page exist. Google requires both (in-app path, and a web link a person can use after uninstalling). OPEN: blocked on building them.
- **Data shared (Health info):** if Nutridigm is treated as a third party receiving health information, Google wants it declared as shared. OPEN, same decision as the Apple Nutridigm row.
- **Data used for advertising or sold:** No.
- **Health apps declaration (separate Play Console form):** complete it; state non-medical, with the required disclaimer in the description. The privacy policy URL must be public and also be reachable inside the app (Google and Apple both say so). Apple 5.1.1(i) says the same.
- **Independent security review:** optional; skip for 1.0.
- Release plan: iOS 1.0, Android in 2.0 (master plan C9), so the Google form can wait, but keep this table in step with the Apple one.

## 4. Screenshot shot-list

None exist yet (repo has only two PWA icons and a favicon). Apple needs at least the 6.9-inch size (1320 x 2868) and 6.5-inch; the 1024 x 1024 App Store icon is also missing. Use a signed-in test profile with two or three conditions chosen, and demo data that is real and covered (the app shows a "demo guidance" notice for conditions not covered, `coverageMessage.js`; make sure that banner is not in any screenshot). Avoid screenshots where a screen shows "Helps" or "harmful" until the wording is changed (`health-claim-audit.md` A7, A8); those labels would appear in the store image otherwise. Captions below are drafts and avoid claims. Order is the order they should appear.

| # | Screen (route) | Show | Caption (draft) |
|---|---|---|---|
| 1 | Onboarding welcome (`RemediWelcome`) | The salad image and headline | "Find foods that fit your needs, one small step at a time." |
| 2 | Health profile builder (`/onboarding`, `ProfileBuilder`) | Several topics selected as chips | "Choose the health topics that matter to you." |
| 3 | Home (`/app/home`) | Meal carousel with recipe cards | "Meal ideas matched to your profile." |
| 4 | Best & Worst Choices (`/app/suggestions`) | A ranked list with stars and the tab strip | "See which foods are ranked higher or lower for you." |
| 5 | Food detail card | One food, with its rating and per-condition list | "Check any food against your profile." |
| 6 | Good for me? sheet (`GoodForMeSheet`) | A search result and its summary | "Look up a food and see how it is rated." |
| 7 | Recipes (`/app/recipes`) | A grid of recipes | "Recipe ideas that link to their original source." |
| 8 | Meal plan (`/app/plan`) | A filled week with four meal slots | "Build a weekly meal plan." |
| 9 | Nutrient look-up (`NutrientSources`) | A nutrient with the ranked foods list | "Find foods rich in the nutrients you want." |
| 10 | Profile and Important Notes (`/app/profile/important-notes`) | The medical disclaimer text visible | "General information only. Always check with your doctor." |

Screenshot 10 is deliberate: Apple 1.4.1 wants the doctor reminder to be clear to the user, and showing it in the store images also helps a reviewer see it.

## 5. App Review notes (for the "Notes for Review" field)

Apple 2.3.1(a) requires features to be described specifically. Draft:

> "[APP NAME] gives general food and nutrition information ranked against the health conditions a user selects. It does not diagnose or treat anything, and a doctor reminder is on the Profile > Important notes screen [and in onboarding once added]. Food ranking data comes from Nutridigm (licensed). No account is required to use the app; signing in with email (one-time code) is optional and backs up the profile. To test: [demo account email OPEN: create one, and tell reviewers how to receive the code]. Account deletion is at Profile > [OPEN: not built]."

OPEN: reviewers cannot receive an email code at an unknown address, so a test account or a bypass will be needed (Apple requires working demo credentials if sign-in is needed to review a feature).

## 6. Checklist before pressing Submit

1. Name decided and cleared (C7). 2. Entity, support URL and privacy URL decided. 3. Account deletion built. 4. Audit rows A1, A3, A4, A7 fixed. 5. Doctor reminder visible beyond the Important Notes page. 6. Nutridigm and proxy logging answered. 7. Pricing decided, and the IAP and "Purchases" answers added. 8. Icon and screenshots produced. 9. Age rating questionnaire run and result written down. 10. Privacy forms re-read against the final privacy policy.
