import { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Blue onboarding panel (design system: blue-200)
const BG = '#BBCEFF';

// ----------------------------------------------------------------------------
// Timing — every beat lives here so the moment can be tuned by feel.
// ----------------------------------------------------------------------------
const INITIAL_DELAY = 0.6; // breath before words start
const WORD_IN = 0.4; // per-word fade duration (quick)
const WORD_STEP = 0.085; // gap between words within a chunk
const WORD_DROP = -12; // px — words start above and fall into place
const WORD_BLUR = 4; // px — subtle blur that clears as word lands
const BEAT = 0.45; // pause after first chunk — just enough to feel human
const BEAT_LONG = 0.7; // slightly longer before the payoff

const BUTTON_DELAY = 0.7; // after the body settles
const BUTTON_IN = 0.6;
const SUBTEXT_DELAY = 0.45;
const SUBTEXT_IN = 0.5;

const EASE_OUT = [0.22, 1, 0.36, 1];

const PHRASES = [
  { text: 'Everyday food can have medicinal effects.', gap: 0 },
  { text: 'But first —', gap: BEAT },
  { text: 'we want to know you.', gap: BEAT_LONG },
];

const CHUNKS = (() => {
  let start = 0;
  return PHRASES.map((p) => {
    const words = p.text.split(' ');
    const chunk = { gap: p.gap, words, start };
    start += words.length;
    return chunk;
  });
})();
const TOTAL_WORDS = CHUNKS.reduce((n, c) => n + c.words.length, 0);

export default function RemediWelcome({ onNext }) {
  const reduce = useReducedMotion();
  const instant = !!reduce;

  const [revealed, setRevealed] = useState(instant ? TOTAL_WORDS : 0);
  const [showButton, setShowButton] = useState(instant);
  const [showSubtext, setShowSubtext] = useState(instant);
  const [finished, setFinished] = useState(instant);
  const [firstName, setFirstName] = useState('');

  const canSubmit = finished && firstName.trim().length > 0;

  const timersRef = useRef([]);

  useEffect(() => {
    if (instant) return;

    const timers = timersRef.current;
    const at = (s, fn) => timers.push(setTimeout(fn, s * 1000));

    let t = INITIAL_DELAY;
    CHUNKS.forEach((chunk) => {
      t += chunk.gap;
      chunk.words.forEach((_, wi) => {
        const idx = chunk.start + wi;
        at(t + wi * WORD_STEP, () => setRevealed((r) => Math.max(r, idx + 1)));
      });
      t += (chunk.words.length - 1) * WORD_STEP;
    });

    t += WORD_IN + BUTTON_DELAY;
    at(t, () => {
      setShowButton(true);
      setFinished(true);
    });
    t += SUBTEXT_DELAY;
    at(t, () => setShowSubtext(true));

    return () => timers.forEach(clearTimeout);
  }, [instant]);

  const skip = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRevealed(TOTAL_WORDS);
    setShowButton(true);
    setShowSubtext(true);
    setFinished(true);
  };

  return (
    <div
      className="flex flex-col flex-1 px-7 pb-10 relative overflow-hidden"
      style={{ backgroundColor: BG }}
    >
      {!finished && (
        <button
          type="button"
          aria-label="Skip intro"
          onClick={skip}
          className="absolute inset-0 z-20 cursor-default"
        />
      )}

      {/* "Welcome" — static heading, always visible, Quantico label font */}
      <h2
        className="text-blue-950/40 text-[13px] font-label uppercase tracking-[0.14em] mt-24 mb-10 text-left"
      >
        Welcome
      </h2>

      <div className="relative z-10 w-full max-w-[360px] mx-auto flex flex-col flex-1 justify-center">
        <p className="text-blue-950 text-[34px] leading-tight font-semibold tracking-normal text-center" style={{ fontFamily: 'Chillax, sans-serif' }}>
          {CHUNKS.flatMap((chunk, ci) =>
            chunk.words.map((word, wi) => {
              const idx = chunk.start + wi;
              const last = ci === CHUNKS.length - 1 && wi === chunk.words.length - 1;
              return (
                <motion.span
                  key={idx}
                  className={`inline-block${last ? '' : ' mr-[0.27em]'}`}
                  initial={false}
                  animate={
                    revealed > idx
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

        <div className="mt-9 flex flex-col items-center">
          <motion.div
            initial={false}
            animate={{ opacity: showButton ? 1 : 0 }}
            transition={{ duration: BUTTON_IN, ease: EASE_OUT }}
            style={{ pointerEvents: showButton ? 'auto' : 'none' }}
            className="w-full flex justify-center mb-4"
          >
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) onNext(firstName.trim());
              }}
              placeholder="Your first name"
              aria-label="Your first name"
              autoComplete="given-name"
              enterKeyHint="next"
              className="w-full max-w-[280px] text-center px-5 py-3.5 rounded-pill border-[1.5px] border-blue-950/15 bg-white/70 text-blue-950 placeholder:text-blue-950/40 text-base font-sans shadow-sm outline-none transition-all duration-fast focus:border-blue-950/40 focus:bg-white"
            />
          </motion.div>

          <motion.button
            onClick={canSubmit ? () => onNext(firstName.trim()) : undefined}
            disabled={!canSubmit}
            initial={false}
            animate={{ opacity: !showButton ? 0 : canSubmit ? 1 : 0.5 }}
            transition={{ duration: BUTTON_IN, ease: EASE_OUT }}
            className="px-12 py-4 rounded-pill text-blue-950 font-semibold text-base bg-white hover:bg-white/90 transition-colors duration-fast min-h-[48px] font-sans shadow-md disabled:cursor-not-allowed"
            style={{ pointerEvents: showButton && canSubmit ? 'auto' : 'none' }}
          >
            Set up my profile
          </motion.button>

          <motion.p
            initial={false}
            animate={{ opacity: showSubtext ? 1 : 0 }}
            transition={{ duration: SUBTEXT_IN, ease: EASE_OUT }}
            className="text-xs text-blue-950/50 mt-4 font-sans"
          >
            Takes about 2 minutes
          </motion.p>
        </div>
      </div>
    </div>
  );
}
