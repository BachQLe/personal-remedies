import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useTime, useTransform } from "framer-motion";
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
    options: ["Under 25", "25–34", "35–44", "45–54", "55+"],
  },
];

const facts = [
  {
    stat: "80%",
    claim: "of chronic diseases are preventable through diet and lifestyle.",
    source: "PMC, peer-reviewed",
  },
  {
    stat: "#1",
    claim: "Poor diet is the #1 cause of death in the US.",
    source: "NIH",
  },
  {
    stat: "6 in 10",
    claim: "Americans have a chronic disease linked to poor diet.",
    source: "CDC",
  },
  {
    stat: "#2",
    claim: "Unhealthy diet is the #2 cause of cardiovascular death — behind only smoking.",
    source: "WHO",
  },
];

function OrbitingCarrot({ phase }) {
  const time = useTime();
  const angle = useTransform(time, (t) => (t / 4000) * 2 * Math.PI + phase);
  const x = useTransform(angle, (a) => Math.cos(a) * 26);
  const y = useTransform(angle, (a) => Math.sin(a) * 26);

  return (
    <motion.div style={{ position: "absolute", top: "50%", left: "50%", x, y, marginLeft: -6, marginTop: -10 }}>
      <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4 C4.5 1.5 2 1 2.5 3 C3 4.5 4.5 4 6 4Z" fill="#5a9e4a" />
        <path d="M6 4 C7.5 1.5 10 1 9.5 3 C9 4.5 7.5 4 6 4Z" fill="#5a9e4a" />
        <path d="M6 4 C6 1 6 0 6 1.5Z" fill="#4a8e3a" />
        <path d="M3.5 5 Q2 11 6 19 Q10 11 8.5 5 Q7 3.5 6 3.5 Q5 3.5 3.5 5Z" fill="#e8722a" />
        <path d="M5 6.5 Q4.5 10 5 13" stroke="#f09050" strokeWidth="0.9" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
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
  const progress = (step / steps.length) * 100;

  function advance(value) {
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    if (step + 1 < steps.length) {
      setStep(step + 1);
    } else {
      setLoading(true);
      const delay = 5000 + Math.random() * 3000;
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
    <div className="min-h-screen bg-cream flex flex-col">
      {/* top bar */}
      <header className="flex items-center px-6 py-4 border-b border-ink/[0.06]">
        <button
          onClick={() => navigate("/")}
          style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }}
          className="text-[22px] tracking-tight text-ink"
        >
          personalRemedies
        </button>
      </header>

      {/* progress bar — centered, limited width */}
      <div className="flex justify-center px-5 pt-4 pb-1">
        <div className="w-full max-w-lg flex items-center gap-3">
          <span className="text-[12px] text-ink-soft font-medium whitespace-nowrap shrink-0">
            {done ? "Done" : `${step + 1} of ${steps.length}`}
          </span>
          <div className="flex-1 h-1 bg-ink/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-forest rounded-full"
              animate={{ width: done || loading ? "100%" : `${progress}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>

      <main className="flex-1 flex items-start justify-center px-5 pt-8 pb-16">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 1 } }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                {/* Spinner + label */}
                <div className="text-center mb-5">
                  <div className="mx-auto mb-5" style={{ width: 72, height: 72, position: "relative" }}>
                    <OrbitingCarrot phase={0} />
                    <OrbitingCarrot phase={(2 * Math.PI) / 3} />
                    <OrbitingCarrot phase={(4 * Math.PI) / 3} />
                  </div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-forest/60 mb-1">
                    Sorting your plan…
                  </p>
                  <p className="text-[20px] font-display text-ink leading-snug">
                    Building your personalised plan.
                  </p>
                </div>

                {/* Skeleton card — large, looks like plan content loading in */}
                <div className="rounded-2xl border border-ink/[0.08] bg-white px-7 py-7 mb-5 animate-pulse">
                  <div className="h-3 bg-ink/[0.08] rounded-full w-1/4 mb-5" />
                  <div className="h-5 bg-ink/[0.07] rounded-full w-3/4 mb-3" />
                  <div className="h-4 bg-ink/[0.05] rounded-full w-full mb-2" />
                  <div className="h-4 bg-ink/[0.05] rounded-full w-5/6 mb-7" />
                  <div className="space-y-2.5">
                    <div className="h-10 bg-ink/[0.05] rounded-xl w-full" />
                    <div className="h-10 bg-ink/[0.05] rounded-xl w-full" />
                    <div className="h-10 bg-ink/[0.05] rounded-xl w-full" />
                  </div>
                </div>

                {/* Fun fact — separate card below, fades in after delay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.6 }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/30 mb-3 text-center">
                    A fact while you wait
                  </p>
                  <div className="rounded-2xl border border-ink/[0.08] bg-white px-8 py-7 text-left">
                    <p className="text-[48px] font-display font-bold text-forest leading-none mb-3">
                      {fact.stat}
                    </p>
                    <p className="text-[16px] leading-[1.6] text-ink font-medium mb-3">
                      {fact.claim}
                    </p>
                    <p className="text-[12px] text-ink/40 font-medium">— {fact.source}</p>
                  </div>
                </motion.div>
              </motion.div>
            ) : done ? (
              <motion.div key="done" {...slide} className="text-center">
                <span className="tag">Your plan is ready</span>
                <h2 className="display mt-5 text-[36px] sm:text-[48px] leading-[1.06]">
                  Here's{" "}
                  <em className="font-display italic font-normal text-forest mr-1">your</em>
                  {" "}superfood plan.
                </h2>

                <p className="mt-4 text-[16px] leading-[1.65] text-ink-soft max-w-[38ch] mx-auto">
                  {[
                    answers.goal && `Optimized to help you ${answers.goal.toLowerCase()}`,
                    answers.condition && answers.condition[0] !== "None" && `with ${answers.condition.join(", ").toLowerCase()} in mind`,
                    answers.diet && answers.diet !== "No restrictions" && `and built around a ${answers.diet.toLowerCase()} lifestyle`,
                  ].filter(Boolean).join(", ")}.
                </p>

                <a href="#" className="pill-forest mt-7 inline-flex text-[15px] px-7 py-3.5">
                  Get my free plan
                </a>

                {/* Personalized summary */}
                <div className="mt-5 text-left rounded-xl border border-ink/[0.08] bg-white divide-y divide-ink/[0.06] overflow-hidden">
                  {answers.goal && (
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Your goal</p>
                      <p className="text-[12px] font-medium text-ink">{answers.goal}</p>
                    </div>
                  )}
                  {answers.condition && answers.condition[0] !== "None" && (
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Conditions</p>
                      <p className="text-[12px] font-medium text-ink">{answers.condition.join(", ")}</p>
                    </div>
                  )}
                  {answers.diet && (
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Diet</p>
                      <p className="text-[12px] font-medium text-ink">{answers.diet}</p>
                    </div>
                  )}
                  {answers.age && (
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Age range</p>
                      <p className="text-[12px] font-medium text-ink">{answers.age}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate("/")}
                  className="block mt-4 mx-auto text-[13px] text-ink-soft hover:text-ink transition-colors"
                >
                  ← Back to home
                </button>
              </motion.div>
            ) : (
              <motion.div key={step} {...slide}>
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="mb-6 text-[13px] font-semibold text-ink/50 hover:text-ink transition-colors"
                  >
                    ← Back
                  </button>
                )}
                <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-forest/70 mb-5">
                  Question {step + 1}
                </p>
                <h2 className="display text-[28px] sm:text-[36px] leading-[1.1] mb-8">
                  {current.question}
                </h2>

                {current.multiSelect ? (
                  <>
                    {/* Tag input with autocomplete */}
                    <div className="relative mb-3">
                      <div
                        onClick={() => inputRef.current?.focus()}
                        className="min-h-[44px] w-full px-3 py-2 rounded-xl border border-ink/12 bg-white flex flex-wrap gap-2 cursor-text focus-within:border-forest/60 transition-colors"
                      >
                        {multiSelected.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 bg-forest/10 text-forest text-[13px] font-medium px-3 py-1 rounded-full"
                          >
                            {tag}
                            <button
                              onClick={(e) => { e.stopPropagation(); removeCondition(tag); }}
                              className="text-forest/60 hover:text-forest transition-colors leading-none"
                            >
                              ×
                            </button>
                          </span>
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
                          placeholder={multiSelected.length === 0 ? "Search conditions…" : ""}
                          className="flex-1 min-w-[140px] bg-transparent text-[15px] text-ink placeholder:text-ink/30 focus:outline-none py-1 px-2"
                        />
                      </div>

                      {/* Dropdown suggestions */}
                      {suggestions.length > 0 && (
                        <div className="absolute z-10 top-full mt-1.5 w-full bg-white rounded-xl border border-ink/10 shadow-lift overflow-hidden">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              onMouseDown={(e) => { e.preventDefault(); addCondition(s); }}
                              className="w-full text-left px-5 py-3 text-[14px] text-ink hover:bg-sage-soft transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[12px] font-semibold text-ink/40 uppercase tracking-[0.14em] mb-2">
                      Common conditions — pick up to 3
                    </p>
                    <div className="flex flex-col gap-2">
                      {current.quickOptions.map((opt) => {
                        const isActive = multiSelected.includes(opt);
                        const isDisabled = !isActive && multiSelected.length >= 3;
                        return (
                          <button
                            key={opt}
                            onClick={() => !isDisabled && toggleQuickSelect(opt)}
                            className={`w-full text-left px-5 py-3 rounded-xl border text-[15px] font-medium transition-all duration-150 ${isActive
                              ? "border-forest bg-forest text-cream shadow-lift"
                              : isDisabled
                                ? "border-ink/8 bg-white text-ink/30 cursor-not-allowed"
                                : "border-ink/12 bg-white text-ink hover:border-forest/40 hover:bg-sage-soft"
                              }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleConditionContinue}
                      disabled={multiSelected.length === 0}
                      className={`mt-5 pill-forest w-full justify-center text-[15px] py-3 ${multiSelected.length === 0 ? "opacity-40 cursor-not-allowed" : ""
                        }`}
                    >
                      Continue →
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleSelect(opt)}
                        className={`w-full text-left px-5 py-4 rounded-xl border text-[15px] font-medium transition-all duration-150 ${selected === opt
                          ? "border-forest bg-forest text-cream shadow-lift"
                          : "border-ink/12 bg-white text-ink hover:border-forest/40 hover:bg-sage-soft"
                          }`}
                      >
                        {opt}
                      </button>
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
