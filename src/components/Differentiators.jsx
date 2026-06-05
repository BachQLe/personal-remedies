import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Reveal } from "./Reveal";

const CONDITIONS = [
  { id: "diabetes", label: "Type 2 Diabetes" },
  { id: "hypertension", label: "Hypertension" },
  { id: "kidney", label: "Kidney Disease" },
];

function getRecommendation(profileIds) {
  if (profileIds.includes("kidney")) {
    return {
      verdict: "Avoid",
      score: 12,
      reason:
        "Garlic's potassium content can stress compromised kidneys, and its antiplatelet effect may interact with medications commonly used in CKD management.",
    };
  }
  if (profileIds.includes("hypertension")) {
    return {
      verdict: "Excellent fit",
      score: 94,
      reason:
        "Garlic's allicin compounds have shown meaningful systolic blood pressure reduction in meta-analyses — a strong advantage for hypertension alongside a diabetes-friendly glycemic profile.",
    };
  }
  return {
    verdict: "Good fit",
    score: 68,
    reason:
      "Garlic shows modest improvements in insulin sensitivity and fasting glucose in T2D patients. Benefits are real but secondary to first-line dietary changes.",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function barColor(score) {
  if (score >= 80) return "#1F4A3A";
  if (score >= 50) return "#D98A4A";
  return "#ef4444";
}

function badgeClass(score) {
  if (score >= 80) return "bg-sage-soft text-forest";
  if (score >= 50) return "bg-amber/15 text-amber";
  return "bg-red-50 text-red-600";
}

// Nudge the ghost chip relative to where the chip actually sits.
// 0,0 = ghost top-left aligns with chip top-left (cursor tip inside chip).
// Tweak if the chip appears offset from where it should be.
const GHOST_OFFSET_X = 0;
const GHOST_OFFSET_Y = 0;

export default function Differentiators() {
  const [profileIds, setProfileIds] = useState(["diabetes", "hypertension", "kidney"]);
  const [draggingId, setDraggingId] = useState(null);
  const [ghostLabel, setGhostLabel] = useState("");

  const containerRef = useRef(null);
  const chipRefs = useRef({});
  const profileBoxRef = useRef(null);
  const poolBoxRef = useRef(null);

  // x/y are CSS transforms — framer-motion handles these natively and reliably
  const cursorAnim = useAnimation();
  const ghostAnim = useAnimation();

  const rec = getRecommendation(profileIds);
  const poolIds = CONDITIONS.map((c) => c.id).filter((id) => !profileIds.includes(id));

  async function drag(id, destRef, nextIds, destXOffset = 16) {
    const container = containerRef.current;
    const chip = chipRefs.current[id];
    const destBox = destRef.current;
    if (!container || !chip || !destBox) return;

    const cr = container.getBoundingClientRect();
    const mr = chip.getBoundingClientRect();
    const br = destBox.getBoundingClientRect();

    // x/y are offsets from the container's top-left (where the absolute elements live)
    const chipX = mr.left - cr.left;
    const chipY = mr.top - cr.top;

    // Cursor tip sits at chip center (SVG tip is top-left of the 16x20 cursor)
    const curX = chipX + mr.width / 2 - 8;
    const curY = chipY + mr.height / 2 - 10;

    // Ghost appears exactly where the chip is
    const ghostX = chipX + GHOST_OFFSET_X;
    const ghostY = chipY + GHOST_OFFSET_Y;

    // Destination: mid-left area of the dest box
    const destX = br.left - cr.left + destXOffset;
    const destY = br.top - cr.top + br.height * 0.52;

    // dx/dy keeps ghost locked to cursor throughout the drag
    const dx = ghostX - curX;
    const dy = ghostY - curY;

    // 1. Cursor glides to chip
    await cursorAnim.start({ x: curX, y: curY, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } });
    await sleep(280);

    // 2. Grab — chip dims, ghost appears
    setDraggingId(id);
    const c = CONDITIONS.find((c) => c.id === id);
    setGhostLabel(c.label);
    await ghostAnim.start({ x: ghostX, y: ghostY, opacity: 1, scale: 1, transition: { duration: 0.15 } });
    await sleep(60);

    // 3. Drag cursor + ghost to destination
    const destCurX = destX;
    const destCurY = destY;
    await Promise.all([
      cursorAnim.start({ x: destCurX, y: destCurY, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] } }),
      ghostAnim.start({ x: destCurX + dx, y: destCurY + dy, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] } }),
    ]);
    await sleep(80);

    // 4. Drop
    setProfileIds(nextIds);
    await ghostAnim.start({ opacity: 0, scale: 0.88, transition: { duration: 0.2 } });
    setGhostLabel("");
    await sleep(180);
    setDraggingId(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await sleep(600);
      if (cancelled) return;

      // Place cursor off-screen then fade in
      const kidneyEl = chipRefs.current["kidney"];
      if (kidneyEl && containerRef.current) {
        const cr = containerRef.current.getBoundingClientRect();
        const mr = kidneyEl.getBoundingClientRect();
        const sx = mr.left - cr.left + mr.width / 2 - 8;
        const sy = mr.top - cr.top + mr.height / 2 - 10;
        await cursorAnim.start({ x: sx + 60, y: sy - 14, opacity: 0, transition: { duration: 0 } });
      }
      await ghostAnim.start({ x: -400, y: 0, opacity: 0, scale: 0.88, transition: { duration: 0 } });
      await cursorAnim.start({ opacity: 1, transition: { duration: 0.38 } });

      await sleep(800);
      if (cancelled) return;

      while (!cancelled) {
        await drag("kidney", poolBoxRef, ["diabetes", "hypertension"]);
        if (cancelled) break;
        await sleep(2000);
        if (cancelled) break;

        await drag("hypertension", poolBoxRef, ["diabetes"]);
        if (cancelled) break;
        await sleep(2000);
        if (cancelled) break;

        await drag("hypertension", profileBoxRef, ["diabetes", "hypertension"], 60);
        if (cancelled) break;
        await sleep(1000);
        if (cancelled) break;

        await drag("kidney", profileBoxRef, ["diabetes", "hypertension", "kidney"], 60);
        if (cancelled) break;
        await sleep(1000);
      }
    }

    run();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="how" className="py-8 lg:py-12">
      <div className="mx-auto max-w-5xl container-px grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

        {/* Left: text */}
        <div>
          <Reveal delay={0.1}>
            <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[44px] sm:leading-[1.08] lg:text-[54px] lg:leading-[1.06] max-w-[22ch]">
              Handles multiple conditions.{" "}
            </h2>
            <h2 className="mt-2 font-display italic text-[18px] sm:text-[22px] text-slate-900/70 tracking-tight">
              general advice is dead. know exactly what is and isn&apos;t helping your conditions{" "}
            </h2>
          </Reveal>
        </div>

        {/* Right: animation */}
        <Reveal delay={0.15}>
          <div ref={containerRef} className="relative select-none">

            {/* Condition boxes */}
            <div className="grid grid-cols-2 gap-3 mb-3">

              <div ref={profileBoxRef} className="rounded-2xl border border-ink/[0.08] bg-white p-4 h-[172px] overflow-hidden shadow-card">
                <p className="text-[9.5px] font-semibold tracking-widest uppercase text-ink/35 mb-3">Your Profile</p>
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {profileIds.map((id) => {
                      const c = CONDITIONS.find((c) => c.id === id);
                      return (
                        <motion.div
                          key={id}
                          ref={(el) => { if (el) chipRefs.current[id] = el; }}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: draggingId === id ? 0.2 : 1, y: 0, scale: draggingId === id ? 0.94 : 1 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium bg-sage-soft text-forest border border-forest/15"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-forest/50 flex-shrink-0" />
                          {c.label}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              <div ref={poolBoxRef} className="rounded-2xl border border-dashed border-ink/[0.12] bg-cream/50 p-4 h-[172px] overflow-hidden">
                <p className="text-[9.5px] font-semibold tracking-widest uppercase text-ink/25 mb-3">Not in profile</p>
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {poolIds.map((id) => {
                      const c = CONDITIONS.find((c) => c.id === id);
                      return (
                        <motion.div
                          key={id}
                          ref={(el) => { if (el) chipRefs.current[id] = el; }}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: draggingId === id ? 0.2 : 0.55, y: 0, scale: draggingId === id ? 0.94 : 1 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium bg-white text-ink/45 border border-ink/10"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-ink/20 flex-shrink-0" />
                          {c.label}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Garlic card */}
            <div className="rounded-2xl border border-ink/[0.08] bg-white p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[22px] leading-none">🧄</span>
                <div>
                  <p className="font-semibold text-ink text-[14.5px] leading-tight">Garlic</p>
                  <p className="text-[11px] text-ink/40 leading-tight">Allium sativum</p>
                </div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={rec.verdict}
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.82 }}
                    transition={{ duration: 0.22 }}
                    className={`ml-auto text-[12px] font-semibold px-2.5 py-1 rounded-full ${badgeClass(rec.score)}`}
                  >
                    {rec.verdict}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="h-1.5 rounded-full bg-ink/[0.06] overflow-hidden mb-4">
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${rec.score}%`, backgroundColor: barColor(rec.score) }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <div className="pt-3 border-t border-ink/[0.06]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="h-3.5 w-3.5 rounded-full bg-amber flex items-center justify-center flex-shrink-0">
                    <span className="text-[8px] text-white font-bold leading-none">N</span>
                  </span>
                  <p className="text-[9.5px] font-semibold tracking-widest uppercase text-ink/35">Nutri reasoning</p>
                </div>
                {/* Fixed height so the card doesn't resize when text swaps */}
                <div className="h-[88px] overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={rec.verdict}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="text-[13px] leading-[1.65] text-ink-soft"
                    >
                      {rec.reason}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Ghost chip — always in DOM, moved via x/y transforms */}
            <motion.div
              animate={ghostAnim}
              initial={{ x: -400, y: 0, opacity: 0, scale: 0.88 }}
              className="absolute top-0 left-0 pointer-events-none z-40 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium bg-sage-soft text-forest border border-forest/20 shadow-lift"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-forest/50 flex-shrink-0" />
              {ghostLabel}
            </motion.div>

            {/* Cursor — matches Hero.jsx */}
            <motion.div
              animate={cursorAnim}
              initial={{ x: 0, y: 0, opacity: 0 }}
              className="absolute top-0 left-0 pointer-events-none z-50"
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

          </div>
        </Reveal>
      </div>
    </section>
  );
}
