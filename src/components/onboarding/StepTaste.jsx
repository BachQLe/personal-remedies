import { useState, useCallback, useMemo } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { TASTE_PROBES, inferTasteProfile } from '../../data/taste-probes';

const SWIPE_THRESHOLD = 80;
const FLY_DISTANCE = 400;

function SwipeCard({ probe, onSwipe, isTop }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const dislikeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragEnd = useCallback(
    (_, info) => {
      if (info.offset.x > SWIPE_THRESHOLD) {
        onSwipe(true);
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        onSwipe(false);
      }
    },
    [onSwipe]
  );

  if (!isTop) {
    return (
      <motion.div
        className="absolute inset-0 rounded-xl border border-sand-200 shadow-sm bg-white overflow-hidden"
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 0.95, y: 8 }}
      >
        <div className="h-56 overflow-hidden" style={{ backgroundColor: probe.color + '22' }}>
          <img
            src={probe.image}
            alt={probe.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="px-5 py-4">
          <h3 className="font-display font-semibold text-lg text-char-900">
            {probe.name}
          </h3>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 rounded-xl border border-sand-200 shadow-card bg-white overflow-hidden cursor-grab active:cursor-grabbing touch-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={(liked) => ({
        x: liked ? FLY_DISTANCE : -FLY_DISTANCE,
        rotate: liked ? 18 : -18,
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeIn' },
      })}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="h-56 overflow-hidden relative" style={{ backgroundColor: probe.color + '18' }}>
        <img
          src={probe.image}
          alt={probe.name}
          className="w-full h-full object-cover"
        />

        <motion.div
          className="absolute top-4 left-4 px-4 py-2 rounded-xl border-2 border-signal-avoid text-signal-avoid font-bold text-lg font-sans -rotate-12 bg-white/80 backdrop-blur-sm"
          style={{ opacity: dislikeOpacity }}
        >
          NOPE
        </motion.div>
        <motion.div
          className="absolute top-4 right-4 px-4 py-2 rounded-xl border-2 border-signal-beneficial text-signal-beneficial font-bold text-lg font-sans rotate-12 bg-white/80 backdrop-blur-sm"
          style={{ opacity: likeOpacity }}
        >
          LIKE
        </motion.div>
      </div>

      <div className="px-5 py-4">
        <h3 className="font-display font-semibold text-xl text-char-900">
          {probe.name}
        </h3>
        <p className="text-sm text-char-500 mt-1 font-sans">{probe.description}</p>
      </div>
    </motion.div>
  );
}

const LEANING_AXES = [
  { key: 'spiceTolerance', label: 'Spice Tolerance', icon: 'local_fire_department', leanLabel: (v) => v >= 0.6 ? 'You lean spicy' : v <= 0.4 ? 'You lean mild' : 'Moderate spice' },
  { key: 'plantForward',   label: 'Plant-Forward',   icon: 'eco',                   leanLabel: (v) => v >= 0.6 ? 'You lean plant-forward' : v <= 0.4 ? 'You lean meat-forward' : 'Balanced' },
  { key: 'sweetTooth',     label: 'Sweet Tooth',     icon: 'cake',                  leanLabel: (v) => v >= 0.6 ? 'You lean sweet' : v <= 0.4 ? 'You lean savory' : 'Balanced' },
  { key: 'seafoodOk',      label: 'Seafood',         icon: 'set_meal',              leanLabel: (v) => v >= 0.6 ? 'Open to seafood' : v <= 0.4 ? 'Not big on seafood' : 'Neutral on seafood' },
];

const CONFIDENCE_COLOR = {
  high: 'bg-forest-600',
  med: 'bg-forest-400',
  low: 'bg-forest-300',
};

function TasteResults({ swipes, onContinue }) {
  const profile = useMemo(() => inferTasteProfile(swipes), [swipes]);
  const likedCount = swipes.filter((s) => s.liked).length;
  const total = swipes.length;

  return (
    <div className="flex-1 flex flex-col px-5 pb-8 pt-2">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex-1 flex flex-col"
      >
        <div className="text-center mb-5">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-forest-100 mx-auto mb-3"
          >
            <span className="material-symbols-rounded fill text-forest-700 text-[32px]">
              check_circle
            </span>
          </motion.div>
          <h3 className="font-display font-semibold tracking-tightish text-2xl text-char-900">
            Your Taste Profile
          </h3>
          <p className="text-sm text-char-500 mt-1 font-sans">
            Based on {likedCount} likes and {total - likedCount} passes
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {LEANING_AXES.map((axis, i) => {
            const value = profile[axis.key];
            const conf = profile.confidence[axis.key];
            return (
              <motion.div
                key={axis.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35, ease: 'easeOut' }}
                className="bg-white rounded-xl border border-sand-200 px-4 py-3.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-forest-700 text-[20px]">
                      {axis.icon}
                    </span>
                    <span className="text-sm font-semibold text-char-900 font-sans">
                      {axis.label}
                    </span>
                  </div>
                  <span className="text-xs text-char-400 font-sans capitalize">
                    {conf} confidence
                  </span>
                </div>
                <p className="text-sm text-char-700 font-sans mb-2">{axis.leanLabel(value)}</p>
                <div className="h-2 bg-sand-100 rounded-pill overflow-hidden">
                  <motion.div
                    className={`h-full rounded-pill ${CONFIDENCE_COLOR[conf]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(value * 100)}%` }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </motion.div>
            );
          })}

          {profile.cuisineAffinity.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + LEANING_AXES.length * 0.08, duration: 0.35, ease: 'easeOut' }}
              className="bg-white rounded-xl border border-sand-200 px-4 py-3.5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-forest-700 text-[20px]">
                    explore
                  </span>
                  <span className="text-sm font-semibold text-char-900 font-sans">
                    Cuisine Affinity
                  </span>
                </div>
                <span className="text-xs text-char-400 font-sans capitalize">
                  low confidence
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.cuisineAffinity.filter((c) => c.score > 0).map((c) => (
                  <span
                    key={c.cuisine}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-forest-50 text-forest-800 text-xs font-sans font-medium"
                  >
                    {c.cuisine.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.3 }}
        onClick={onContinue}
        className="w-full py-4 rounded-pill text-white font-semibold text-base bg-forest-700 hover:bg-forest-800 transition-all duration-fast mt-5 min-h-[48px] font-sans"
      >
        Continue
      </motion.button>
    </div>
  );
}

export default function StepTaste({ onDone }) {
  const [idx, setIdx] = useState(0);
  const [swipes, setSwipes] = useState([]);
  const [exitDir, setExitDir] = useState(null);

  const total = TASTE_PROBES.length;
  const allDone = idx >= total;

  const handleSwipe = useCallback(
    (liked) => {
      const probe = TASTE_PROBES[idx];
      setExitDir(liked);
      setSwipes((prev) => [
        ...prev,
        { probeId: probe.id, liked },
      ]);
      setTimeout(() => setIdx((i) => i + 1), 50);
    },
    [idx]
  );

  if (allDone) {
    return <TasteResults swipes={swipes} onContinue={() => onDone(swipes)} />;
  }

  const current = TASTE_PROBES[idx];
  const next = idx + 1 < total ? TASTE_PROBES[idx + 1] : null;

  return (
    <div className="flex flex-col flex-1 px-5 py-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm text-char-500">
            {idx + 1} / {total}
          </span>
        </div>
        <div className="h-1.5 bg-sand-200 rounded-pill overflow-hidden">
          <div
            className="h-full rounded-pill bg-forest-700 transition-all duration-slow ease-ds-out"
            style={{ width: `${(idx / total) * 100}%` }}
          />
        </div>
        <h2 className="font-display font-semibold tracking-tightish text-2xl text-char-900 mt-4 leading-tight">
          What appeals to you?
        </h2>
        <p className="text-sm text-char-500 mt-1 font-sans">
          Swipe right to like, left to pass
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-[320px] h-[360px]">
          <AnimatePresence custom={exitDir}>
            {next && (
              <SwipeCard key={next.id} probe={next} isTop={false} onSwipe={() => {}} />
            )}
            <SwipeCard
              key={current.id}
              probe={current}
              isTop
              onSwipe={handleSwipe}
            />
          </AnimatePresence>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => handleSwipe(false)}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-pill border border-sand-200 bg-white text-base font-semibold transition-colors duration-fast hover:border-signal-avoid text-signal-avoid min-h-[48px] font-sans"
        >
          <span className="material-symbols-rounded text-[20px]">close</span>
          Pass
        </button>
        <button
          onClick={() => handleSwipe(true)}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-pill bg-forest-700 hover:bg-forest-800 text-white text-base font-semibold transition-colors duration-fast min-h-[48px] font-sans"
        >
          <span className="material-symbols-rounded fill text-[20px]">
            favorite
          </span>
          Like
        </button>
      </div>
    </div>
  );
}
