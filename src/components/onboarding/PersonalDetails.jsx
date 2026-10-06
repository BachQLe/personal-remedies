import { useRef } from 'react';
import { motion } from 'framer-motion';
import fruitIllustration from '../../assets/fruit-pear-graphic.png';
import FruitScene from './FruitScene.jsx';
import BackButton from '../shared/BackButton.jsx';

const AGE_OPTIONS = [
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior (65+)' },
];

// Two-position age selector; new profiles default to Adult.
function AgeSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const valueAt = (clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clientX - rect.left < rect.width / 2 ? 'adult' : 'senior';
  };

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const next = valueAt(e.clientX);
    if (next) onChange(next);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const next = valueAt(e.clientX);
    if (next && next !== value) onChange(next);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange('adult');
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange('senior');
    }
  };

  // 0 → left half, '100%' → right half (knob is one half wide), '50%' → unset.
  const knobX = value === 'adult' ? 0 : value === 'senior' ? '100%' : '50%';

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label="Age group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="relative w-full h-[46px] p-[3px] rounded-pill border-[1.5px] border-blue-950/15 bg-white/40 shadow-sm touch-none select-none cursor-pointer"
    >
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ x: knobX, opacity: value ? 1 : 0.55 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-pill bg-white shadow-md"
        style={{ width: 'calc(50% - 3px)' }}
      />

      <div className="relative flex h-full">
        {AGE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`flex-1 h-full rounded-pill bg-transparent text-sm font-sans transition-colors duration-fast outline-none focus-visible:ring-2 focus-visible:ring-blue-950/30 ${
                selected ? 'text-blue-950 font-semibold' : 'text-blue-950/55'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PersonalDetails({ profile, onChange, onNext, onBack }) {
  const canContinue = profile.firstName.trim().length > 0 && !!profile.ageBand;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canContinue) onNext();
      }}
      className="flex flex-col flex-1 min-h-0 px-7 pt-6 text-blue-950"
      style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex-none flex items-center justify-between h-9">
        <BackButton onClick={onBack} />
        <span className="font-label text-xs tracking-widest uppercase text-blue-950/60">2 of 4</span>
      </div>
      <div className="flex justify-center py-2 min-h-[150px]" style={{ flex: '0 1 calc(46dvh - 60px)' }}>
        <FruitScene scene="kitchen" src={fruitIllustration} alt="A green pear with a playful wink and smile" />
      </div>
      <div className="flex flex-col pt-3 pb-6">
        <h1 className="text-[32px] text-balance leading-[1.16] font-semibold tracking-tight text-center" style={{ fontFamily: 'Chillax, sans-serif' }}>
          A little about you
        </h1>
        <p className="mt-4 mb-5 text-center font-sans text-base leading-relaxed text-blue-950/75">
          Let’s make this feel more like you.
        </p>
        <div className="w-full flex flex-col gap-3">
          <label htmlFor="first-name" className="font-sans text-sm font-semibold">Your first name</label>
          <input
            id="first-name"
            type="text"
            value={profile.firstName}
            onChange={(event) => onChange({ ...profile, firstName: event.target.value })}
            placeholder="Your first name"
            autoComplete="given-name"
            enterKeyHint="next"
            className="w-full px-5 py-3.5 rounded-pill border-[1.5px] border-blue-950/15 bg-white/70 text-blue-950 placeholder:text-blue-950/40 text-base font-sans outline-none focus:border-blue-950/40 focus:bg-white"
          />
          <p className="font-sans text-sm font-semibold mt-2">Your age group</p>
          <AgeSlider value={profile.ageBand} onChange={(ageBand) => onChange({ ...profile, ageBand })} />
        </div>
      </div>
      <button type="submit" disabled={!canContinue} className="mt-auto w-full py-4 rounded-pill bg-blue-950 text-white font-sans font-semibold flex-none min-h-[56px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950">
        Continue
      </button>
    </form>
  );
}
