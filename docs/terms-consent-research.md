# "I agree to Terms" checkbox — market research

*Prepared September 2026 for Remedi. Answers the open item in the Build Checklist: the "Important Notes" screen (privacy policy + medical disclaimer + publisher credit) currently replaces an "I agree" checkbox, pending a check of what comparable apps do. This is that check. Facts I could not directly verify are flagged "unverified / inferred" rather than asserted — see honesty rules below.*

---

## Bottom line up front

There is no single market norm — the pattern splits by data sensitivity. Plain fitness/nutrition trackers (MyFitnessPal, Cronometer, and by secondary report WeightWatchers) use an **explicit checkbox** at signup. Consumer wellness/meditation apps (Calm, and by ToS-text inference Noom) lean on an **implicit "by continuing you agree" line** under the button, no checkbox. Apps that touch **regulated health data or clinical care** (Flo under GDPR, Ada Health under GDPR Article 9, Teladoc, Hims & Hers, K Health) all use a **separate, explicit consent step** — distinct from generic account terms — because the law requires affirmative consent for processing health/special-category data, not because of app-store convention. Neither Apple nor Google actually mandates a "terms of service" checkbox at signup (see the Store requirements section) — the explicit-consent requirement that does exist in both stores' policies is scoped to **collection of personal/sensitive data**, not to accepting a legal agreement.

**Recommendation for Remedi:** the locked "no consent checkbox" decision can stand for the *generic terms-of-use / publisher-credit* content — that matches the implicit-consent norm used by Calm and (per ToS-text inference) Noom, and satisfies both stores' actual requirements once the Important Notes screen is reachable from the app and its content is presented, not merely linked from a hidden marketing site. **However**, Remedi collects health condition data in onboarding (ProfileBuilder), which is the exact category (Flo's cycle data, Ada's symptom data) that every app in this survey handling it treats with an explicit, separate affirmative-consent step, not a generic disclaimer screen. That is a partial reversal: the decision to skip a checkbox for *terms/copyright* stands, but the plan should add one explicit, affirmative action (a single checkbox or equivalent, e.g. "I understand this is not medical advice and I consent to sharing my condition information") gating past the medical-disclaimer content specifically, before condition data is collected in ProfileBuilder. See the Recommendation section for detail.

---

## Survey table

| App | Pattern | Source | Date checked |
|---|---|---|---|
| MyFitnessPal | (a) Explicit checkbox — "I agree to MyFitnessPal's Terms & Conditions and Privacy Policy," must be checked before Sign Up is enabled | [myfitnesspal.com/account/create](https://www.myfitnesspal.com/account/create) (fetched directly) | 2026-09-06 |
| Cronometer | (a) Explicit checkbox — "I agree to the Cronometer Terms of Service and Privacy Policy," plus separate optional checkboxes for marketing email and personalized ads | [cronometer.com signup form](https://cronometer.com/lowcarbusa) (fetched directly) | 2026-09-06 |
| Oura | (a) Explicit toggle (functionally a checkbox) — user must "accept the terms and conditions by selecting the first toggle"; a second, separate toggle for marketing is optional | [support.ouraring.com — Create and Manage an Oura Account](https://support.ouraring.com/hc/en-us/articles/360025441234-Create-and-Manage-an-Oura-Account) (fetched directly) | 2026-09-06 |
| WeightWatchers (WW) | (a) Explicit checkbox, per secondary description ("you must agree to the terms outlined by checking the box" to proceed) — **unverified / inferred**, could not load the live registration form directly (404) | [weightwatchers.com/us/termsandconditions/membership](https://www.weightwatchers.com/us/termsandconditions/membership) + search-engine synthesis | 2026-09-06 |
| Calm | (b) Implicit — "By clicking Continue, you agree to Calm's Terms and acknowledge that you have read Calm's Privacy Policy" appears as fine print under the button, no checkbox, consistent across multiple Calm signup/offer pages | [calm.com/b2b/tos](https://www.calm.com/b2b/tos), [calm.com/new-annual-offer](https://www.calm.com/new-annual-offer) | 2026-09-06 |
| Noom | (b) Implicit, by inference from ToS text only — **unverified / inferred** for the actual UI. Noom's own terms say "Each eligible user must acknowledge receipt of the Privacy Policy and accept the applicable Terms prior to using the applicable Services," which implies an acceptance step exists, but I could not confirm whether it's a checkbox, a tap-through screen, or fine print — screenshot sources (Page Flows) did not return renderable images | [noom.com/terms-and-conditions-of-use](https://www.noom.com/terms-and-conditions-of-use/) | 2026-09-06 |
| Headspace | (d) Unknown / could not verify — Headspace's own pages describe marketing-email opt-in language but nothing about the terms/privacy acceptance UI at signup | [headspace.com/privacy-policy](https://www.headspace.com/privacy-policy), [pageflows.com Headspace onboarding](https://pageflows.com/post/ios/onboarding/headspace/) | 2026-09-06 |
| Lose It! | (d) Unknown / could not verify — site blocked direct fetch; only the standalone privacy policy was reachable, no signup-flow detail | [loseit.com/privacy](https://www.loseit.com/privacy/) | 2026-09-06 |
| Fitbit | (d) Unknown / could not verify precisely, and possibly not comparable — Fitbit's own Terms of Service state the agreement binds "upon first login, no separate click-through required" per secondary description; Fitbit is also mid-migration to Google accounts (post May 2026), which have their own account-creation consent flow. Treat as **unverified / inferred** | [fitbit.com/legal/terms-of-service](https://www.fitbit.com/legal/terms-of-service) + search-engine synthesis | 2026-09-06 |
| ZOE | (d) Unknown / could not verify the signup UI specifically. ZOE's privacy policy establishes that use of the app constitutes acceptance, and that clinical-study features (e.g., a free blood glucose sensor) require separate explicit consent — a jurisdiction/feature-driven exception, not the base signup flow | [zoeholding.com/privacy-policy](https://zoeholding.com/privacy-policy/) | 2026-09-06 |
| Flo | (c) Separate, explicit, GDPR-driven consent screen — presented at first launch, before the health questionnaire, with positive opt-in tick boxes (not pre-checked); Flo explicitly asks for consent to process special-category health data (cycle, height, weight, temperature) at the registration screen, applying GDPR rights globally regardless of user location | [Privacy International — Flo: Research Findings](https://privacyinternational.org/long-read/5561/flo-research-findings), [flo.health/consumer-health-data-privacy-notice](https://flo.health/consumer-health-data-privacy-notice) | 2026-09-06 |
| Ada Health | (c)/(d) hybrid — legally, Ada (an EU company) must obtain explicit consent under GDPR Article 9(2)(a) to process health data in symptom assessments, so an affirmative consent action is legally required, not optional; the exact on-screen mechanism (checkbox vs. toggle vs. full-screen step) is **unverified / inferred** | [ada.com/privacy-policy](https://ada.com/privacy-policy/) | 2026-09-06 |
| Teladoc | (c) Separate consent step — account creation requires reviewing and agreeing to the Notice of Privacy Practices and Notice of Nondiscrimination separately from the generic Terms of Service, a HIPAA-driven requirement distinct from app-store convention | [member.teladoc.com/terms/terms_of_use](https://member.teladoc.com/terms/terms_of_use), [member.teladoc.com/terms/privacy](https://member.teladoc.com/terms/privacy) | 2026-09-06 |
| Hims & Hers | (c) Separate consent step — a distinct "Patient Consent" for telehealth is presented and acknowledged by clicking "Start My Visit," separate from the account Terms and Conditions; this is a telehealth-specific informed-consent requirement, not generic ToS | [hims.ca/telehealth](https://hims.ca/telehealth), [hims.com/terms-and-conditions](https://www.hims.com/terms-and-conditions) | 2026-09-06 |
| K Health | (c) Separate consent step — a distinct "Informed Consent Form" for telehealth/virtual-visit use, separate from generic account terms, described as a voluntary, informed consent to the use of telehealth | [khealth.com/terms-of-use](https://khealth.com/terms-of-use) | 2026-09-06 |

---

## What the stores actually require vs. what is convention

This is the more load-bearing finding than the survey itself.

**Apple App Store (Guideline 5.1.1):**
- Requires a privacy policy link, both in App Store Connect metadata and reachable inside the app.
- Requires the privacy policy to state what data is collected, how, and why, plus retention/deletion practices and how to revoke consent.
- Requires "user consent" specifically for **collection of user or usage data** (including data that's anonymous at collection time) — enforced mechanically via system permission prompts (location, camera, health data, etc.) and their purpose strings, not via a general "I agree to Terms" UI element.
- **Does not** require an explicit checkbox or click-through acceptance of a Terms of Service / EULA document as a condition of App Review. ([developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/), fetched 2026-09-06)

**Google Play (User Data policy):**
- Requires "affirmative user action (for example, tap to accept, tick a check-box)" before an app collects **personal or sensitive user data** — this is the one place either store explicitly names a checkbox as an acceptable mechanism.
- Explicitly disallows treating navigation-away (back/home/tap-away) as consent.
- This requirement is scoped to personal/sensitive data collection broadly (health, financial, location, etc.), not to "terms of service" as a general legal document — an app that collects no personal/sensitive data would not trigger it. ([support.google.com/googleplay — User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), fetched 2026-09-06)

**Net:** a generic "I agree to Terms of Use" checkbox is not what either store's policy actually asks for. What both stores converge on is affirmative, informed consent tied to *specific data collection* — and Remedi's condition data (which several other apps in this survey treat as special/sensitive health data) is the piece that plausibly triggers this, not the copyright/publisher-credit content.

---

## Recommendation for Remedi's Important Notes screen

1. **Keep no checkbox for the generic terms-of-use / publisher-credit content.** This matches the implicit-consent norm used by consumer wellness apps (Calm, and by inference Noom) and is not required by either app store for a document of this kind. The locked decision stands for this part.
2. **Do not treat this as settled for the condition data collected in ProfileBuilder.** Every app in this survey that collects data in the same category Remedi collects — menstrual/health data (Flo), symptom data (Ada) — uses an explicit, separate affirmative-consent step for that data, driven by GDPR Article 9 / health-data sensitivity rather than app-store rules or "convention" in the loose sense. Google Play's own policy language ("tick a check-box... before your app collects... personal and sensitive data") is the closest either store comes to mandating this mechanism, and it's a plausible fit for Remedi's condition data. Recommend adding one explicit, affirmative action — a single checkbox or equivalent tap-to-accept control — attached specifically to the medical-disclaimer content ("this is not medical advice, consult your physician," plus a line acknowledging that condition information you enter is used to personalize recommendations), positioned before ProfileBuilder's condition-collection step. This is a narrow reversal of "no checkbox," not a wholesale one: it applies only to the health-data-adjacent part of the disclosure, not to the terms-of-use/publisher-credit content.
3. This recommendation is bounded by what I could verify: I confirmed the mechanism (checkbox/toggle) for MyFitnessPal, Cronometer, Oura, and Calm directly; for the health-data apps (Flo, Ada, Teladoc, Hims & Hers, K Health) I confirmed that a *separate, explicit consent requirement* exists and is data-driven, but not always the exact widget used. Treat the general shape of the recommendation (add one explicit affirmative action tied to health-data disclosure) as solid; treat any specific widget choice as a design decision, not something this research locks in.

---

## /app/* does not link to /terms or /privacy today

`src/pages/marketing/TermsOfUse.jsx` (`/terms`) and `src/pages/marketing/PrivacyPolicy.jsx` (`/privacy`) both exist with real legal copy (Terms of Use includes the medical disclaimer language; Privacy Policy is short and general-purpose, last updated January 2026 per both pages' headers). The only place either is linked from is `src/components/marketing/Footer.jsx` — a component that belongs to the marketing site, which was hidden in commit `cd258eb` ("Hide marketing site; enter straight into onboarding"). A grep across `src/pages/app` and `src/components` found no reference to `/terms` or `/privacy` from anything under `/app/*`.

Whatever consent pattern is chosen for the Important Notes screen, it needs actual links (or inline content) reaching these two documents from inside the app — right now a user going through onboarding has no path to either document at all, checkbox or no checkbox.

---

## Honesty notes

- Every classification above cites at least one source URL.
- Rows marked "unverified / inferred" (WeightWatchers, Noom's exact UI, Headspace, Lose It!, Fitbit, ZOE's base signup, Ada's exact widget) reflect real gaps: paywalled/blocked pages, screenshot tools that didn't return renderable images, or ToS text that implies but doesn't show the UI. These should not be read as "explicit checkbox confirmed" — they're inference from adjacent text or secondary description, flagged as such per this project's honesty rules.
- I did not attempt to load screenshots from Mobbin (paywalled/403) or Page Flows (image not embedded in fetched HTML) for any app; where those were the only lead, the row is marked unverified rather than guessed.
