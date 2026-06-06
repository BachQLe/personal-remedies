import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
    <div className="min-h-screen bg-cream text-ink">
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

function App() {
  const [barVisible, setBarVisible] = useState(true);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home barVisible={barVisible} setBarVisible={setBarVisible} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/science" element={<Science />} />
          <Route path="/about" element={<About />} />
          <Route path="/news" element={<News />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
