import { useState } from 'react';
import { motion } from 'framer-motion';
import { lbsToKg, kgToLbs } from '../../api/calorieNeeds.js';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };
const snappySpring = { type: 'spring', stiffness: 600, damping: 38, mass: 0.7 };

// Brand back arrow — same SVG as ProfileBuilder.jsx, used everywhere instead
// of icon-font arrows.
function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      <path d="M11 8.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
      <path d="M11 15.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
    </svg>
  );
}

const inputClass =
  'w-full px-4 py-[15px] rounded-full border-[1.5px] border-[#E6E6E0] bg-white text-[16px] text-char-900 placeholder:text-[#8A8377] font-sans shadow-sm transition-all duration-fast ease-ds-out focus:outline-none focus:border-[#9B7DC8] focus:shadow-sm';

/**
 * BiometricsStep — final, fully-skippable onboarding step that collects the
 * optional biometrics behind `estimateDailyNeed` (src/api/calorieNeeds.js):
 * weight. Nothing here is required — the
 * app (and this very flow) works identically with none of it set. The copy
 * is deliberately framed around portion-sizing, not tracking, per the frozen
 * "no calorie tracking" product rule: this number renders once, at the
 * plan level, never as a running log.
 *
 * Mirrors ProfileBuilder.jsx's step chrome (tan top/bottom bars, blue form
 * area, same spring transitions) so the two onboarding steps read as one
 * continuous flow.
 *
 * @param {{
 *   profile: import('../../api/types.js').Profile,
 *   onSubmit: (metricPatch: Partial<import('../../api/types.js').Profile>) => void,
 *   onSkip: () => void,
 *   saving: boolean,
 *   onBack: () => void,
 * }} props
 */
export default function BiometricsStep({ profile, onSubmit, onSkip, saving, onBack }) {
  const [weightLbs, setWeightLbs] = useState(
    profile?.weightKg ? String(Math.round(kgToLbs(profile.weightKg))) : ''
  );

  const buildPatch = () => {
    const patch = {};
    if (weightLbs.trim()) {
      const kg = lbsToKg(Number(weightLbs));
      if (kg > 0) patch.weightKg = Math.round(kg * 10) / 10;
    }
    return patch;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* ── Top bar (tan): back + title ─────────────────────────────────────── */}
      <motion.div
        initial={{ y: '-100%', filter: 'blur(6px) drop-shadow(0 8px 10px rgba(0,0,0,0.15))' }}
        animate={{ y: 0, filter: 'blur(0px) drop-shadow(0 8px 10px rgba(0,0,0,0.15))' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], filter: { duration: 0.3, ease: 'easeOut' } }}
        className="flex-none px-6 pt-14 pb-4 relative z-10 bg-paper-200 overflow-visible"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-sand-200 text-char-900 shadow-xs transition-colors duration-fast hover:bg-sand-100 flex-shrink-0"
            aria-label="Go back"
          >
            <BackArrow />
          </button>
          <h2 className="font-semibold tracking-tight text-[16px] text-char-900 leading-tight" style={{ fontFamily: 'Quantico, sans-serif' }}>
            Size your portions
          </h2>
        </div>
        <div
          className="absolute -bottom-[40px] right-0 w-[40px] h-[40px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at bottom left, transparent 40px, #F5F5F0 40px)' }}
        />
      </motion.div>

      {/* ── Form area (blue) ────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden hide-scrollbar flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#BBCEFF' }}>
        <div className="w-full max-w-[420px] flex flex-col">
          <motion.h3
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...snappySpring, delay: 0.1 }}
            className="font-semibold tracking-normal leading-tight text-[26px] text-center text-blue-950"
            style={{ fontFamily: 'Chillax, sans-serif' }}
          >
            One optional detail
          </motion.h3>
          <p className="text-[13px] text-center text-blue-950/70 font-sans mt-2 mb-6 px-2">
            This helps us size your daily plan's portions — we're not a calorie tracker, and you can skip this entirely.
          </p>

          {/* Weight */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-blue-950 uppercase tracking-wider px-1">Weight (lbs)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              placeholder="e.g. 160"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom bar (tan): skip + save ───────────────────────────────────── */}
      <motion.div
        initial={{ y: '100%', filter: 'blur(6px)' }}
        animate={{ y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], filter: { duration: 0.3, ease: 'easeOut' } }}
        className="flex-none px-6 pt-3 pb-6 bg-paper-200 rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            disabled={saving}
            className="flex-1 text-sm font-medium text-char-500 hover:text-char-700 transition-colors duration-fast font-sans bg-transparent border-none cursor-pointer py-4 min-h-[48px] flex items-center justify-center disabled:opacity-40"
          >
            Skip for now
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={chipSpring}
            onClick={() => onSubmit(buildPatch())}
            disabled={saving}
            className="relative flex-[2] py-4 rounded-sm text-white font-semibold text-base bg-blue-900 hover:bg-blue-950 transition-all duration-fast disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px] font-sans flex items-center justify-center gap-2 overflow-hidden shadow-lg hover:shadow-xl"
          >
            <span className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white" />
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              'Show my top foods!'
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
