/**
 * Single switch for the marketing site.
 *
 * With it off, "/" (and any unknown path) redirects straight into the product
 * — see EntryRedirect in src/App.jsx — and the marketing pages under
 * src/pages/marketing have no routes. Nav and Footer still render on the two
 * pages that outlive the site (Terms of use, Privacy policy), so they read this
 * flag to drop links that would now bounce the visitor into onboarding.
 *
 * To bring the marketing site back: flip this to true and restore the imports
 * and <Route>s in src/App.jsx. Nothing else was deleted.
 */
export const MARKETING_VISIBLE = false;
