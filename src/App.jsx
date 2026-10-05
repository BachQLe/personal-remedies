import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { storage } from "./api/storage.js";
import { prefetchAppData } from "./api/prefetch.js";
// Marketing site is hidden — see the routes block below. The pages themselves
// (Home, Survey, Providers, Developers, Science, About, News, Contact) are kept
// in src/pages/marketing; only their routes are gone, so restoring the site is
// a matter of re-adding the imports and <Route>s.
import Login from "./pages/marketing/Login";
import TermsOfUse from "./pages/marketing/TermsOfUse";
import PrivacyPolicy from "./pages/marketing/PrivacyPolicy";
import AuthCallback from "./pages/marketing/AuthCallback";
import OnboardingPage from "./components/onboarding";
import ErrorBoundary, { RouteErrorBoundary } from "./components/shared/ErrorBoundary";
import { SnackbarProvider } from "./context/SnackbarContext.jsx";
// App screens
import HomeScreen from "./screens/home/HomeScreen";
import SearchScreen from "./screens/search/SearchScreen";
import SuggestionsScreen from "./screens/suggestions/SuggestionsScreen";
import GroupDetailScreen from "./screens/suggestions/GroupDetailScreen";
import FineGroupDetailScreen from "./screens/suggestions/FineGroupDetailScreen";
import ProfileScreen from "./screens/profile/ProfileScreen";
import ImportantNotesScreen from "./screens/profile/ImportantNotesScreen";
import MealQueueScreen from "./screens/plan/MealQueueScreen";
import RecipesScreen from "./screens/recipes/RecipesScreen";
import PaywallScreen from "./screens/paywall/PaywallScreen";
import RequireEntitlement from "./components/shared/RequireEntitlement.jsx";
// App chrome
import TabBar from "./components/layout/TabBar";
import FAB from "./components/layout/FAB";
// Dev
import KitchenSink from "./pages/KitchenSink";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// When the app runs inside PhoneFrame's iframe, react-router navigations update
// the iframe's URL but not the outer browser address bar. Since the frame is
// same-origin, mirror the current route up to the parent window so the address
// bar reflects in-app navigation. No-op when not framed.
function SyncParentUrl() {
  const location = useLocation();
  useEffect(() => {
    if (window.parent === window) return; // not framed
    try {
      const search = location.search
        .replace(/([?&])noframe(&|$)/, "$1")
        .replace(/[?&]$/, "");
      const url = location.pathname + search + location.hash;
      window.parent.history.replaceState(null, "", url || "/");
    } catch {
      /* cross-origin (shouldn't happen, same origin) — ignore */
    }
  }, [location]);
  return null;
}

// Gate the app behind onboarding: un-onboarded users are sent to /onboarding.
// Reads the browser-persisted profile synchronously to avoid a redirect flash.
function RequireOnboarding({ children }) {
  const onboarded = !!storage.get("profile", null);
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

// Entry point now that the marketing site is hidden: the root URL — and any
// stale marketing link, via the catch-all route — drops straight into the
// product. A first-time visitor lands on onboarding; a returning one goes to
// their home screen rather than being made to re-run the flow (OnboardingPage
// always starts from step 1 and would overwrite the saved profile).
function EntryRedirect() {
  const onboarded = !!storage.get("profile", null);
  return <Navigate to={onboarded ? "/app/home" : "/onboarding"} replace />;
}

// Shell for the PWA app routes — always phone layout
function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-forest-300">
      {/* bottom inset ≥ floating navbar height + margin so content clears it */}
      <main className="pb-28">
        <div className="max-w-[430px] mx-auto w-full">
          {children}
        </div>
      </main>
      <TabBar />
      <FAB />
    </div>
  );
}

// Layout route for the gated PWA app screens: onboarding-gate + phone shell,
// with the matched child route rendered via Outlet.
//
// SnackbarProvider is mounted here (not per-screen) so every app screen
// shares one toast instance via useSnackbar() — see src/context/
// SnackbarContext.jsx. It sits outside RouteErrorBoundary so a route-level
// render error doesn't unmount it.
//
// RouteErrorBoundary wraps ONLY the Outlet, keyed by the current pathname:
// a render throw on one screen shows an inline error panel in place of that
// screen while TabBar/FAB (siblings inside AppShell) stay mounted, and
// navigating to a different route (the key changing) remounts the boundary
// fresh rather than staying broken. The root ErrorBoundary (mounted once at
// the very top, see `App` below) remains the last-resort catch-all for
// failures outside the gated app shell entirely.
function AppLayout() {
  const location = useLocation();
  return (
    <RequireOnboarding>
      <SnackbarProvider>
        <AppShell>
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </AppShell>
      </SnackbarProvider>
    </RequireOnboarding>
  );
}

// Must match SearchScreen's exit-fade duration: its backdrop/group
// AnimatePresence `exit` transitions animate opacity out over 250ms (see
// src/screens/search/SearchScreen.jsx), plus a small buffer before navigating.
const SEARCH_CLOSE_MS = 260;

// Route wrapper for /app/search — owns the open/close lifecycle only.
// SearchScreen itself is now a single "Food & Nutrient Lookup" surface with
// no mode switcher (foods/recipes/nutrients/herbals are all sectioned
// results from one search), so there's no query param to read or sync here
// anymore. /app/natural — the old Natural Sources screen's URL — now
// redirects straight here with no `?mode=` param (see routes); any stale
// `?mode=natural` still floating around in a bookmark/history entry is
// simply ignored, never crashes.
function SearchRouteScreen() {
  const navigate = useNavigate();
  const [active, setActive] = useState(true);
  const closingRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setActive(false);
    timerRef.current = setTimeout(() => navigate('/app/home'), SEARCH_CLOSE_MS);
  };

  return <SearchScreen active={active} onClose={handleClose} />;
}

function App() {
  useEffect(() => {
    const p = storage.get('profile', null);
    prefetchAppData(p);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <SyncParentUrl />
          <Routes>
            {/* Entry — marketing site hidden, so "/" goes straight to the product */}
            <Route path="/" element={<EntryRedirect />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* Auth + legal: not marketing content, and still linked to.
                /auth/callback is the Supabase magic-link return URL (see
                AuthContext), /login its failure fallback, and /terms + /privacy
                are linked from the login page. */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            {/* Dev */}
            <Route path="/kitchen-sink" element={<KitchenSink />} />
            {/* PWA App — gated behind onboarding */}
            <Route path="/app" element={<Navigate to="/app/home" replace />} />
            <Route path="/app/natural" element={<Navigate to="/app/search" replace />} />
            {/* Stale links to the retired glance / Top Dos & Don'ts screens */}
            <Route path="/app/glance" element={<Navigate to="/app/suggestions" replace />} />
            <Route path="/app/top" element={<Navigate to="/app/suggestions" replace />} />
            <Route element={<AppLayout />}>
              <Route path="/app/home" element={<HomeScreen />} />
              <Route path="/app/search" element={<SearchRouteScreen />} />
              <Route path="/app/suggestions" element={<SuggestionsScreen />} />
              <Route path="/app/suggestions/group/:groupId" element={<RequireEntitlement feature="food_group_detail"><GroupDetailScreen /></RequireEntitlement>} />
              <Route path="/app/suggestions/fine/:fineGroupId" element={<RequireEntitlement feature="suggest"><FineGroupDetailScreen /></RequireEntitlement>} />
              <Route path="/app/recipes" element={<RecipesScreen />} />
              <Route path="/app/plan" element={<RequireEntitlement feature="plan"><MealQueueScreen /></RequireEntitlement>} />
              <Route path="/app/profile" element={<ProfileScreen />} />
              <Route path="/app/profile/important-notes" element={<ImportantNotesScreen />} />
              <Route path="/app/upgrade" element={<PaywallScreen />} />
            </Route>
            {/* Retired marketing URLs (/about, /news, …) and any other unknown
                path land in the product instead of a blank screen. */}
            <Route path="*" element={<EntryRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
