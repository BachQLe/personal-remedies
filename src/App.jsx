import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AnnouncementBar from "./components/AnnouncementBar";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Differentiators from "./components/Differentiators";
import Nutri from "./components/Nutri";
import TwoDoors from "./components/TwoDoors";
import Pricing from "./components/Pricing";
import FinalCTA from "./components/FinalCTA";
import Footer from "./components/Footer";
import Survey from "./pages/Survey";
import Providers from "./pages/Providers";
import Developers from "./pages/Developers";
import Science from "./pages/Science";
import About from "./pages/About";
import News from "./pages/News";
import Login from "./pages/Login";
import Contact from "./pages/Contact";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import OnboardingPage from "./components/onboarding";
// App screens
import HomeScreen from "./screens/home/HomeScreen";
import PlanScreen from "./screens/plan/PlanScreen";
import WeeklyPlanScreen from "./screens/week/WeeklyPlanScreen";
import RecipesScreen from "./screens/recipes/RecipesScreen";
import LookupScreen from "./screens/lookup/LookupScreen";
import ProfileScreen from "./screens/profile/ProfileScreen";
// App chrome
import TabBar from "./components/TabBar";
import FAB from "./components/FAB";
// Dev
import KitchenSink from "./pages/KitchenSink";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
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

// Shell for the PWA app routes — always phone layout
function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-paper-200">
      <main className="pb-24">
        <div className="max-w-[430px] mx-auto w-full">
          {children}
        </div>
      </main>
      <TabBar />
      <FAB />
    </div>
  );
}

function App() {
  const [barVisible, setBarVisible] = useState(true);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Marketing site */}
          <Route path="/" element={<Home barVisible={barVisible} setBarVisible={setBarVisible} />} />
          <Route path="/login" element={<Login />} />
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
          {/* PWA App */}
          <Route path="/app" element={<Navigate to="/app/home" replace />} />
          <Route path="/app/home" element={<AppShell><HomeScreen /></AppShell>} />
          <Route path="/app/plan" element={<AppShell><PlanScreen /></AppShell>} />
          <Route path="/app/week" element={<AppShell><WeeklyPlanScreen /></AppShell>} />
          <Route path="/app/recipes" element={<AppShell><RecipesScreen /></AppShell>} />
          <Route path="/app/lookup" element={<AppShell><LookupScreen /></AppShell>} />
          <Route path="/app/profile" element={<AppShell><ProfileScreen /></AppShell>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
