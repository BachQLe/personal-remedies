import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const CONDITION_HUE = {
  'Type 2 Diabetes': { bg: 'bg-plum-100', text: 'text-plum-700' },
  'Type 1 diabetes': { bg: 'bg-plum-100', text: 'text-plum-700' },
  'Hypertension': { bg: 'bg-signal-info-tint', text: 'text-signal-info' },
  'Heart': { bg: 'bg-signal-avoid-tint', text: 'text-signal-avoid' },
};
const DEFAULT_HUE = { bg: 'bg-forest-100', text: 'text-forest-700' };

function getConditionHue(condition) {
  const key = Object.keys(CONDITION_HUE).find((k) =>
    condition.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CONDITION_HUE[key] : DEFAULT_HUE;
}

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

export default function StepDone({ profile }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 pb-8 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={chipSpring}
        className="w-24 h-24 rounded-full flex items-center justify-center bg-forest-100 mb-6"
      >
        <span className="material-symbols-rounded fill text-forest-700 text-[48px]">
          check_circle
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.32 }}
      >
        <h2 className="font-display font-semibold tracking-tightish text-3xl text-char-900 leading-tight">
          You're all set
        </h2>
        <p className="text-char-500 mt-2 mb-8 text-sm leading-relaxed max-w-xs mx-auto font-sans">
          Your personalized food plan is ready — based on the studies, not
          guesswork.
        </p>
      </motion.div>

      {profile.conditions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.32 }}
          className="w-full bg-white rounded-xl border border-sand-200 shadow-card px-5 py-5 mb-8 text-left"
        >
          <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans mb-3">
            Your profile
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-char-500 mb-1.5 font-sans">Managing</p>
              <div className="flex flex-wrap gap-2">
                {profile.conditions.map((c) => {
                  const hue = getConditionHue(c);
                  return (
                    <span
                      key={c}
                      className={`px-3 py-1.5 rounded-pill text-xs font-semibold font-sans ${hue.bg} ${hue.text}`}
                    >
                      {c}
                    </span>
                  );
                })}
              </div>
            </div>
            {profile.dietaryPattern && (
              <div>
                <p className="text-xs text-char-500 mb-1.5 font-sans">Diet</p>
                <span className="px-3 py-1.5 rounded-pill text-xs font-medium bg-sand-100 text-char-700 capitalize font-sans">
                  {profile.dietaryPattern}
                  {profile.religiousRestriction !== 'none' &&
                    ` · ${profile.religiousRestriction}`}
                </span>
              </div>
            )}
            {profile.allergies.length > 0 && (
              <div>
                <p className="text-xs text-char-500 mb-1.5 font-sans">Avoiding</p>
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((a) => (
                    <span
                      key={a}
                      className="px-3 py-1.5 rounded-pill text-xs font-medium bg-signal-avoid-tint text-signal-avoid font-sans"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.medications.length > 0 && (
              <div>
                <p className="text-xs text-char-500 mb-1.5 font-sans">
                  Medications
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.medications.map((m) => (
                    <span
                      key={m}
                      className="px-3 py-1.5 rounded-pill text-xs font-medium bg-sand-100 text-char-700 font-sans"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="w-full"
      >
        <button
          onClick={() => navigate('/app/week')}
          className="w-full py-4 rounded-pill text-white font-semibold text-base bg-forest-700 hover:bg-forest-800 transition-colors duration-fast min-h-[48px] font-sans"
        >
          Go to my plan
        </button>
      </motion.div>
    </div>
  );
}
