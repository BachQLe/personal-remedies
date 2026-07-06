import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { storage } from "./api/storage";
import { prefetchAppData } from "./api/prefetch";
import AnnouncementBar from "./components/marketing/AnnouncementBar";
import Nav from "./components/marketing/Nav";
import Hero from "./components/marketing/Hero";
import Differentiators from "./components/marketing/Differentiators";
import Nutri from "./components/marketing/Nutri";
import TwoDoors from "./components/marketing/TwoDoors";
import Pricing from "./components/marketing/Pricing";
import FinalCTA from "./components/marketing/FinalCTA";
import Footer from "./components/marketing/Footer";
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
import DailyPicksScreen from "./screens/dailyPicks/DailyPicksScreen";
// App screens
import HomeScreen from "./screens/home/HomeScreen";
import SearchScreen from "./screens/search/SearchScreen";
import SuggestionsScreen from "./screens/suggestions/SuggestionsScreen";
import ProfileScreen from "./screens/profile/ProfileScreen";
import MealQueueScreen from "./screens/plan/MealQueueScreen";
import TopDosScreen from "./screens/top/TopDosScreen";
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

const BAR_H = 44;

function Home({ barVisible, setBarVisible }) {
  const [barScrollHidden, setBarScrollHidden] = useState(false);
  const prevStateRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const shouldHide = window.scrollY >= 40;
      if (shouldHide !== prevStateRef.current) {
        prevStateRef.current = shouldHide;
        setBarScrollHidden(shouldHide);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const barShowing = barVisible && !barScrollHidden;

  return (
    <div className="min-h-screen bg-paper-200 text-char-900">
      {barVisible && <AnnouncementBar onDismiss={() => setBarVisible(false)} scrollHidden={barScrollHidden} />}
      <Nav offset={barShowing ? BAR_H : 0} />
      <main style={{ paddingTop: barVisible ? BAR_H + 64 : 64 }}>
        <Hero topOffset={barVisible ? BAR_H + 64 : 64} />
        <Differentiators />
        <Nutri />
        <TwoDoors />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
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

function SearchRouteScreen() {
  const navigate = useNavigate();
  return <SearchScreen active={true} onClose={() => navigate('/app/home')} />;
}

function App() {
  const [barVisible, setBarVisible] = useState(true);

  useEffect(() => {
    const p = storage.get('profile', null);
    if (p) prefetchAppData(p);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <SyncParentUrl />
        <Routes>
          {/* Marketing site */}
          <Route path="/" element={<Home barVisible={barVisible} setBarVisible={setBarVisible} />} />
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
          {/* Daily Picks — standalone full screen (own pinned recap, no tab bar) */}
          <Route path="/onboarding/daily-picks" element={<RequireOnboarding><DailyPicksScreen /></RequireOnboarding>} />
          <Route path="/app/home" element={<RequireOnboarding><AppShell><HomeScreen /></AppShell></RequireOnboarding>} />
          <Route path="/app/search" element={<RequireOnboarding><AppShell><SearchRouteScreen /></AppShell></RequireOnboarding>} />
          <Route path="/app/suggestions" element={<RequireOnboarding><AppShell><SuggestionsScreen /></AppShell></RequireOnboarding>} />
          <Route path="/app/top" element={<RequireOnboarding><AppShell><TopDosScreen /></AppShell></RequireOnboarding>} />
          <Route path="/app/recipes" element={<RequireOnboarding><AppShell><RecipesScreen /></AppShell></RequireOnboarding>} />
          <Route path="/app/plan" element={<RequireOnboarding><AppShell><MealQueueScreen /></AppShell></RequireOnboarding>} />
          <Route path="/app/profile" element={<RequireOnboarding><AppShell><ProfileScreen /></AppShell></RequireOnboarding>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
