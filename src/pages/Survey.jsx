import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { conditions as allConditions } from "../data/conditions";

const steps = [
  {
    id: "goal",
    question: "What's your main goal?",
    options: [
      "Lose weight",
      "Manage a chronic condition",
      "Boost energy & focus",
      "Improve gut health",
      "Reduce inflammation",
    ],
  },
  {
    id: "condition",
    question: "Any conditions we should know about?",
    multiSelect: true,
    quickOptions: [
      "Diabetes / pre-diabetes",
      "High blood pressure",
      "High cholesterol",
      "Thyroid issues",
    ],
  },
  {
    id: "diet",
    question: "Any dietary restrictions?",
    options: [
      "No restrictions",
      "Vegetarian",
      "Vegan",
      "Gluten-free",
      "Dairy-free",
    ],
  },
  {
    id: "age",
    question: "What's your age range?",
    options: ["Under 25", "25-34", "35-44", "45-54", "55+"],
  },
];

const facts = [
  {
    stat: "30%",
    claim: "A Mediterranean diet can reduce your risk of heart disease by 30%.",
    source: "Johns Hopkins Medicine",
  },
  {
    stat: "8 in 10",
    claim: "8 in 10 chronic diseases are preventable through nutrition and lifestyle changes.",
    source: "PMC / peer-reviewed",
  },
  {
    stat: "55%",
    claim: "Higher folate intake from leafy greens can reduce depression risk by up to 55%.",
    source: "American Journal of Psychiatry",
  },
  {
    stat: "70%",
    claim: "70% of the immune system lives in the gut -- what you eat is your first line of defense.",
    source: "Cleveland Clinic",
  },
  {
    stat: "in just 4-8 weeks",
    claim: "People who added fermented foods to their diet reported better mood and lower stress in as little as 4-8 weeks.",
    source: "peer-reviewed study, 2022",
  },
  {
    stat: "80%",
    claim: "A Mediterranean diet can reduce the risk of early death by up to 80%.",
    source: "Johns Hopkins Medicine",
  },
  {
    stat: "number 1",
    claim: "Nutrition is the single most powerful lever you have over your long-term health.",
    source: "Harvard Health",
  },
];

/* DS spring-settle: small settle, no bounce */
const chipSpring = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.32, ease: [0.22, 0.61, 0.36, 1] },
};

export default function Survey() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [multiSelected, setMultiSelected] = useState([]);
  const [conditionTyped, setConditionTyped] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [fact] = useState(() => facts[Math.floor(Math.random() * facts.length)]);

  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  function advance(value) {
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    if (step + 1 < steps.length) {
      setStep(step + 1);
    } else {
      setLoading(true);
      const delay = 4000 + Math.random() * 2000;
      setTimeout(() => { setLoading(false); setDone(true); }, delay);
    }
  }

  function handleSelect(option) {
    setSelected(option);
    setTimeout(() => {
      setSelected(null);
      advance(option);
    }, 260);
  }

  function handleConditionInput(e) {
    const val = e.target.value;
    setConditionTyped(val);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    const lower = val.toLowerCase();
    setSuggestions(
      allConditions
        .filter((c) => c.toLowerCase().includes(lower) && !multiSelected.includes(c))
        .slice(0, 6)
    );
  }

  function addCondition(condition) {
    if (!multiSelected.includes(condition)) {
      setMultiSelected((prev) => [...prev, condition]);
    }
    setConditionTyped("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function removeCondition(condition) {
    setMultiSelected((prev) => prev.filter((c) => c !== condition));
  }

  function toggleQuickSelect(option) {
    setMultiSelected((prev) => {
      if (prev.includes(option)) return prev.filter((o) => o !== option);
      if (prev.length >= 3) return prev;
      return [...prev, option];
    });
  }

  function handleConditionContinue() {
    const value = multiSelected.length ? multiSelected : ["None"];
    setMultiSelected([]);
    setConditionTyped("");
    setSuggestions([]);
    advance(value);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
    else navigate("/");
  }

  return (
    <div className="min-h-screen bg-paper-200 flex flex-col">
      {/* top bar */}
      <header className="flex items-center px-6 py-4 border-b border-sand-200">
        <button
          onClick={() => navigate("/")}
          className="font-display font-semibold text-[22px] tracking-tightish text-char-900"
        >
          personalRemedies
        </button>
      </header>

      {/* progress bar */}
      {!loading && (
        <div className="flex justify-center px-5 pt-4 pb-1">
          <div className="w-full max-w-lg flex items-center gap-3">
            <span className="font-mono text-[12px] text-char-500 whitespace-nowrap shrink-0">
              {done ? "Done" : `Step ${step + 1} of ${steps.length}`}
            </span>
            <div className="flex-1 h-1.5 bg-sand-200 rounded-pill overflow-hidden">
              <motion.div
                className="h-full bg-forest-700 rounded-pill"
                animate={{ width: done ? "100%" : `${progress}%` }}
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex items-start justify-center px-5 pt-8 pb-16">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.8 } }}
                transition={{ duration: 0.32 }}
                className="w-full"
              >
                {/* Spinner + label */}
                <div className="text-center mb-5 pt-10">
                  <div className="mx-auto mb-5 w-14 h-14 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-[3px] border-forest-700 border-t-transparent animate-spin" />
                  </div>
                  <h2 className="font-display font-semibold tracking-tightish text-[24px] text-char-900 leading-snug">
                    Building your personalized plan
                  </h2>
                  <p className="text-sm text-char-500 mt-2 font-sans">
                    This takes about 6 seconds.
                  </p>
                </div>

                {/* Fun fact card */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <p className="text-[12px] uppercase tracking-eyebrow text-char-500 mb-2 text-center font-sans">
                    A fact while you wait
                  </p>
                  <div className="bg-white rounded-xl border border-sand-200 shadow-card px-8 py-5 text-left">
                    <p className="font-display font-semibold text-[24px] text-forest-700 leading-none mb-3">
                      {fact.stat}
                    </p>
                    <p className="text-[18px] leading-[1.6] text-char-900 font-sans mb-2">
                      {fact.claim}
                    </p>
                    <p className="text-[12px] text-char-500 font-sans">-- {fact.source}</p>
                  </div>
                </motion.div>
              </motion.div>
            ) : done ? (
              <motion.div key="done" {...slide} className="text-center">
                {/* Success icon */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={chipSpring}
                  className="w-16 h-16 rounded-full bg-forest-100 flex items-center justify-center mx-auto mb-4"
                >
                  <span className="material-symbols-rounded fill text-forest-700 text-[36px]">
                    check_circle
                  </span>
                </motion.div>

                <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans">Your plan is ready</p>
                <h2 className="font-display font-semibold tracking-tightish mt-3 text-[36px] sm:text-[48px] leading-[1.06] text-char-900">
                  Here's{" "}
                  <em className="font-display italic font-normal text-forest-700 mr-1">your</em>
                  {" "}superfood plan.
                </h2>

                <p className="mt-4 text-base leading-[1.65] text-char-500 max-w-[38ch] mx-auto font-sans">
                  {[
                    answers.goal && `Optimized to help you ${answers.goal.toLowerCase()}`,
                    answers.condition && answers.condition[0] !== "None" && `with ${answers.condition.join(", ").toLowerCase()} in mind`,
                    answers.diet && answers.diet !== "No restrictions" && `and built around a ${answers.diet.toLowerCase()} lifestyle`,
                  ].filter(Boolean).join(", ")}.
                </p>

                <button
                  onClick={() => navigate("/login")}
                  className="mt-7 inline-flex items-center gap-2 text-[15px] px-7 py-3.5 rounded-pill bg-forest-700 hover:bg-forest-800 text-white font-semibold transition-colors duration-fast min-h-[48px] font-sans"
                >
                  Get my free plan
                  <span className="material-symbols-rounded text-[18px]">arrow_forward</span>
                </button>

                {/* Personalized summary */}
                <div className="mt-5 text-left bg-white rounded-xl border border-sand-200 shadow-card divide-y divide-sand-200 overflow-hidden">
                  {answers.goal && (
                    <div className="px-4 py-3">
                      <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans">Your goal</p>
                      <p className="text-sm font-medium text-char-900 mt-0.5 font-sans">{answers.goal}</p>
                    </div>
                  )}
                  {answers.condition && answers.condition[0] !== "None" && (
                    <div className="px-4 py-3">
                      <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans">Conditions</p>
                      <p className="text-sm font-medium text-char-900 mt-0.5 font-sans">{answers.condition.join(", ")}</p>
                    </div>
                  )}
                  {answers.diet && (
                    <div className="px-4 py-3">
                      <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans">Diet</p>
                      <p className="text-sm font-medium text-char-900 mt-0.5 font-sans">{answers.diet}</p>
                    </div>
                  )}
                  {answers.age && (
                    <div className="px-4 py-3">
                      <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans">Age range</p>
                      <p className="text-sm font-medium text-char-900 mt-0.5 font-sans">{answers.age}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-1.5 mx-auto mt-4 text-sm text-char-500 hover:text-char-900 transition-colors duration-fast min-h-[44px] font-sans"
                >
                  <span className="material-symbols-rounded text-[18px]">arrow_back</span>
                  Back to home
                </button>
              </motion.div>
            ) : (
              <motion.div key={step} {...slide}>
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-char-500 hover:text-char-900 transition-colors duration-fast min-h-[44px] font-sans"
                  >
                    <span className="material-symbols-rounded text-[18px]">arrow_back</span>
                    Back
                  </button>
                )}
                <p className="text-[12px] uppercase tracking-eyebrow text-char-500 mb-5 font-sans">
                  Question {step + 1}
                </p>
                <h2 className="font-display font-semibold tracking-tightish text-[28px] sm:text-[36px] leading-[1.1] text-char-900 mb-8">
                  {current.question}
                </h2>

                {current.multiSelect ? (
                  <>
                    {/* Tag input with autocomplete */}
                    <div className="relative mb-3">
                      <div
                        onClick={() => inputRef.current?.focus()}
                        className="min-h-[44px] w-full px-3 py-2 rounded-md border border-sand-200 bg-white flex flex-wrap gap-2 cursor-text focus-within:ring-2 focus-within:ring-forest-700 focus-within:border-forest-700 transition-colors duration-fast"
                      >
                        {multiSelected.map((tag) => (
                          <motion.span
                            key={tag}
                            layout
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={chipSpring}
                            className="inline-flex items-center gap-1.5 bg-forest-700 text-white text-sm font-medium px-3 py-1 rounded-pill"
                          >
                            {tag}
                            <button
                              onClick={(e) => { e.stopPropagation(); removeCondition(tag); }}
                              className="text-white/70 hover:text-white transition-colors duration-fast leading-none"
                            >
                              <span className="material-symbols-rounded text-[14px]">close</span>
                            </button>
                          </motion.span>
                        ))}
                        <input
                          ref={inputRef}
                          type="text"
                          value={conditionTyped}
                          onChange={handleConditionInput}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && suggestions.length > 0) addCondition(suggestions[0]);
                            if (e.key === "Escape") setSuggestions([]);
                          }}
                          placeholder={multiSelected.length === 0 ? "Search conditions..." : ""}
                          className="flex-1 min-w-[140px] bg-transparent text-sm text-char-900 placeholder:text-char-400 focus:outline-none py-1 px-2 font-sans"
                        />
                      </div>

                      {/* Dropdown suggestions */}
                      {suggestions.length > 0 && (
                        <div className="absolute z-10 top-full mt-1.5 w-full bg-white rounded-xl border border-sand-200 shadow-md overflow-hidden">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              onMouseDown={(e) => { e.preventDefault(); addCondition(s); }}
                              className="w-full text-left px-5 py-3 text-sm text-char-900 hover:bg-paper-200 transition-colors duration-fast min-h-[44px] font-sans"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[12px] uppercase tracking-eyebrow text-char-500 mb-2 font-sans">
                      Common conditions -- pick up to 3
                    </p>
                    <div className="flex flex-col gap-2">
                      {current.quickOptions.map((opt) => {
                        const isActive = multiSelected.includes(opt);
                        const isDisabled = !isActive && multiSelected.length >= 3;
                        return (
                          <motion.button
                            key={opt}
                            whileTap={{ scale: 0.98 }}
                            transition={chipSpring}
                            onClick={() => !isDisabled && toggleQuickSelect(opt)}
                            className={`w-full text-left px-5 py-3.5 rounded-pill border text-sm font-medium transition-all duration-fast min-h-[44px] font-sans ${isActive
                              ? "border-forest-700 bg-forest-700 text-white"
                              : isDisabled
                                ? "border-sand-200 bg-white text-char-300 cursor-not-allowed"
                                : "border-sand-200 bg-white text-char-900 hover:border-forest-700"
                              }`}
                          >
                            {opt}
                          </motion.button>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleConditionContinue}
                      disabled={multiSelected.length === 0}
                      className={`mt-5 w-full flex items-center justify-center gap-2 text-sm py-3.5 rounded-pill bg-forest-700 hover:bg-forest-800 text-white font-semibold transition-colors duration-fast min-h-[48px] font-sans ${multiSelected.length === 0 ? "opacity-40 cursor-not-allowed" : ""
                        }`}
                    >
                      Continue
                      <span className="material-symbols-rounded text-[18px]">arrow_forward</span>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    {current.options.map((opt) => (
                      <motion.button
                        key={opt}
                        whileTap={{ scale: 0.98 }}
                        transition={chipSpring}
                        onClick={() => handleSelect(opt)}
                        className={`w-full text-left px-5 py-4 rounded-pill border text-sm font-medium transition-all duration-fast min-h-[48px] font-sans ${selected === opt
                          ? "border-forest-700 bg-forest-700 text-white"
                          : "border-sand-200 bg-white text-char-900 hover:border-forest-700"
                          }`}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
