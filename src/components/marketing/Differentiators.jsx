import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Reveal } from "./Reveal";
import SignalChip from "../shared/SignalChip";
import Icon from "../shared/Icon";

const CONDITIONS = [
  { id: "diabetes", label: "Type 2 Diabetes" },
  { id: "hypertension", label: "Hypertension" },
  { id: "kidney", label: "Kidney Disease" },
];

function getRecommendation(profileIds) {
  if (profileIds.includes("kidney")) {
    return {
      verdict: "Avoid",
      signal: "avoid",
      score: 12,
      reason:
        "Garlic's potassium content can stress compromised kidneys, and its antiplatelet effect may interact with medications commonly used in CKD management.",
    };
  }
  if (profileIds.includes("hypertension")) {
    return {
      verdict: "Beneficial",
      signal: "beneficial",
      score: 94,
      reason:
        "Garlic's allicin compounds have shown meaningful systolic blood pressure reduction in meta-analyses -- a strong advantage for hypertension alongside a diabetes-friendly glycemic profile.",
    };
  }
  return {
    verdict: "Limit",
    signal: "limit",
    score: 68,
    reason:
      "Garlic shows modest improvements in insulin sensitivity and fasting glucose in T2D patients. Benefits are real but secondary to first-line dietary changes.",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function barColor(score) {
  if (score >= 80) return "rgb(47, 140, 90)";
  if (score >= 50) return "rgb(201, 138, 46)";
  return "rgb(192, 74, 47)";
}

// Nudge the ghost chip relative to where the chip actually sits.
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

    const chipX = mr.left - cr.left;
    const chipY = mr.top - cr.top;
    const curX = chipX + mr.width / 2 - 8;
    const curY = chipY + mr.height / 2 - 10;
    const ghostX = chipX + GHOST_OFFSET_X;
    const ghostY = chipY + GHOST_OFFSET_Y;
    const destX = br.left - cr.left + destXOffset;
    const destY = br.top - cr.top + br.height * 0.52;
    const dx = ghostX - curX;
    const dy = ghostY - curY;

    await cursorAnim.start({ x: curX, y: curY, transition: { duration: 0.48, ease: [0.22, 0.61, 0.36, 1] } });
    await sleep(280);

    setDraggingId(id);
    const c = CONDITIONS.find((c) => c.id === id);
    setGhostLabel(c.label);
    await ghostAnim.start({ x: ghostX, y: ghostY, opacity: 1, scale: 1, transition: { duration: 0.15 } });
    await sleep(60);

    const destCurX = destX;
    const destCurY = destY;
    await Promise.all([
      cursorAnim.start({ x: destCurX, y: destCurY, transition: { duration: 0.62, ease: [0.22, 0.61, 0.36, 1] } }),
      ghostAnim.start({ x: destCurX + dx, y: destCurY + dy, transition: { duration: 0.62, ease: [0.22, 0.61, 0.36, 1] } }),
    ]);
    await sleep(80);

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
    <section id="how" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl container-px overflow-hidden px-8 py-12 lg:px-14 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* Left: text */}
          <div>
            <Reveal delay={0.1}>
              <span className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-char-500">
                Multi-condition intelligence
              </span>
              <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[48px] sm:leading-[1.08] lg:text-[64px] lg:leading-[1.06] max-w-[22ch]">
                Handles multiple conditions.
              </h2>
              <p className="mt-3 font-sans text-[18px] sm:text-[20px] text-char-500 tracking-tight leading-[1.5]">
                General advice is dead. Know exactly what is and isn&apos;t helping your conditions.
              </p>
            </Reveal>
          </div>

          {/* Right: animation */}
          <Reveal delay={0.15}>
            <div ref={containerRef} className="relative select-none">

              {/* Condition boxes */}
              <div className="grid grid-cols-2 gap-3 mb-3 relative z-10">

                <div ref={profileBoxRef} className="rounded-xl border border-sand-200 bg-paper-200 p-4 h-[172px] overflow-hidden shadow-card">
                  <p className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-char-500 mb-3">Your profile</p>
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
                            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
                            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium bg-forest-100 text-forest-700 border border-forest-700/15"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-forest-700/50 flex-shrink-0" />
                            {c.label}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>

                <div ref={poolBoxRef} className="rounded-xl border border-dashed border-sand-200 bg-paper-100 p-4 h-[172px] overflow-hidden">
                  <p className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-char-400 mb-3">Not in profile</p>
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
                            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
                            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium bg-white text-char-500 border border-sand-200"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-char-300 flex-shrink-0" />
                            {c.label}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Garlic card */}
              <div className="rounded-xl border border-sand-200 bg-white p-5 shadow-card relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="leaf" size={24} className="text-forest-500" />
                  <div>
                    <p className="font-sans font-semibold text-char-900 text-[14.5px] leading-tight">Garlic</p>
                    <p className="text-[11px] font-sans text-char-400 leading-tight">Allium sativum</p>
                  </div>
                  <div className="ml-auto">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={rec.verdict}
                        initial={{ opacity: 0, scale: 0.82 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.82 }}
                        transition={{ duration: 0.22 }}
                      >
                        <SignalChip signal={rec.signal} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-char-900/10 overflow-hidden mb-4">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${rec.score}%`, backgroundColor: barColor(rec.score) }}
                    transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
                  />
                </div>

                <div className="pt-3 border-t border-sand-200">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon name="zap" size={14} className="text-yellow-400" />
                    <p className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-char-500">Nutri reasoning</p>
                  </div>
                  {/* Fixed height so the card doesn't resize when text swaps */}
                  <div className="h-[88px] overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={rec.verdict}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
                        className="text-[13px] font-sans leading-[1.65] text-char-900"
                      >
                        {rec.reason}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 3D Depth Container for frame only */}
              <div className="absolute inset-0 pointer-events-none" style={{
                perspective: '1200px',
                transformStyle: 'preserve-3d',
                inset: '-20px',
                zIndex: 1,
              }}>
                <div className="absolute inset-0 rounded-xl border border-sand-200" style={{
                  transform: 'translateZ(20px)',
                  background: 'linear-gradient(to right, var(--forest-700, #1E4736) 0%, var(--forest-500, #3A7058) 100%)',
                  boxShadow: '0 14px 40px rgba(30, 71, 54, 0.25)',
                }} />
              </div>

              {/* Ghost chip */}
              <motion.div
                animate={ghostAnim}
                initial={{ x: -400, y: 0, opacity: 0, scale: 0.88 }}
                className="absolute top-0 left-0 pointer-events-none z-[100] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium bg-forest-100 text-forest-700 border border-forest-700/20 shadow-md"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-forest-700/50 flex-shrink-0" />
                {ghostLabel}
              </motion.div>

              {/* Cursor */}
              <motion.div
                animate={cursorAnim}
                initial={{ x: 0, y: 0, opacity: 0 }}
                className="absolute top-0 left-0 pointer-events-none z-[200]"
                style={{ transform: 'translateZ(100px)' }}
              >
                <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                  <path
                    d="M2 2 L2 16 L5.5 12.5 L8 18.5 L10 17.5 L7.5 11.5 L13 11.5 Z"
                    fill="white"
                    stroke="#211E1B"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>

            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
