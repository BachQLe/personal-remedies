import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StepProgress from './StepProgress';
import StepWelcome from './StepWelcome';
import StepConditions from './StepConditions';
import StepMedications from './StepMedications';
import StepAllergies from './StepAllergies';
import StepDietary from './StepDietary';
import StepTaste from './StepTaste';
import StepDone from './StepDone';
import { api } from '../../api/api';

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [profile, setProfile] = useState({
    conditions: [],
    medications: [],
    allergies: [],
    dietaryPattern: 'omnivore',
    religiousRestriction: 'none',
  });

  const update = (key, val) => setProfile((p) => ({ ...p, [key]: val }));

  const next = () => {
    setDir(1);
    setStep((s) => s + 1);
  };
  const back = () => {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleTasteDone = async (swipes) => {
    console.group('[Onboarding] Profile & Taste Output');
    console.log('UserProfile:', JSON.parse(JSON.stringify(profile)));
    console.log('Swipes:', JSON.parse(JSON.stringify(swipes)));
    console.groupEnd();

    await api.saveProfile(profile);
    await api.saveTasteSignal(swipes);

    setDir(1);
    setStep(TOTAL_STEPS);
  };

  const isWelcome = step === 0;
  const isDone = step === TOTAL_STEPS;
  const contentStep = step - 1;

  const slideVariants = {
    enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0 }),
  };

  const stepComponents = [
    <StepWelcome key="welcome" onNext={next} />,
    <StepConditions
      key="conditions"
      selected={profile.conditions}
      onChange={(v) => update('conditions', v)}
      onNext={next}
    />,
    <StepMedications
      key="medications"
      selected={profile.medications}
      onChange={(v) => update('medications', v)}
      onNext={next}
    />,
    <StepAllergies
      key="allergies"
      selected={profile.allergies}
      onChange={(v) => update('allergies', v)}
      onNext={next}
    />,
    <StepDietary
      key="dietary"
      dietaryPattern={profile.dietaryPattern}
      religiousRestriction={profile.religiousRestriction}
      onChangeDiet={(v) => update('dietaryPattern', v)}
      onChangeReligious={(v) => update('religiousRestriction', v)}
      onNext={next}
    />,
    <StepTaste key="taste" onDone={handleTasteDone} />,
    <StepDone key="done" profile={profile} />,
  ];

  return (
    <div className="min-h-screen flex flex-col bg-paper-200">
      <div className="flex-1 flex flex-col max-w-[430px] mx-auto w-full relative overflow-hidden bg-paper-200">
        {!isWelcome && !isDone && (
          <div className="flex-none">
            <div className="flex items-center px-5 pt-12">
              <button
                onClick={back}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-sand-200 text-char-900 shadow-xs transition-colors duration-fast hover:bg-sand-100"
                aria-label="Go back"
              >
                <span className="material-symbols-rounded text-[20px]">
                  arrow_back
                </span>
              </button>
            </div>
            <StepProgress current={contentStep} total={TOTAL_STEPS - 1} />
          </div>
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence custom={dir} mode="wait">
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="flex flex-col flex-1 absolute inset-0 overflow-y-auto"
            >
              {stepComponents[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
