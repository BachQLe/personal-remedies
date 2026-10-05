# Privacy policy and Terms of Use: gap review (checklist #61, #62)

Prepared 4 Oct 2026 for Mory. **This document is a gap list with draft wording. It is NOT LEGAL ADVICE.** Every draft block below is marked DRAFT and needs review by a lawyer before it goes live. Facts about what the app does come from `docs/storage-map.md` and from reading the code; where a fact is not known, it says OPEN.

Policy references: Apple 5.1.1(i) requires the privacy policy to "identify what data, if any, the app/service collects, how it collects that data, and all uses of that data", to confirm third parties give equal protection, and to "explain its data retention/deletion policies and describe how a user can revoke consent and/or request deletion". https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage Google Play requires an in-app account deletion path plus a web deletion link for apps with accounts: https://support.google.com/googleplay/android-developer/answer/13327111

## 1. Plain answer on account deletion

**The app has no way to delete an account, in the app or anywhere else.** I searched `src/` for delete-account, remove-account and similar. The only account actions are "Sign out" (`ProfileScreen.jsx:575-749`, `AuthContext.jsx:142`) and "Back up & sync" (email, then a 6-digit code). `clearProfile()` exists in `src/api/api.js` but is not connected to any button (`docs/storage-map.md` says so too). The database removes a user's profile row automatically if the login record is deleted (`on delete cascade`, `supabase/migrations/20260624000000_init_schema.sql:84`), but nothing in the app or the backend lets a user trigger that. Deleting a login in Supabase also needs a server-side call with an admin key, which cannot live in the client app.

**Apple 5.1.1(v): "If your app supports account creation, you must also offer account deletion within the app."** Remedi supports account creation (entering an email creates a Supabase account). So as it stands this would be a rejection. Google has the same rule plus a web page for it.

What has to be built (code, not for this document): a "Delete my account" row in Profile with a confirm step; a small server function (for example a Supabase Edge Function using the service key) that deletes the login, which cascades to the synced profile row; clearing local data on the device afterward; and a public web page or email address for deletion requests for Google. Decision for Mory: whether deletion is immediate or has a short grace period.

## 2. What the current text says

### Privacy policy (`src/pages/marketing/PrivacyPolicy.jsx`, "Last updated: January 2026", about 110 lines, 5 short sections)

- Intro: "operate under a strict set of privacy principles" (none are listed).
- Information we collect: "we do not require disclosure of any information that can identify a user or visitor, such as a name or address." Health information is gathered "if and when" offered voluntarily, "to ensure better service and to provide you a more personalized experience."
- Membership: individual paid members give "name and address"; corporate clients' individuals give none.
- Security: "your personal information is not shared with any other party." User is responsible for their passwords.
- Contact: "let us know" (no address or email given); "Any changes … will be promptly disclosed in these pages."

### Terms of Use (`src/pages/marketing/TermsOfUse.jsx`, "Last updated: January 2026")

Covers: agreement and acceptance by use, minors (parent permission under 18; none under 13), a long medical disclaimer, content ownership and copyright notice, prohibited activity, no warranties and a liability disclaimer, termination, changes, Massachusetts governing law, notices "by email to the address listed below" (no address is listed), and session cookies.

## 3. Statements in the current text that are not true for the app

These are more serious than omissions, because Apple and Google compare the privacy policy with the nutrition-label answers.

| Current text | What the app actually does | Source |
|---|---|---|
| "we do not require disclosure of any information that can identify a user" | Onboarding requires a first name and age group (`PersonalDetails.jsx:97`). Back-up requires an email address. Both are stored. | `docs/storage-map.md` §1, §3 |
| "your personal information is not shared with any other party" | Condition IDs are sent to Nutridigm on every ranking request (through a proxy in production). The synced profile lives with Supabase, a hosting provider. Food photos load from a third-party image host (Unsplash URLs in `src/api/ingredientImages.js`). | `src/api/nutridigm.js`, `profileSync.js` |
| Paid members give "name and address" | There is no checkout in the app. Purchases will go through Apple or Google (RevenueCat is planned). Remedi will not see a postal address. | `PaywallScreen.jsx`, master plan 6.3 |
| Terms: Company provides "a platform for providers of health and wellness services … and for Company to sell products" | The app does not host providers or sell products. | Whole app |
| Terms: copyright notice "©2017, Personal Remedies, LLC" and footer "© 2026 Personal Remedies, LLC" | Different years; and the in-app publisher credit is "Simple Software Publishing — Mory, Bach, Sunny" (`importantNotesContent.js`). | see §5 |
| Terms: "We use session cookies" | The app uses browser local storage and Supabase session tokens, not only session cookies. In a native app there are no cookies at all. | `storage-map.md` §1, §4 |

## 4. What the policy is missing

Each gap lists why it matters and a draft paragraph. All drafts are DRAFT. Square brackets are decisions. Where a draft states a fact about the app, I have checked it against the code today; where a fact depends on deployment (the proxy, the Supabase region), it is marked OPEN.

### Gap 1: what data is collected, and where it is stored

Missing entirely. This is the core of Apple 5.1.1(i).

Facts from the code: the profile holds first name, age group, health conditions (numeric Nutridigm IDs), allergies, dietary pattern, religious dietary restriction, medications (free text such as "Metformin 500mg", `ProfileScreen.jsx:771`) and a daily calorie target. The app also stores saved recipes, the weekly meal plan, saved plans, recent searches, and a "cooked" tracker. All of this stays in the browser's local storage on the device unless the user signs in. After sign-in, the profile, saved recipes and meal plan are copied to a Supabase table called `profiles` (columns `conditions`, `preferences`, `library`, `daily_plan`, and a timestamp). The email address lives in Supabase's login records. The cooked tracker, recent searches and sync bookmark are never uploaded.

> **DRAFT — NOT LEGAL ADVICE**
> **What we collect.** [APP NAME] stores the information you enter so it can personalize food guidance: your first name and age group; the health conditions, allergies, dietary pattern, religious dietary restriction, medications and daily calorie target you choose to add; the recipes you save; and your meal plans. Health-related information is optional, but the app cannot rank foods for you without at least one health condition. If you create an account to back up your information, we also collect your email address.
> **Where it is stored.** By default this information is stored only on your device. If you choose "Back up & sync" and sign in with your email, a copy of your profile, saved recipes and meal plan is stored on our cloud database, which is provided by Supabase [region: OPEN — see Supabase project settings], and is protected so that only your account can read it. Your searches and your "cooked" history stay on your device and are not uploaded.

### Gap 2: health data, sensitivity and consent

The policy says health information is gathered "if and when" offered. It does not say that health data is sensitive, why it is collected, or how consent is given. Apple 5.1.1(ii) requires consent for collection and an easy way to withdraw it; Google requires affirmative user action before collecting personal and sensitive data (`docs/terms-consent-research.md` recommends one explicit tick before the conditions step). Today onboarding has no consent step before conditions are entered (only the Important Notes screen, reachable later from Profile).

> **DRAFT — NOT LEGAL ADVICE**
> **Your health information.** The health conditions, allergies and medications you enter are sensitive. We use them only to rank and filter foods and recipes for you inside the app. We do not use them for advertising, we do not sell them, and we do not share them with advertisers or data brokers. By continuing past the health-information step you agree that we may process it for this purpose. You can change or remove any item at any time in Profile, and you can withdraw your consent by deleting your account (see "Deleting your data").

Also needed in the app (not in the policy): an acknowledgement control before the conditions step.

### Gap 3: sync, retention and deletion

Missing. Apple 5.1.1(i) requires retention and deletion practices and how to request deletion. Today: local data is removed only if the user clears browser data or uninstalls; cloud data cannot be removed by the user (section 1).

> **DRAFT — NOT LEGAL ADVICE**
> **Keeping and deleting your data.** We keep your cloud-synced information for as long as your account exists. You can delete your account in the app at Profile > [Delete my account] [OPEN: this button does not exist yet]. Deleting your account permanently removes your email address and your synced profile, saved recipes and meal plans from our servers [within X days — OPEN: decide; backups may keep copies for up to Y days — OPEN]. Information stored only on your device is removed when you delete the app or clear its data. You can also request deletion by emailing [SUPPORT EMAIL].

### Gap 4: third parties and processors

Missing. The policy must name who else touches data. What each one gets, from the code:

| Third party | What they receive | Notes |
|---|---|---|
| **Supabase** (database and login) | Email address, login session, and the synced profile, saved recipes and meal plan | Signed-in users only. Row security limits reads to the owner (`storage-map.md` §3). |
| **Nutridigm** (food guidance data) | Condition IDs and food or food-group IDs in each request, plus the device's network address | Sent through a proxy in production (`NUTRIDIGM_PROXY_URL`). In direct mode the app sends its own subscription ID. Whether the proxy and Nutridigm keep logs, and for how long: OPEN, ask Nutridigm. The requests carry no name or email. |
| **Vercel** (hosting, `vercel.json`) | Ordinary web-server request data (network address, browser type) for the web app. The proxy, if hosted there, would see the same on API calls. | Where the proxy is hosted is OPEN. Not relevant to a native app's downloaded code, but still relevant to API calls. |
| **USDA FoodData Central** | Nothing at runtime. Nutrient numbers were downloaded ahead of time and bundled in the app (`docs/usda-pipeline.md`). | Say so; this is a feature. |
| **Image host (Unsplash)** | Network address when a food photo loads | Only if photos are still hot-linked at release (`src/api/ingredientImages.js`). OPEN: confirm, or bundle images. |
| **Recipe sources** (medlineplus.gov, foodnetwork.com) | Whatever those sites collect once a user taps through to the recipe | Links open the original site. |
| **Apple / Google, RevenueCat** | Purchase information | OPEN: only if in-app purchase ships. |
| **Analytics or crash reporting** | None. There is none in `package.json` or `src/`. | If this stays true, the policy can say so. |

> **DRAFT — NOT LEGAL ADVICE**
> **Who else is involved.** We use a small number of service providers to run [APP NAME]: Supabase (account sign-in and cloud storage of your synced information), [hosting provider] (to deliver the app), and Nutridigm (the source of our food guidance). When you view food guidance, the app sends Nutridigm the identifiers of the health conditions in your profile and of the foods you are viewing, but not your name or email address [OPEN: confirm Nutridigm's retention]. Food photos may be loaded from [image host]. Recipe links take you to the original publisher's site, which has its own privacy practices. We do not use advertising or analytics services, and we do not sell or rent your personal information to anyone. These providers may process your information only to provide their service to us.

### Gap 5: what we do not do (sale, advertising, tracking)

Missing. The old line "not shared with any other party" tries to say this but is untrue (gap list in section 3). If Mory confirms there is no ad SDK and no data sale, this sentence also supports the App Privacy answers (`docs/store-listing-draft.md`).

> **DRAFT — NOT LEGAL ADVICE**
> **What we do not do.** We do not sell your personal information. We do not use it for advertising, we do not track you across other companies' apps or websites, and we do not combine it with data from other sources to profile you.

### Gap 6: children

Terms say under 13 may not register and under 18 needs a parent. The privacy policy says nothing. The app asks for an age group with only "Adult" and "Senior (65+)" options (`PersonalDetails.jsx`), so a child has no true option. Apple's age rating and Google's target audience answers must match.

> **DRAFT — NOT LEGAL ADVICE**
> **Children.** [APP NAME] is intended for adults. We do not knowingly collect information from anyone under 13 [OPEN: or under 16 for users in the EU/UK; or 18 — decide]. If you believe a child has given us information, contact [SUPPORT EMAIL] and we will delete it.

### Gap 7: your rights, contact, and who to ask

The policy gives no contact. The only email in the code is `hello@personalremedies.com` (`importantNotesContent.js`, `Contact.jsx`), and the Terms refer to "the address listed below" with none listed. Apple requires a support URL in the listing, and Google needs a deletion-request page. The privacy policy needs a real address, and Mory needs to decide whether `personalremedies.com` stays the domain if the app is renamed.

> **DRAFT — NOT LEGAL ADVICE**
> **Your choices and contact.** You can view and edit your information in the app. You can ask us to give you a copy of your information or delete it by emailing [SUPPORT EMAIL] [OPEN: decide address and who answers it]. We will respond within [30] days. Residents of certain places (for example California, the EU and the UK) have additional rights; contact us to exercise them. [OPEN: decide which jurisdictions to name.]

### Gap 8: security

The current security paragraph only tells the user to protect their password, but there are no passwords: sign-in is by emailed code. Draft:

> **DRAFT — NOT LEGAL ADVICE**
> **Security.** Data sent between the app and our servers is encrypted in transit. Synced information is stored so that only the signed-in owner of the account can read it. No system is perfectly secure, so please keep your device and email account protected. We sign you in with a one-time code sent to your email, so there is no password to lose.

(Checked: sign-in uses `signInWithOtp` and a 6-digit code, `AuthContext.jsx:127`. "Encrypted in transit" is standard for the HTTPS endpoints in the code; Mory or counsel should confirm "stored so that only the owner can read it" matches the final Supabase row-security policy.)

### Gap 9: changes to the policy and the "last updated" date

"Last updated: January 2026" will be wrong the day the new text goes in. Draft: "We will post changes here and update the date above. If a change is significant we will tell you in the app."

### Gap 10: no mention of the medical disclaimer in the privacy text, and no link from onboarding

`docs/terms-consent-research.md` found that nothing under `/app/*` linked to `/terms` or `/privacy`. Since then the Important Notes screen (`ImportantNotesScreen.jsx`) links to both, but only from Profile. Onboarding does not link them. For a health app a reviewer expects the link on the first screen and next to account creation. The `/login` page has "By continuing, you … agree to the Terms & Conditions and Privacy Policy" (`Login.jsx:177`), but the in-app "Back up & sync" sheet that actually creates the account does not (`ProfileScreen.jsx:465-500`).

## 5. Name and legal-entity inconsistencies

| Where | Says | 
|---|---|
| App UI, plan print-out, share text, Important Notes | "Remedi" |
| `index.html`, `vite.config.js` (installed app name), Terms, marketing pages, Footer | "Personal Remedies" (manifest short name "Remedies") |
| `RecipesScreen.jsx:293` (heading above recipes) | "Personal Remedies" |
| Terms of Use (contracting party, "Company" throughout), Footer | "Personal Remedies, LLC" (Massachusetts law named) |
| Important Notes screen (`PUBLISHER_CREDIT`) | "Published by Simple Software Publishing — Mory, Bach, Sunny." |
| Contact email | `hello@personalremedies.com` |

**Why it matters.** The legal entity in the Terms and Privacy Policy, the "seller" name on the App Store, and the publisher credit must be the same entity. Apple 5.1.1(ix) also says apps in regulated fields (healthcare is named) "should be submitted by a legal entity that provides the services, and not by an individual developer." That means the App Store Connect account should be an organization, not Mory personally. Decisions needed from Mory:

1. Is "Simple Software Publishing" a legal entity, and is it the one that will publish the app? If yes, replace "Personal Remedies, LLC" in the Terms and the footer. If "Personal Remedies, LLC" is the publisher, change the in-app credit. (This is the open question #4 in `docs/questions-for-mory-store-submission.md`.)
2. Does the app keep a name that differs from the LLC's name? That is allowed, but the Terms should say "[APP NAME] is operated by [ENTITY]".
3. Which domain and email will be the public contact (personalremedies.com may no longer fit if the name changes).

> **DRAFT — NOT LEGAL ADVICE — opening line for both documents**
> "[APP NAME] (the "App") is published by [LEGAL ENTITY NAME], [address] ("we", "us"). This document applies to the App and to the website at [domain]."

## 6. Terms of Use: gaps and fixes

Apple and Google do not require a Terms of Use to be accepted by a checkbox (`docs/terms-consent-research.md`), but these issues matter:

1. **Written for a website, not an app.** Defined term "Website", hosting in the US, cookies, "download Content", "registration process (if applicable)". Replace with the App and an account. Also the Terms prohibit "using tools which anonymize your internet protocol address" (a VPN), which will annoy users and is irrelevant to the App; counsel may want to remove it.
2. **Medical disclaimer contains a prevention claim** (`TermsOfUse.jsx:75`; row A1 in `docs/health-claim-audit.md`). Fix before submission.
3. **No subscription terms.** If paid features ship, Apple requires the auto-renewal and cancellation terms to appear (guideline 3.1.2 and the standard EULA terms), and the price must be accurate. Pricing is OPEN (`docs/questions-for-mory-store-submission.md` #8).
4. **Termination wording.** "terminate accounts … for any other reason at the Company's sole discretion, with or without cause" and the bar on creating new accounts are very broad; with account deletion added, say that users may delete their account at any time.
5. **Acceptance.** "YOU ACCEPT AND AGREE … BY ACKNOWLEDGING SUCH ACCEPTANCE DURING THE REGISTRATION PROCESS" - there is no acknowledgment step in the in-app flow. Either add a "By continuing you agree" line on the sign-in sheet or reword.
6. **Notices.** "to the address listed below" - nothing is listed. Add the support email.
7. **Copyright line.** Two different years (2017, 2026) and the LLC name. Use one entity and the current year.
8. **Governing law.** Massachusetts is named. Mory and counsel to confirm that still matches the entity's home state.
9. **Apple's standard EULA.** If the Terms are not attached in App Store Connect, Apple's standard license applies. Decide whether to use it or attach the custom Terms.
10. **Liability section and statutory rights.** The all-caps disclaimer is common, but counsel should check that it does not purport to waive consumer rights that cannot be waived.

## 7. Suggested next steps for Mory

1. Decide the legal entity, the public name and the support email (section 5). Everything else depends on these.
2. Ask Nutridigm and whoever hosts the proxy what is logged and for how long (gap 4).
3. Have Bach build in-app account deletion plus a deletion page (section 1). Highest-priority because it is a hard rejection.
4. Have counsel replace the Privacy Policy using this list and the draft paragraphs, then date it.
5. Add a consent step and links in onboarding (gaps 2 and 10).
6. Re-check the App Privacy answers in `docs/store-listing-draft.md` against the final policy.
