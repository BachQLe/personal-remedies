import { useState } from 'react';
import BackButton from '../shared/BackButton.jsx';
import privacyFruit from '../../assets/fruit-pair-graphic.png';
import FruitScene from './FruitScene.jsx';

const LINK = 'underline font-semibold';

export default function ConsentStep({ onNext, onBack }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (agreed) onNext();
      }}
      className="flex flex-col flex-1 min-h-0 px-7 pt-6 text-blue-950"
      style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex-none flex items-center justify-between h-9">
        <BackButton onClick={onBack} />
        <span className="font-label text-xs tracking-widest uppercase text-blue-950/60">3 of 4</span>
      </div>
      <div className="flex-none flex justify-center py-2 h-[clamp(120px,calc(45dvh-190px),200px)]">
        <FruitScene scene="room" src={privacyFruit} alt="A contented apple beside a pear looking over with a gentle smile" />
      </div>
      <div className="flex flex-col my-auto py-6">
        <h1 className="text-[32px] text-balance leading-[1.16] font-semibold tracking-tight text-center" style={{ fontFamily: 'Chillax, sans-serif' }}>
          Before you add health information
        </h1>
        <div className="mt-4 mb-5 font-sans text-base leading-relaxed text-blue-950/75 flex flex-col gap-3">
          <p>
            Personal Remedies gives general food information. It is not medical advice and does not diagnose or treat any condition. Ask your doctor before changing your diet, especially if you take medication.
          </p>
          <p>
            The health conditions, allergies and diet details you add are used only to rank foods and recipes for you. They stay on this device unless you choose to back up.
          </p>
          <p>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className={LINK}>Terms of Use</a>
            {' · '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={LINK}>Privacy Policy</a>
          </p>
        </div>
        <label htmlFor="health-consent" className="flex items-start gap-3 font-sans text-sm font-semibold cursor-pointer">
          <input
            id="health-consent"
            name="healthConsent"
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="w-6 h-6 flex-none accent-blue-950"
          />
          I understand, and I agree to Personal Remedies using the health information I enter to personalize my results.
        </label>
      </div>
      <button type="submit" disabled={!agreed} className="w-full py-4 rounded-pill bg-blue-950 text-white font-sans font-semibold flex-none min-h-[56px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950">
        Continue
      </button>
    </form>
  );
}
