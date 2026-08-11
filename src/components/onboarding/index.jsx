import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import RemediWelcome from './RemediWelcome';
import ProfileBuilder from './ProfileBuilder';
import { saveProfile } from '../../api/api.js';
import { prefetchAppData } from '../../api/prefetch.js';
import { useAuth } from '../../context/AuthContext.jsx';
import OtpCodeEntry from '../auth/OtpCodeEntry.jsx';
import { pullProfile } from '../../api/profileSync.js';

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
// eslint-disable-next-line no-unused-vars
const CLOUD_COLOR = '#D9BFF0';
// eslint-disable-next-line no-unused-vars
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

/**
 * BackupStep — final, SKIPPABLE onboarding step: "back up & sync" via the
 * email + 6-digit OTP flow (REMEDI_MASTER_PLAN.md §4.3-4.5). Rendered as
 * step 2, after ProfileBuilder's step 1 has already saved the local profile
 * — this step can never block or gate reaching the app; "Skip for now" is
 * always present, even mid code-entry, so a user who starts typing an email
 * and changes their mind isn't trapped.
 *
 * Auth is entirely optional here: this step only exists to *offer* backup,
 * never to require it. `onSkip` and the post-`onVerified` continuation both
 * land on the same place (/app/home) — see OnboardingPage.finishOnboarding.
 */
function BackupStep({ onSkip, onVerified }) {
  const { signInWithEmail, isSupabaseConfigured } = useAuth();
  const [stage, setStage] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [sentAt, setSentAt] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setSending(true);
    setError('');
    try {
      await signInWithEmail(email);
      setSentAt(Date.now());
      setStage('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Top bar (tan) — matches ProfileBuilder's step chrome */}
      <div className="flex-none px-6 pt-14 pb-4 relative z-10 bg-paper-200">
        <h2
          className="font-semibold tracking-tight text-[16px] text-char-900 leading-tight"
          style={{ fontFamily: 'Quantico, sans-serif' }}
        >
          Back up your plan?
        </h2>
      </div>

      {/* Body (blue) */}
      <div className="flex-1 relative overflow-y-auto px-6 pt-8 pb-6" style={{ backgroundColor: '#BBCEFF' }}>
        <div className="w-full max-w-[380px] mx-auto flex flex-col gap-5">
          <p className="font-sans text-[15px] text-blue-950/80 text-center leading-relaxed">
            Add an email to save your profile and plan, and pick them up on another device.
            Totally optional — you can always do this later from your profile.
          </p>

          {stage === 'code' ? (
            <div className="bg-white/90 rounded-2xl p-5 shadow-sm">
              <OtpCodeEntry
                email={email}
                sentAt={sentAt}
                onVerified={onVerified}
                onCancel={() => {
                  setStage('email');
                  setError('');
                }}
              />
            </div>
          ) : (
            <form onSubmit={submitEmail} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@example.com"
                aria-label="Email address"
                autoComplete="email"
                autoFocus
                className="w-full text-center px-5 py-3.5 rounded-pill border-[1.5px] border-blue-950/15 bg-white/70 text-blue-950 placeholder:text-blue-950/40 text-base font-sans shadow-sm outline-none transition-all duration-fast focus:border-blue-950/40 focus:bg-white"
                style={{ minHeight: 44 }}
              />
              {error && (
                <p className="font-sans text-[13px] text-signal-avoid text-center">{error}</p>
              )}
              {!isSupabaseConfigured && (
                <p className="font-sans text-[12px] text-blue-950/50 text-center italic">
                  Sync isn't configured for this build yet — you can still continue without it.
                </p>
              )}
              <button
                type="submit"
                disabled={sending}
                className="px-8 py-3.5 rounded-pill text-blue-950 font-semibold text-base bg-white hover:bg-white/90 transition-colors duration-fast font-sans shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: 44 }}
              >
                {sending ? 'Sending…' : 'Send code'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom bar (tan) — Skip is always reachable, in either stage */}
      <div className="flex-none px-6 pt-3 pb-8 bg-paper-200 rounded-t-xl">
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-sm font-semibold text-char-500 hover:text-char-700 transition-colors duration-fast font-sans bg-transparent border-none cursor-pointer py-4 min-h-[48px] flex items-center justify-center"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    ageBand: null,
    conditions: [],
    allergies: [],
    dietaryPattern: 'omnivore',
    religiousRestriction: 'none',
    medications: [],
  });

  // Called directly from ProfileBuilder once conditions are set
  // (ProfileBuilder's own Continue button is disabled until conditions.length
  // > 0, so no separate gate is needed here). Saves the profile and warms
  // the cache immediately, THEN advances to the skippable backup step —
  // profile save is deliberately NOT gated on auth: a user who abandons the
  // backup step (or never even reaches it) still keeps their profile.
  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);

    const payload = {
      firstName: profile.firstName,
      ageBand: profile.ageBand,
      conditions: profile.conditions,
      allergies: profile.allergies,
      dietaryPattern: profile.dietaryPattern,
      religiousRestriction: profile.religiousRestriction,
      medications: [],
    };

    await saveProfile(payload);
    prefetchAppData(payload);
    setSaving(false);
    setStep(2);
  };

  // Both the "Skip for now" path and the post-verification continuation
  // land here — auth is purely additive, never a gate to reaching the app.
  const finishOnboarding = () => navigate('/app/home');

  // On verified sign-in, trigger the existing profileSync pull/merge
  // machinery (src/api/profileSync.js `pullProfile` — same function
  // src/context/AuthContext.jsx's `initProfileSync` auth listener already
  // calls on SIGNED_IN) before continuing, rather than reimplementing any
  // merge logic here. Best-effort: profileSync already logs + swallows its
  // own errors, so this never blocks the user from reaching the app.
  const handleBackupVerified = async (session) => {
    if (session?.user) {
      try {
        await pullProfile(session.user);
      } catch {
        /* best-effort reconciliation — never blocks onboarding completion */
      }
    }
    finishOnboarding();
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
          style={{ backgroundColor: ONBOARDING_BG, height: '100vh' }}
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
              {step === 0 && (
                <RemediWelcome
                  onNext={(name, ageBand) => {
                    setProfile((p) => ({ ...p, firstName: name, ageBand }));
                    setStep(1);
                  }}
                />
              )}
              {step === 1 && (
                <ProfileBuilder
                  profile={profile}
                  onChange={setProfile}
                  onSubmit={handleSubmit}
                  saving={saving}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && (
                <BackupStep onSkip={finishOnboarding} onVerified={handleBackupVerified} />
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
