import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import TrustStrip from "./TrustStrip";

const DS_EASE = [0.22, 0.61, 0.36, 1];

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

export default function Hero({ topOffset = 0 }) {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [isFixed, setIsFixed] = useState(true);
  const prevFixedRef = useRef(true);

  useEffect(() => {
    const check = () => {
      if (!heroRef.current) return;
      const { bottom } = heroRef.current.getBoundingClientRect();
      const shouldBeFixed = bottom > window.innerHeight;
      if (shouldBeFixed !== prevFixedRef.current) {
        prevFixedRef.current = shouldBeFixed;
        setIsFixed(shouldBeFixed);
      }
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
    const id = setTimeout(() => setIsClicking(false), 200);
    return () => clearTimeout(id);
  }, [cursorIdx]);

  const food = SUPERFOODS[activeIdx];
  const wp = CURSOR_WAYPOINTS[cursorIdx];

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden pb-[108px]"
      style={{
        marginTop: -topOffset,
        paddingTop: topOffset + 64,
        background: "linear-gradient(180deg, #0F2A21 0%, #143628 100%)",
      }}
    >
      {/* shared hand-drawn filter */}
      <svg aria-hidden className="absolute w-0 h-0 overflow-hidden">
        <defs>
          <filter id="sketchy" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>


      <div className="mx-auto max-w-7xl container-px relative z-20">

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: DS_EASE }}
          className="font-display font-semibold tracking-[-0.02em] text-[56px] leading-[1.04] sm:text-[48px] sm:leading-[1.02] lg:text-[72px] lg:leading-[1.0] text-[#F3EFE6] text-center"
        >
          <span className="relative inline-block">
            Less pills,{" "}
            <em className="font-display italic font-normal text-[#F3EFE6]">more real food</em>
            {/* hand-drawn underline */}
            <motion.svg
              aria-hidden
              className="absolute pointer-events-none"
              style={{ left: "-4%", width: "108%", bottom: "-0.18em", height: "0.34em", overflow: "visible" }}
              viewBox="0 0 340 18"
              preserveAspectRatio="none"
              fill="none"
              opacity="0.10"
              stroke="#C2902F"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M4 11C56 6 110 5 168 7C226 9 282 8 336 5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.32, delay: 0.32, ease: DS_EASE }}
              />
              <motion.path
                d="M10 15C66 12 134 12 200 13C244 13.6 290 13 330 11"
                stroke="#C2902F"
                strokeWidth="2.2"
                opacity="0.10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.32, delay: 0.4, ease: DS_EASE }}
              />
            </motion.svg>
          </span>

        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.12, ease: DS_EASE }}
          className="font-sans mt-4 max-w-[34ch] mx-auto text-[17px] sm:text-[19px] leading-snug text-[#F3EFE6]/85 text-center tracking-tight"
        >
          A simple diet change can reverse many chronic conditions — the question is{" "}
          <em className="font-display italic text-[#F3EFE6]">what foods to eat.</em>
        </motion.p>

        <div className="relative z-10 flex flex-col items-center mt-8">
          <button
            onClick={() => navigate("/onboarding")}
            className="rounded-full bg-forest-700 hover:bg-forest-800 active:translate-y-[1px] active:scale-[0.98] text-white text-[16px] px-7 py-3 font-semibold transition-all duration-200"
          >
            Get your personalized plan
          </button>
          <p className="font-sans mt-3 text-center text-[11px] sm:text-[12px] text-[#F3EFE6]/80 tracking-tight">
            Built on 100k+ real scientific articles, for real, unique people
          </p>
        </div>

        {/* section label — signals "this is the product" */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.2, ease: DS_EASE }}
          className="mt-12 flex items-center justify-center gap-3"
        >
          <span className="h-px w-8 bg-[#F3EFE6]/25" />
          <span className="font-label text-[12px] font-semibold tracking-[0.14em] uppercase text-yellow-400">
            See it in action
          </span>
          <span className="h-px w-8 bg-[#F3EFE6]/25" />
        </motion.div>

        {/* ── unified app window ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.24, ease: DS_EASE }}
          className="relative z-10 mt-6 mx-auto max-w-5xl rounded-[5px] bg-white border border-char-900/[0.08] overflow-hidden aspect-video"
          style={{
            boxShadow: "0 4px 24px rgba(45,36,24,0.12), 0 25px 50px -12px rgba(45,36,24,0.18)"
          }}
        >
          {/* cursor overlay */}
          <motion.div
            className="absolute z-50 pointer-events-none hidden lg:block"
            animate={{ left: wp.x, top: wp.y, scale: isClicking ? 0.72 : 1 }}
            transition={{ left: { duration: 0.32, ease: DS_EASE }, top: { duration: 0.32, ease: DS_EASE }, scale: { duration: 0.12 } }}
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
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[0.10] relative z-50 bg-forest-800">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-slow-pulse" />
            <span className="text-[11px] sm:text-[13px] font-medium tracking-tight text-white">
              Nutri <span className="text-white/50">·</span>{" "}
              <span className="text-white/80">Personal Remedies</span>
            </span>
            <span className="ml-auto text-[9px] sm:text-[11px] text-white/60">demo</span>
          </div>

          {/* two-pane body */}
          <div className="flex divide-x divide-char-900/[0.06] h-full">

            {/* LEFT PANEL */}
            <div className="w-[42%] shrink-0 flex flex-col bg-forest-50">

              {/* Nutri Recommendations */}
              <div className="px-4 pt-4 pb-3 border-b border-black/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] sm:text-[11px] font-semibold tracking-widest uppercase text-char-900/40">
                    Nutri Recommendations
                  </span>
                  <span className="flex gap-1">
                    {SUPERFOODS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        className={`h-1.5 rounded-full transition-all duration-200 ${i === activeIdx ? "bg-forest w-4" : "bg-char-900/20 w-1.5"
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
                    transition={{ duration: 0.2, ease: DS_EASE }}
                    className="flex items-center gap-2.5 mb-3"
                  >
                    <span className="text-2xl sm:text-3xl leading-none select-none" aria-hidden>{food.emoji}</span>
                    <div>
                      <p className="text-[12px] sm:text-[14px] font-semibold tracking-tight text-char-900 leading-none">{food.name}</p>
                      <p className="text-[9px] sm:text-[11px] text-char-900/45 mt-0.5">{food.tag}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="space-y-2">
                  {food.stats.map(({ label }, rowIdx) => (
                    <div key={rowIdx} className={`flex items-center justify-between gap-2 ${rowIdx >= 3 ? "hidden lg:flex" : ""}`}>
                      <span className="text-[10px] sm:text-[12px] text-char-900/60 truncate">{label}</span>
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
                                transition={{ duration: 0.12, ease: DS_EASE }}
                                className="text-[9px] sm:text-[11px] font-semibold text-char-900 block"
                              >
                                {animatedRatings[rowIdx]}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </span>
                        <span className="text-[9px] sm:text-[11px] text-char-900/30 font-normal">/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your Profile */}
              <div className="px-4 pt-3 pb-4 flex-1">
                <p className="text-[9px] sm:text-[11px] font-semibold tracking-widest uppercase text-char-900/40 mb-2.5">
                  Your Profile
                </p>
                <p className="text-[9px] sm:text-[11px] text-char-900/50 mb-1.5 font-medium">Conditions</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {CONDITIONS.map(({ label, color }) => (
                    <span key={label} className={`text-[9px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
                      {label}
                    </span>
                  ))}
                </div>
                <p className="hidden sm:block text-[9px] sm:text-[11px] text-char-900/50 mb-1.5 font-medium">Preferences</p>
                <div className="hidden sm:flex flex-wrap gap-1.5">
                  {PREFERENCES.map((pref) => (
                    <span key={pref} className="text-[9px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-forest/10 text-forest">
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL — chat */}
            <div className="flex-1 flex flex-col h-full relative -translate-y-20">
              <div
                className="flex-1 flex flex-col-reverse overflow-hidden bg-paper-100 -translate-y-20"
                style={{ padding: "20px", paddingBottom: "60px", gap: "14px" }}
              >
                {/* typing indicator — first in DOM = very bottom */}
                {showTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: DS_EASE }}
                    className="flex justify-start shrink-0"
                  >
                    <div className="bg-white border border-char-900/[0.06] rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
                      {[0, 0.18, 0.36].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-char-900/30 animate-slow-pulse"
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
                      transition={{ duration: 0.2, ease: DS_EASE }}
                      className={`flex shrink-0 ${m.from === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[11px] sm:text-[13.5px] leading-[1.55] ${m.from === "user"
                          ? "bg-forest-700 text-white rounded-tr-md"
                          : "bg-white text-char-900 rounded-tl-md border border-char-900/[0.06]"
                          }`}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* input bar */}
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-char-900/[0.06] flex items-center gap-2 bg-white">
                <div className="flex-1 rounded-full bg-paper-100 px-4 py-2 text-[11px] sm:text-[13px] border border-char-900/[0.06] flex items-center min-w-0">
                  {inputText ? (
                    <>
                      <span className="text-char-900 truncate">{inputText}</span>
                      <span className="ml-px inline-block w-[1.5px] h-3.5 bg-char-900/70 shrink-0 animate-slow-pulse" />
                    </>
                  ) : (
                    <span className="text-char-900/40">Ask Nutri anything…</span>
                  )}
                </div>
                <button
                  className="h-8 w-8 rounded-full bg-forest-700 text-white flex items-center justify-center shrink-0"
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
        className={`left-6 right-6 z-40 ${isFixed ? "fixed bottom-0" : "absolute bottom-0"}`}
      >
        <TrustStrip />
      </div>
    </section>
  );
}
