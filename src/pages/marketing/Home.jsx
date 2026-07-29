import { useState, useEffect, useRef } from "react";
import AnnouncementBar from "../../components/marketing/AnnouncementBar";
import Nav from "../../components/marketing/Nav";
import Hero from "../../components/marketing/Hero";
import Differentiators from "../../components/marketing/Differentiators";
import Nutri from "../../components/marketing/Nutri";
import TwoDoors from "../../components/marketing/TwoDoors";
import Pricing from "../../components/marketing/Pricing";
import FinalCTA from "../../components/marketing/FinalCTA";
import Footer from "../../components/marketing/Footer";

const BAR_H = 44;

export default function Home() {
  const [barVisible, setBarVisible] = useState(true);
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
