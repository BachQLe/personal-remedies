import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getRecommendations, saveDailyPlan } from "../../api/recommendations";
import { MEAL_SLOTS } from "../../types/recommendations";
import MealStepCards from "./MealStepCards.jsx";
import ConfirmationOverview from "./ConfirmationOverview.jsx";

const CARDS_PER_PAGE = 3;
const RECS_PER_SLOT = 12;
const SWIPE_THRESHOLD = 60;
const BG_COLOR = "#111E58";

// Word-by-word reveal (matches onboarding RemediWelcome)
const WORD_IN = 0.4;
const WORD_STEP = 0.085;
const WORD_DROP = -12;
const WORD_BLUR = 4;
const EASE_OUT = [0.22, 1, 0.36, 1];
const BEAT = 0.45;
const FINDING_INITIAL_DELAY = 1.0;

function buildChunks(phrases) {
  let start = 0;
  const chunks = phrases.map((p) => {
    const words = p.text.split(' ');
    const chunk = { gap: p.gap, words, start };
    start += words.length;
    return chunk;
  });
  const total = chunks.reduce((n, c) => n + c.words.length, 0);
  return { chunks, total };
}

const FINDING = buildChunks([
  { text: "We're finding the recipes", gap: 0 },
  { text: 'tailored for your conditions', gap: BEAT },
]);


const FOUND = buildChunks([
  { text: 'We found the recipes', gap: 0 },
  { text: 'tailored for your conditions', gap: BEAT },
]);

const MEAL_LABELS = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

const softSpring = { type: "spring", stiffness: 200, damping: 26, mass: 0.8 };
const snappySlide = { type: "spring", stiffness: 1400, damping: 60, mass: 0.3 };
const snappyVertical = { type: "spring", stiffness: 1800, damping: 65, mass: 0.2 };

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir * -48 }),
};

const verticalSlideVariants = {
  enter: (dir) => ({ opacity: 0, y: dir * 60 }),
  center: { opacity: 1, y: 0 },
  exit: (dir) => ({ opacity: 0, y: dir * -60 }),
};

function StepBar({ current, total, gold }) {
  const fillBg = gold
    ? `linear-gradient(
        -45deg,
        #facc15 0%, #facc15 15%,
        #fde047 15%, #fde047 25%,
        #facc15 25%, #facc15 50%,
        #fde047 50%, #fde047 75%,
        #facc15 75%, #facc15 100%
      )`
    : "white";
  return (
    <div className="flex items-center gap-2 w-full max-w-[280px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-[18px] rounded-full overflow-hidden"
          style={{
            border: gold
              ? "4px solid rgba(250,204,21,0.4)"
              : "4px solid rgba(255,255,255,0.2)",
            background: "transparent",
          }}
        >
          <motion.div
            className="h-full rounded-full origin-left"
            style={{ background: fillBg, backgroundSize: "20px 20px" }}
            initial={false}
            animate={{ scaleX: i <= current ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      ))}
    </div>
  );
}

function AnimatedMealWord({ word }) {
  const [measuredWidths, setMeasuredWidths] = useState(null);
  const prevWidthRef = useRef(null);

  useEffect(() => {
    const el = document.createElement("span");
    el.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap;font-size:28px;font-weight:600;letter-spacing:-0.01em;";
    el.className = "font-display";
    document.body.appendChild(el);
    const w = {};
    for (const label of Object.values(MEAL_LABELS)) {
      el.textContent = label;
      w[label] = Math.ceil(el.getBoundingClientRect().width) + 2;
    }
    document.body.removeChild(el);
    setMeasuredWidths(w);
  }, []);

  const currentWidth = measuredWidths?.[word];
  const isWider =
    prevWidthRef.current != null &&
    currentWidth != null &&
    currentWidth > prevWidthRef.current;
  const isNarrower =
    prevWidthRef.current != null &&
    currentWidth != null &&
    currentWidth < prevWidthRef.current;

  useEffect(() => {
    if (currentWidth != null) prevWidthRef.current = currentWidth;
  }, [currentWidth]);

  const fastSpring = { type: "spring", stiffness: 800, damping: 38, mass: 0.25 };
  const widthDelay = isNarrower ? 0.18 : 0;
  const textDelay = isWider ? 0.12 : 0;

  return (
    <motion.span
      style={{
        display: "inline-flex",
        overflow: "hidden",
        verticalAlign: "baseline",
        justifyContent: "center",
        height: "1.15em",
      }}
      animate={{ width: currentWidth || "auto" }}
      transition={{ ...fastSpring, delay: widthDelay }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          initial={{ y: "-110%", opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            transition: { ...fastSpring, delay: textDelay },
          }}
          exit={{ y: "110%", opacity: 0, transition: fastSpring }}
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

export default function DailyPicksScreen() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("loading");
  const [mealIndex, setMealIndex] = useState(0);
  const [cardPage, setCardPage] = useState(0);
  const [picksBySlot, setPicksBySlot] = useState(() =>
    Object.fromEntries(MEAL_SLOTS.map((s) => [s, []])),
  );
  const [allRecsBySlot, setAllRecsBySlot] = useState(() =>
    Object.fromEntries(MEAL_SLOTS.map((s) => [s, []])),
  );
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);
  const [swipeAxis, setSwipeAxis] = useState("x");
  const [loadComplete, setLoadComplete] = useState(false);

  const reduceMotion = useReducedMotion();
  const [wordsRevealed, setWordsRevealed] = useState(0);
  const [showSubtext, setShowSubtext] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);
  const revealTimersRef = useRef([]);

  // Word-by-word reveal during loading phase
  useEffect(() => {
    if (phase !== 'loading') return;
    if (reduceMotion) {
      setWordsRevealed(FINDING.total);
      setShowSubtext(true);
      return;
    }

    setWordsRevealed(0);
    setShowSubtext(false);
    const timers = revealTimersRef.current;
    const at = (s, fn) => timers.push(setTimeout(fn, s * 1000));

    let t = FINDING_INITIAL_DELAY;
    FINDING.chunks.forEach((chunk) => {
      t += chunk.gap;
      chunk.words.forEach((_, wi) => {
        const idx = chunk.start + wi;
        at(t + wi * WORD_STEP, () => setWordsRevealed((r) => Math.max(r, idx + 1)));
      });
      t += (chunk.words.length - 1) * WORD_STEP;
    });

    at(FINDING_INITIAL_DELAY, () => setShowSubtext(true));

    return () => { timers.forEach(clearTimeout); timers.length = 0; };
  }, [phase, reduceMotion]);

  // Auto-advance 1s after loading completes
  useEffect(() => {
    if (!loadComplete) return;
    const t = setTimeout(() => {
      setPhase('picking');
      setMealIndex(0);
    }, 1000);
    return () => clearTimeout(t);
  }, [loadComplete]);

  // Button fade-in when returning to "ready" via Back
  useEffect(() => {
    if (phase !== 'ready') { setButtonVisible(false); return; }
    const t = setTimeout(() => setButtonVisible(true), 400);
    return () => clearTimeout(t);
  }, [phase]);

  const currentSlot = MEAL_SLOTS[mealIndex];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const startTime = Date.now();
      const results = await Promise.all(
        MEAL_SLOTS.map((slot) => getRecommendations(slot, 0, RECS_PER_SLOT)),
      );
      if (cancelled) return;

      const bySlot = Object.fromEntries(
        MEAL_SLOTS.map((slot, i) => [slot, results[i]]),
      );
      setAllRecsBySlot(bySlot);

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 8500 - elapsed);
      await new Promise((r) => setTimeout(r, remaining));

      if (!cancelled) setLoadComplete(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePick = useCallback((rec) => {
    setPicksBySlot((prev) => {
      const list = prev[rec.slot] ?? [];
      const exists = list.some((r) => r.id === rec.id);
      return {
        ...prev,
        [rec.slot]: exists
          ? list.filter((r) => r.id !== rec.id)
          : [...list, rec],
      };
    });
  }, []);

  const finalPicksBySlot = useMemo(() => {
    const result = {};
    for (const slot of MEAL_SLOTS) {
      const userPicks = picksBySlot[slot] ?? [];
      if (userPicks.length > 0) {
        result[slot] = userPicks;
      } else {
        result[slot] = (allRecsBySlot[slot] ?? []).slice(0, 3);
      }
    }
    return result;
  }, [picksBySlot, allRecsBySlot]);

  const autoFilledIds = useMemo(() => {
    const ids = new Set();
    for (const slot of MEAL_SLOTS) {
      const userPicks = picksBySlot[slot] ?? [];
      if (userPicks.length === 0) {
        const autoFilled = (allRecsBySlot[slot] ?? []).slice(0, 3);
        autoFilled.forEach((r) => ids.add(r.id));
      }
    }
    return ids;
  }, [picksBySlot, allRecsBySlot]);

  const selectedIds = useMemo(() => {
    return new Set((picksBySlot[currentSlot] ?? []).map((r) => r.id));
  }, [picksBySlot, currentSlot]);

  const visibleRecipes = useMemo(() => {
    const all = allRecsBySlot[currentSlot] ?? [];
    const start = cardPage * CARDS_PER_PAGE;
    return all.slice(start, start + CARDS_PER_PAGE);
  }, [allRecsBySlot, currentSlot, cardPage]);

  const dragRef = useRef(null);

  const handleDragEnd = useCallback(
    (_, info) => {
      if (info.offset.y < -SWIPE_THRESHOLD) {
        const allForSlot = allRecsBySlot[currentSlot] ?? [];
        const maxPage = Math.ceil(allForSlot.length / CARDS_PER_PAGE) - 1;
        if (cardPage < maxPage) {
          setSwipeAxis("y");
          setDirection(1);
          setCardPage((p) => p + 1);
        }
      } else if (info.offset.y > SWIPE_THRESHOLD) {
        if (cardPage > 0) {
          setSwipeAxis("y");
          setDirection(-1);
          setCardPage((p) => p - 1);
        }
      }
    },
    [allRecsBySlot, currentSlot, cardPage],
  );

  const handleBack = () => {
    setSwipeAxis("x");
    setDirection(-1);
    if (mealIndex > 0) {
      setMealIndex((i) => i - 1);
      setCardPage(0);
    } else {
      setPhase("ready");
    }
  };

  const handleNext = () => {
    setSwipeAxis("x");
    setDirection(1);
    if (mealIndex < MEAL_SLOTS.length - 1) {
      setMealIndex((i) => i + 1);
      setCardPage(0);
    } else {
      setPhase("overview");
    }
  };

  const totalPages = Math.ceil(
    (allRecsBySlot[currentSlot]?.length ?? 0) / CARDS_PER_PAGE,
  );

  const handleBuild = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const allSelections = MEAL_SLOTS.flatMap((s) => finalPicksBySlot[s] ?? []);
      await saveDailyPlan(allSelections);
    } finally {
      navigate("/app/week");
    }
  };

  return (
    <div
      className="h-screen flex flex-col items-center overflow-hidden"
      style={{ backgroundColor: BG_COLOR }}
    >
      <div className="w-full max-w-[430px] flex flex-col flex-1 h-full relative overflow-hidden">
        {phase === "ready" && (
          <button
            onClick={() => navigate("/onboarding")}
            aria-label="Back to onboarding"
            className="absolute top-6 left-5 z-20 p-2 text-white/25 hover:text-white/60 transition-colors duration-fast bg-transparent border-none cursor-pointer"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
              <path d="M11 8.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
              <path d="M11 15.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
            </svg>
          </button>
        )}
        {(phase === "picking" || phase === "overview") && (
          <div
            className="flex-none px-6 pt-24 pb-2 relative z-10 flex justify-center"
            style={{ backgroundColor: BG_COLOR }}
          >
            <StepBar
              current={phase === "overview" ? MEAL_SLOTS.length : mealIndex}
              total={MEAL_SLOTS.length}
              gold={phase === "overview"}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{
                enter: { duration: 0.8, ease: "easeOut" },
                exit: { duration: 0.4, ease: "easeIn" },
              }}
              className="flex-1 flex flex-col items-center justify-center px-10 text-center"
            >
              <div className="w-20 h-20 mb-6 relative flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!loadComplete ? (
                    <motion.svg
                      key="spinner"
                      className="w-full h-full animate-spin absolute"
                      viewBox="0 0 80 80"
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.3 }}
                    >
                      <circle
                        cx="40" cy="40" r="30"
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="12"
                      />
                      <circle
                        cx="40" cy="40" r="30"
                        fill="none"
                        stroke="white"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray="50 139"
                      />
                    </motion.svg>
                  ) : (
                    <motion.div
                      key="fork"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...softSpring, duration: 0.5 }}
                      className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"
                    >
                      <span className="material-symbols-rounded text-[32px] text-white/90">
                        restaurant
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <motion.p
                initial={false}
                animate={{ opacity: showSubtext ? 1 : 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                className="text-xs text-white/50 mb-6 font-sans"
              >
                This takes about 5 seconds
              </motion.p>
              <p className="font-display text-[26px] font-semibold tracking-tightish text-white leading-tight mb-3">
                {FINDING.chunks.flatMap((chunk, ci) =>
                  chunk.words.map((word, wi) => {
                    const idx = chunk.start + wi;
                    const last = ci === FINDING.chunks.length - 1 && wi === chunk.words.length - 1;
                    return (
                      <motion.span
                        key={idx}
                        className={`inline-block${last ? '' : ' mr-[0.27em]'}`}
                        initial={false}
                        animate={
                          wordsRevealed > idx
                            ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                            : { opacity: 0, y: WORD_DROP, filter: `blur(${WORD_BLUR}px)` }
                        }
                        transition={{ duration: WORD_IN, ease: EASE_OUT }}
                      >
                        {word}
                      </motion.span>
                    );
                  })
                )}
              </p>
            </motion.div>
          )}

          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={softSpring}
              className="flex-1 flex flex-col items-center justify-center px-10 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
                <span className="material-symbols-rounded text-[32px] text-white/90">
                  restaurant
                </span>
              </div>
              <p className="font-display text-[26px] font-semibold tracking-tightish text-white leading-tight mb-3">
                {FOUND.chunks.map((chunk) => chunk.words.join(' ')).join(' ')}
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: buttonVisible ? 1 : 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                onClick={() => {
                  setPhase("picking");
                  setMealIndex(0);
                }}
                className="mt-8 px-8 py-4 rounded-xl bg-white text-[16px] font-semibold tracking-wide font-sans shadow-lg"
                style={{ color: BG_COLOR, pointerEvents: buttonVisible ? 'auto' : 'none' }}
              >
                Let me see!
              </motion.button>
            </motion.div>
          )}

          {phase === "picking" && (
            <motion.div
              key="picking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={softSpring}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Persistent title — only the meal word animates */}
              <div className="flex-none px-6 mt-4">
                <h2 className="font-display text-[28px] font-semibold tracking-tightish text-white leading-tight text-center">
                  Pick{" "}
                  <AnimatedMealWord word={MEAL_LABELS[currentSlot]} />
                  {" "}foods for
                  <br />
                  your meal plan
                </h2>
              </div>

              {/* Swipeable card area */}
              <motion.div
                ref={dragRef}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                className="flex-1 px-5 pt-4 pb-2 flex flex-col min-h-0"
              >
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={`page-${mealIndex}-${cardPage}`}
                    custom={direction}
                    variants={swipeAxis === "y" ? verticalSlideVariants : slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={swipeAxis === "y" ? snappyVertical : snappySlide}
                  >
                    <MealStepCards
                      recipes={visibleRecipes}
                      selectedIds={selectedIds}
                      onToggle={togglePick}
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="flex flex-col items-center gap-1.5 pt-4">
                  <div className="flex items-center justify-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                        style={{
                          background:
                            i === cardPage
                              ? "white"
                              : "rgba(255,255,255,0.25)",
                          transform: i === cardPage ? "scale(1.4)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-white/35">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M8.5 7.5L12 4L15.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <path d="M8.5 16.5L12 20L15.5 16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <span className="text-[12px] font-sans font-medium tracking-wide">
                      Swipe to see other recipes
                    </span>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          )}

          {phase === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={softSpring}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto px-5 pt-2 overscroll-contain">
                <ConfirmationOverview
                  picksBySlot={finalPicksBySlot}
                  autoFilledIds={autoFilledIds}
                  onBuild={handleBuild}
                  saving={saving}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(phase === "picking" || phase === "overview") && (
          <div
            className="flex-none px-6 pt-3 pb-6 relative z-10 rounded-t-xl"
            style={{ backgroundColor: BG_COLOR }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={
                  phase === "overview"
                    ? () => {
                      setDirection(-1);
                      setPhase("picking");
                      setMealIndex(MEAL_SLOTS.length - 1);
                    }
                    : handleBack
                }
                className="flex-1 text-sm font-medium text-white/60 hover:text-white/90 transition-colors duration-fast font-sans bg-transparent border-none cursor-pointer py-4 min-h-[48px] flex items-center justify-center gap-1"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line
                    x1="7"
                    y1="12"
                    x2="17"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="square"
                  />
                  <path
                    d="M11 8.5 Q10 12 7 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="square"
                    fill="none"
                  />
                  <path
                    d="M11 15.5 Q10 12 7 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="square"
                    fill="none"
                  />
                </svg>
                Back
              </button>
              {phase === "overview" ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  transition={softSpring}
                  onClick={handleBuild}
                  disabled={saving}
                  className="relative flex-[2] py-4 rounded-sm text-[18px] font-semibold tracking-wide font-sans transition-all duration-fast min-h-[52px] flex items-center justify-center gap-2 overflow-hidden disabled:opacity-50"
                  style={{
                    color: BG_COLOR,
                    background: `linear-gradient(
                      -45deg,
                      #facc15 0%,
                      #facc15 15%,
                      #fde047 15%,
                      #fde047 25%,
                      #facc15 25%,
                      #facc15 50%,
                      #fde047 50%,
                      #fde047 75%,
                      #facc15 75%,
                      #facc15 100%
                    )`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <span
                    className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2"
                    style={{ borderColor: BG_COLOR }}
                  />
                  {saving ? (
                    <span className="w-5 h-5 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                  ) : (
                    "Build my plan"
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  transition={softSpring}
                  onClick={handleNext}
                  className="relative flex-[2] py-4 rounded-sm text-[16px] font-semibold tracking-wide font-sans shadow-lg hover:shadow-xl transition-all duration-fast min-h-[52px] flex items-center justify-center gap-2 overflow-hidden bg-white"
                  style={{ color: BG_COLOR }}
                >
                  <span
                    className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2"
                    style={{ borderColor: BG_COLOR }}
                  />
                  {mealIndex < MEAL_SLOTS.length - 1
                    ? "Next"
                    : "Review my plan"}
                </motion.button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
