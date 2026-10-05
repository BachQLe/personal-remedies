import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import RemediWelcome from './RemediWelcome';
import PersonalDetails from './PersonalDetails';
import ConsentStep from './ConsentStep';
import ProfileBuilder from './ProfileBuilder';
import { saveProfile } from '../../api/api.js';
import { prefetchAppData } from '../../api/prefetch.js';

const ONBOARDING_BG = '#BBCEFF';
const DAILY_PICKS_BG = '#111E58';
const STRIPE_COUNT = 5;
const STRIPE_H = 28;

function GradientStripes() {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: STRIPE_COUNT }).map((_, i) => {
        const t = (i + 1) / (STRIPE_COUNT + 1);
        const r = Math.round(187 * (1 - t) + 17 * t);
        const g = Math.round(206 * (1 - t) + 30 * t);
        const b = Math.round(255 * (1 - t) + 88 * t);
        return (
          <div
            key={i}
            style={{
              width: '100%',
              height: STRIPE_H,
              backgroundColor: `rgb(${r},${g},${b})`,
            }}
          />
        );
      })}
    </div>
  );
}

// --- Cloud system (kept for future reuse) ---
const CLOUD_COLOR = '#D9BFF0';
const SHAPES = {
  round: [
    { left: 0, top: 35, w: 120, h: 80, br: '64% 36% 40% 60% / 44% 64% 36% 56%' },
    { left: 50, top: 10, w: 100, h: 85, br: '38% 62% 60% 40% / 62% 36% 64% 38%' },
    { left: 115, top: 30, w: 95, h: 70, br: '58% 42% 36% 64% / 38% 62% 44% 56%' },
  ],
  wide: [
    { left: 0, top: 30, w: 140, h: 65, br: '62% 38% 44% 56% / 34% 66% 40% 60%' },
    { left: 70, top: 8, w: 80, h: 70, br: '40% 60% 64% 36% / 58% 42% 36% 64%' },
    { left: 120, top: 22, w: 110, h: 60, br: '36% 64% 56% 44% / 66% 34% 58% 42%' },
    { left: 40, top: 40, w: 100, h: 55, br: '62% 38% 38% 62% / 42% 58% 64% 36%' },
  ],
  puffy: [
    { left: 0, top: 40, w: 100, h: 65, br: '38% 62% 56% 44% / 64% 36% 42% 58%' },
    { left: 35, top: 5, w: 75, h: 80, br: '58% 42% 36% 64% / 40% 60% 62% 38%' },
    { left: 85, top: 0, w: 80, h: 75, br: '36% 64% 58% 42% / 56% 44% 38% 62%' },
    { left: 130, top: 30, w: 80, h: 60, br: '60% 40% 44% 56% / 36% 64% 58% 42%' },
  ],
};
// eslint-disable-next-line no-unused-vars
function Cloud({ width, height, shape = 'round' }) {
  const blobs = SHAPES[shape] || SHAPES.round;
  const baseW = Math.max(...blobs.map((b) => b.left + b.w));
  const scale = width / baseW;
  const s = (n) => n * scale;
  return (
    <div style={{ position: 'relative', width, height }}>
      {blobs.map((b, i) => (
        <div
          key={`sh${i}`}
          style={{
            position: 'absolute',
            left: s(b.left),
            top: s(b.top) + s(6),
            width: s(b.w),
            height: s(b.h),
            background: 'rgba(0,0,0,0.08)',
            borderRadius: b.br || '50%',
          }}
        />
      ))}
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s(b.left),
            top: s(b.top),
            width: s(b.w),
            height: s(b.h),
            background: CLOUD_COLOR,
            borderRadius: b.br || '50%',
          }}
        />
      ))}
    </div>
  );
}
// eslint-disable-next-line no-unused-vars
const CLOUDS = [
  { id: 1, w: 200, h: 90, top: '8%', left: '-8%', side: 'left', shape: 'wide' },
  { id: 2, w: 160, h: 72, top: '45%', left: '62%', side: 'right', shape: 'puffy' },
  { id: 3, w: 180, h: 80, top: '78%', left: '2%', side: 'left', shape: 'round' },
];
// eslint-disable-next-line no-unused-vars
const cloudSpring = { type: 'spring', stiffness: 20, damping: 12 };
// --- End cloud system ---

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    ageBand: 'adult',
    conditions: [],
    allergies: [],
    dietaryPattern: 'omnivore',
    religiousRestriction: 'none',
    medications: [],
    consentAt: null,
  });

  // Save locally and warm app data when the final onboarding page is complete.
  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);

    const payload = {
      firstName: profile.firstName.trim(),
      ageBand: profile.ageBand,
      conditions: profile.conditions,
      allergies: profile.allergies,
      dietaryPattern: profile.dietaryPattern,
      religiousRestriction: profile.religiousRestriction,
      medications: [],
      consentAt: profile.consentAt,
    };

    await saveProfile(payload);
    prefetchAppData(payload);
    setSaving(false);
    navigate('/app/home');
  };

  const slideVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const totalStripeH = STRIPE_COUNT * STRIPE_H;

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: DAILY_PICKS_BG }}
    >
      <div
        className="max-w-[430px] mx-auto w-full relative"
        style={{ backgroundColor: DAILY_PICKS_BG }}
      >
        <div
          className="flex flex-col relative overflow-hidden"
          style={{ backgroundColor: ONBOARDING_BG, height: '100dvh' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col flex-1 absolute inset-0 overflow-y-auto"
            >
              {step === 0 && <RemediWelcome onNext={() => setStep(1)} />}
              {step === 1 && (
                <PersonalDetails
                  profile={profile}
                  onChange={setProfile}
                  onNext={() => setStep(2)}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && (
                <ConsentStep
                  onNext={() => {
                    setProfile((p) => ({ ...p, consentAt: new Date().toISOString() }));
                    setStep(3);
                  }}
                  onBack={() => setStep(1)}
                />
              )}
              {step === 3 && (
                <ProfileBuilder
                  profile={profile}
                  onChange={setProfile}
                  onSubmit={handleSubmit}
                  saving={saving}
                  onBack={() => setStep(2)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div style={{ height: totalStripeH, flexShrink: 0 }}>
          <GradientStripes />
        </div>
      </div>
    </div>
  );
}
