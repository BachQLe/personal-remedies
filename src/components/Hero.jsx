import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import TrustStrip from "./TrustStrip";

const SUPERFOODS = [
  {
    emoji: "🧄",
    name: "Garlic",
    tag: "Immune Booster",
    stats: [
      { label: "Immune Support", rating: 10 },
      { label: "Anti-Inflammatory", rating: 9 },
      { label: "Blood Pressure", rating: 8 },
      { label: "Antioxidant", rating: 9 },
      { label: "Antimicrobial", rating: 9 },
    ],
  },
  {
    emoji: "🌿",
    name: "Turmeric",
    tag: "Inflammation Fighter",
    stats: [
      { label: "Anti-Inflammatory", rating: 10 },
      { label: "Joint Health", rating: 9 },
      { label: "Brain Health", rating: 8 },
      { label: "Antioxidant", rating: 9 },
      { label: "Digestive Health", rating: 7 },
    ],
  },
  {
    emoji: "🫐",
    name: "Blueberries",
    tag: "Antioxidant Powerhouse",
    stats: [
      { label: "Antioxidant", rating: 10 },
      { label: "Brain Health", rating: 9 },
      { label: "Heart Health", rating: 8 },
      { label: "Blood Sugar", rating: 7 },
      { label: "Anti-Aging", rating: 9 },
    ],
  },
  {
    emoji: "🥑",
    name: "Avocado",
    tag: "Heart Health Hero",
    stats: [
      { label: "Heart Health", rating: 10 },
      { label: "Healthy Fats", rating: 10 },
      { label: "Blood Pressure", rating: 8 },
      { label: "Eye Health", rating: 7 },
      { label: "Blood Sugar", rating: 8 },
    ],
  },
  {
    emoji: "🥬",
    name: "Spinach",
    tag: "Nutrient Dense",
    stats: [
      { label: "Iron", rating: 9 },
      { label: "Bone Health", rating: 8 },
      { label: "Eye Health", rating: 9 },
      { label: "Heart Health", rating: 8 },
      { label: "Energy", rating: 7 },
    ],
  },
];

const CONDITIONS = [
  { label: "Type 2 Diabetes", color: "bg-amber/15 text-amber-800" },
  { label: "Hypertension", color: "bg-red-50 text-red-700" },
  { label: "High Cholesterol", color: "bg-orange-50 text-orange-700" },
];

const PREFERENCES = ["Plant-based", "Low Sodium", "Nut-free", "Gluten-free"];

const CHAT = [
  { from: "user", text: "I have type 2 diabetes and high blood pressure. Is oatmeal okay for me?" },
  { from: "bot", text: "Steel-cut oats are great for both. Beta-glucan fiber slows blood sugar absorption and reduces LDL — a two-for-one for your conditions." },
  { from: "user", text: "What about fruit? I heard sugar is bad." },
  { from: "bot", text: "Whole fruit is fine — fiber buffers the spike. Blueberries, pears, and apples are ideal. Avoid fruit juice entirely." },
  { from: "user", text: "Can garlic actually lower blood pressure?" },
  { from: "bot", text: "Yes — allicin relaxes blood vessels. Studies show 600–1,200mg daily can cut systolic by 10+ mmHg. Raw or aged extract works best." },
  { from: "user", text: "What should I cut out completely?" },
  { from: "bot", text: "Top three: processed meats, white bread, and sugary drinks. Cutting these typically moves the needle within 4–6 weeks." },
  { from: "user", text: "Any easy meal I can start with tomorrow?" },
  { from: "bot", text: "Overnight oats + blueberries + walnuts. 5 min tonight, zero effort tomorrow — hits 4 of your top nutrients at once. (continue free →)" },
];

// Cursor waypoints as % of the demo widget container
// click:true = trigger a click-scale animation at this position
const CURSOR_WAYPOINTS = [
  { x: "50%", y: "91%", click: false },
  { x: "62%", y: "91%", click: false },
  { x: "57%", y: "91%", click: false },
  { x: "87%", y: "91%", click: true },
  { x: "62%", y: "91%", click: false },
  { x: "68%", y: "91%", click: false },
  { x: "87%", y: "91%", click: true },
  { x: "54%", y: "91%", click: false },
  { x: "62%", y: "91%", click: false },
  { x: "87%", y: "91%", click: true },
  { x: "59%", y: "91%", click: false },
  { x: "62%", y: "91%", click: false },
];

function RatingDots({ filled }) {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-150 ${i <= filled ? "bg-forest" : "border border-forest/25"
            }`}
        />
      ))}
    </div>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [isFixed, setIsFixed] = useState(true);

  useEffect(() => {
    const check = () => {
      if (!heroRef.current) return;
      const { bottom } = heroRef.current.getBoundingClientRect();
      setIsFixed(bottom > window.innerHeight);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  // Superfood cycling
  const [activeIdx, setActiveIdx] = useState(0);

  // Chat simulation — messages array grows forever, never clears
  const [messages, setMessages] = useState(CHAT.slice(0, 2));
  const [inputText, setInputText] = useState("");
  const [showTyping, setShowTyping] = useState(false);

  // Cursor
  const [cursorIdx, setCursorIdx] = useState(0);
  const [isClicking, setIsClicking] = useState(false);

  // One-time delay before typing starts
  const [chatStarted, setChatStarted] = useState(false);

  // Animated filled-dot counts and rating numbers for step animation
  const [animatedFilled, setAnimatedFilled] = useState(
    SUPERFOODS[0].stats.map(s => Math.round(s.rating / 2))
  );
  const [animatedRatings, setAnimatedRatings] = useState(
    SUPERFOODS[0].stats.map(s => s.rating)
  );
  const animRef = useRef({
    timeouts: [],
    startFilled: SUPERFOODS[0].stats.map(s => Math.round(s.rating / 2)),
    startRatings: SUPERFOODS[0].stats.map(s => s.rating),
  });

  // ── Superfood cycle ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setActiveIdx((p) => (p + 1) % SUPERFOODS.length), 3500);
    return () => clearInterval(id);
  }, []);

  // ── Orb + number step animation on food change ───────────────
  useEffect(() => {
    animRef.current.timeouts.forEach(clearTimeout);
    animRef.current.timeouts = [];

    const startFilled = [...animRef.current.startFilled];
    const startRatings = [...animRef.current.startRatings];
    const targetFilled = SUPERFOODS[activeIdx].stats.map(s => Math.round(s.rating / 2));
    const targetRatings = SUPERFOODS[activeIdx].stats.map(s => s.rating);

    const maxSteps = Math.max(
      ...targetFilled.map((t, i) => Math.abs(t - startFilled[i])),
      ...targetRatings.map((t, i) => Math.abs(t - startRatings[i]))
    );

    if (maxSteps === 0) {
      animRef.current.startFilled = targetFilled;
      animRef.current.startRatings = targetRatings;
      setAnimatedFilled(targetFilled);
      setAnimatedRatings(targetRatings);
      return;
    }

    let curFilled = [...startFilled];
    let curRatings = [...startRatings];
    for (let step = 1; step <= maxSteps; step++) {
      curFilled = curFilled.map((c, i) => c < targetFilled[i] ? c + 1 : c > targetFilled[i] ? c - 1 : c);
      curRatings = curRatings.map((c, i) => c < targetRatings[i] ? c + 1 : c > targetRatings[i] ? c - 1 : c);
      const snapFilled = [...curFilled];
      const snapRatings = [...curRatings];
      const t = setTimeout(() => {
        setAnimatedFilled(snapFilled);
        setAnimatedRatings(snapRatings);
        animRef.current.startFilled = snapFilled;
        animRef.current.startRatings = snapRatings;
      }, step * 110);
      animRef.current.timeouts.push(t);
    }
  }, [activeIdx]);

  // ── Initial typing delay ─────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setChatStarted(true), 2800);
    return () => clearTimeout(id);
  }, []);

  // ── User typing into input ────────────────────────────────────
  useEffect(() => {
    if (!chatStarted) return;
    const msg = CHAT[messages.length % CHAT.length];
    if (msg.from !== "user") return;

    const target = msg.text;
    if (inputText.length < target.length) {
      const id = setTimeout(() => setInputText(target.slice(0, inputText.length + 1)), 36);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setInputText("");
      setMessages((prev) => [...prev, msg]);
    }, 420);
    return () => clearTimeout(id);
  }, [messages.length, inputText, chatStarted]);

  // ── Bot response ──────────────────────────────────────────────
  useEffect(() => {
    if (!chatStarted) return;
    const msg = CHAT[messages.length % CHAT.length];
    if (msg.from !== "bot") return;
    setShowTyping(true);
    const id = setTimeout(() => {
      setShowTyping(false);
      setMessages((prev) => [...prev, msg]);
    }, 1800);
    return () => clearTimeout(id);
  }, [messages.length, chatStarted]);

  // ── Cursor waypoints ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCursorIdx((i) => (i + 1) % CURSOR_WAYPOINTS.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!CURSOR_WAYPOINTS[cursorIdx].click) return;
    setIsClicking(true);
    const id = setTimeout(() => setIsClicking(false), 240);
    return () => clearTimeout(id);
  }, [cursorIdx]);

  const food = SUPERFOODS[activeIdx];
  const wp = CURSOR_WAYPOINTS[cursorIdx];

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden pt-16 pb-[108px]"
      style={{ background: "#fffffaff" }}
    >
      {/* halftone dots */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
      {/* grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.22]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <div className="mx-auto max-w-7xl container-px">

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="display text-[32px] leading-[1.04] sm:text-[46px] sm:leading-[1.02] lg:text-[56px] lg:leading-[1.0] text-slate-900 text-center"
        >
          Less pills, {" "}
          <em className="font-display italic font-normal text-slate-900">more real food</em>

        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 font-display italic text-[18px] sm:text-[22px] text-slate-900/70 text-center tracking-tight"
        >
          a simple diet change can reverse many chronic conditions —<br />the question is what foods to eat.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 text-center text-[8px] sm:text-[12px] text-ink/60 tracking-tight"
        >
          Diets based on 100k+ real scientific articles, for real, unique people
        </motion.p>

        <div className="relative z-10 flex justify-center mt-1">
          <button
            onClick={() => navigate("/survey")}
            className=" pill-btn !rounded-lg text-white hover:-translate-y-[1px] hover:shadow-lift text-[16px] px-6 py-2.5"
            style={{ background: "#3c7235ff" }}
          >
            Get your personalized <strong className="mx-1">SUPERFOOD</strong> diet plan
          </button>
        </div>

        {/* ── unified app window ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mt-10 mx-auto max-w-5xl rounded-[5px] bg-white border border-ink/[0.08] shadow-lift overflow-hidden"
        >
          {/* cursor overlay */}
          <motion.div
            className="absolute z-50 pointer-events-none"
            animate={{ left: wp.x, top: wp.y, scale: isClicking ? 0.72 : 1 }}
            transition={{ left: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }, top: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.12 } }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M2 2 L2 16 L5.5 12.5 L8 18.5 L10 17.5 L7.5 11.5 L13 11.5 Z"
                fill="white"
                stroke="#1a1a1a"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          {/* chrome bar */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-ink/[0.06] bg-white">
            <span className="h-2.5 w-2.5 rounded-full bg-amber animate-slow-pulse" />
            <span className="text-[13px] font-medium tracking-tight text-ink">
              Nutri <span className="text-ink/40">·</span>{" "}
              <span className="text-ink/70">Personal Remedies</span>
            </span>
            <span className="ml-auto text-[11px] text-ink/40">Live demo</span>
          </div>

          {/* two-pane body */}
          <div className="flex divide-x divide-ink/[0.06]" style={{ minHeight: 420 }}>

            {/* LEFT PANEL */}
            <div className="w-[42%] shrink-0 flex flex-col" style={{ background: "#e8ede6" }}>

              {/* Nutri Recommendations */}
              <div className="px-4 pt-4 pb-3 border-b border-black/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-ink/40">
                    Nutri Recommendations
                  </span>
                  <span className="flex gap-1">
                    {SUPERFOODS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIdx ? "bg-forest w-4" : "bg-ink/20 w-1.5"
                          }`}
                      />
                    ))}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={food.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-2.5 mb-3"
                  >
                    <span className="text-3xl leading-none select-none" aria-hidden>{food.emoji}</span>
                    <div>
                      <p className="text-[14px] font-semibold tracking-tight text-ink leading-none">{food.name}</p>
                      <p className="text-[11px] text-ink/45 mt-0.5">{food.tag}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="space-y-2">
                  {food.stats.map(({ label }, rowIdx) => (
                    <div key={rowIdx} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-ink/60 truncate">{label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 -mr-1">
                          <RatingDots filled={animatedFilled[rowIdx]} />
                          <span className="overflow-hidden" style={{ height: 16, width: 14 }}>
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={animatedRatings[rowIdx]}
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 10, opacity: 0 }}
                                transition={{ duration: 0.1, ease: "easeInOut" }}
                                className="text-[11px] font-semibold text-ink block"
                              >
                                {animatedRatings[rowIdx]}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </span>
                        <span className="text-[11px] text-ink/30 font-normal">/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your Profile */}
              <div className="px-4 pt-3 pb-4 flex-1">
                <p className="text-[11px] font-semibold tracking-widest uppercase text-ink/40 mb-2.5">
                  Your Profile
                </p>
                <p className="text-[11px] text-ink/50 mb-1.5 font-medium">Conditions</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {CONDITIONS.map(({ label, color }) => (
                    <span key={label} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-ink/50 mb-1.5 font-medium">Preferences</p>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERENCES.map((pref) => (
                    <span key={pref} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-forest/10 text-forest">
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL — chat */}
            <div className="flex-1 flex flex-col">
              {/*
                flex-col-reverse + overflow-hidden:
                newest message is first in DOM → appears at bottom.
                as chat fills, oldest messages push up and clip at the top edge.
              */}
              <div
                className="flex-1 flex flex-col-reverse overflow-hidden bg-[#FBFAF6]"
                style={{ padding: "20px", gap: "14px", maxHeight: 360 }}
              >
                {/* typing indicator — first in DOM = very bottom */}
                {showTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start shrink-0"
                  >
                    <div className="bg-white border border-ink/[0.06] rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
                      {[0, 0.18, 0.36].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-ink/30 animate-slow-pulse"
                          style={{ animationDelay: `${d}s` }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* messages — newest first in DOM (column-reverse shows newest at bottom) */}
                {[...messages].reverse().map((m, reversedIdx) => {
                  const originalIdx = messages.length - 1 - reversedIdx;
                  return (
                    <motion.div
                      key={originalIdx}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex shrink-0 ${m.from === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-[1.55] ${m.from === "user"
                          ? "text-white rounded-tr-md"
                          : "bg-white text-ink rounded-tl-md border border-ink/[0.06]"
                          }`}
                        style={m.from === "user" ? { background: "linear-gradient(135deg, #2d5a28 0%, #3c7235 60%, #4d8f44 100%)" } : {}}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* input bar */}
              <div className="px-4 py-3 border-t border-ink/[0.06] flex items-center gap-2 bg-white">
                <div className="flex-1 rounded-full bg-[#FBFAF6] px-4 py-2 text-[13px] border border-ink/[0.06] flex items-center min-w-0">
                  {inputText ? (
                    <>
                      <span className="text-ink truncate">{inputText}</span>
                      <span className="ml-px inline-block w-[1.5px] h-3.5 bg-ink/70 shrink-0 animate-slow-pulse" />
                    </>
                  ) : (
                    <span className="text-ink/40">Ask Nutri anything…</span>
                  )}
                </div>
                <button
                  className="h-8 w-8 rounded-full text-white flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #2d5a28 0%, #3c7235 100%)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 12V2M7 2 2 7M7 2l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </motion.div>

      </div>

      <div
        className={`left-0 right-0 z-40 ${isFixed ? "fixed bottom-0" : "absolute bottom-0"}`}
        style={{ background: "#fffffaff" }}
      >
        <TrustStrip />
      </div>
    </section>
  );
}
