import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { storage } from "./api/storage.js";
import { prefetchAppData } from "./api/prefetch.js";
import Home from "./pages/marketing/Home";
import Survey from "./pages/marketing/Survey";
import Providers from "./pages/marketing/Providers";
import Developers from "./pages/marketing/Developers";
import Science from "./pages/marketing/Science";
import About from "./pages/marketing/About";
import News from "./pages/marketing/News";
import Login from "./pages/marketing/Login";
import Contact from "./pages/marketing/Contact";
import TermsOfUse from "./pages/marketing/TermsOfUse";
import PrivacyPolicy from "./pages/marketing/PrivacyPolicy";
import AuthCallback from "./pages/marketing/AuthCallback";
import OnboardingPage from "./components/onboarding";
// App screens
import HomeScreen from "./screens/home/HomeScreen";
import SearchScreen from "./screens/search/SearchScreen";
import SuggestionsScreen from "./screens/suggestions/SuggestionsScreen";
import GroupDetailScreen from "./screens/suggestions/GroupDetailScreen";
import ProfileScreen from "./screens/profile/ProfileScreen";
import MealQueueScreen from "./screens/plan/MealQueueScreen";
import RecipesScreen from "./screens/recipes/RecipesScreen";
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

// Shell for the PWA app routes — always phone layout
function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-paper-200">
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
function AppLayout() {
  return (
    <RequireOnboarding>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireOnboarding>
  );
}

// Must match SearchScreen's exit-fade duration: its backdrop/group
// AnimatePresence `exit` transitions animate opacity out over 250ms (see
// src/screens/search/SearchScreen.jsx), plus a small buffer before navigating.
const SEARCH_CLOSE_MS = 260;

// Route wrapper for /app/search — owns the open/close lifecycle only. Which
// mode is showing (Food Lookup vs Natural Sources) is read by SearchScreen
// itself from the `?mode=` query param via useSearchParams, and the pill
// toggle syncs that param back as a side effect — never a navigation, so
// toggling modes never remounts this wrapper or retriggers the open/close
// animation. /app/natural redirects here with `?mode=natural` (see routes).
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
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <SyncParentUrl />
        <Routes>
          {/* Marketing site */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/science" element={<Science />} />
          <Route path="/about" element={<About />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          {/* Dev */}
          <Route path="/kitchen-sink" element={<KitchenSink />} />
          {/* PWA App — gated behind onboarding */}
          <Route path="/app" element={<Navigate to="/app/home" replace />} />
          <Route path="/app/natural" element={<Navigate to="/app/search?mode=natural" replace />} />
          {/* Stale links to the retired glance / Top Dos & Don'ts screens */}
          <Route path="/app/glance" element={<Navigate to="/app/suggestions" replace />} />
          <Route path="/app/top" element={<Navigate to="/app/suggestions" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/app/home" element={<HomeScreen />} />
            <Route path="/app/search" element={<SearchRouteScreen />} />
            <Route path="/app/suggestions" element={<SuggestionsScreen />} />
            <Route path="/app/suggestions/group/:groupId" element={<GroupDetailScreen />} />
            <Route path="/app/recipes" element={<RecipesScreen />} />
            <Route path="/app/plan" element={<MealQueueScreen />} />
            <Route path="/app/profile" element={<ProfileScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
