import { Link } from 'react-router-dom';
import welcomeFruit from '../../assets/fruit-orange-graphic.png';
import FruitScene from './FruitScene.jsx';

export default function RemediWelcome({ onNext }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 px-7 pt-6 text-blue-950" style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
      <div className="flex-none h-9" aria-hidden="true" />
      <div className="flex justify-center py-2 min-h-[150px]" style={{ flex: '0 1 calc(46dvh - 60px)' }}>
        <FruitScene
          scene="orchard"
          src={welcomeFruit}
          alt="A bright orange with open eyes and a welcoming smile"
          priority
        />
      </div>
      <div className="text-center pt-3 pb-6">
        <h1 className="text-[32px] text-balance leading-[1.16] font-semibold tracking-tight" style={{ fontFamily: 'Chillax, sans-serif' }}>
          Eating for your health can feel overwhelming.
        </h1>
        <p className="font-sans text-base leading-relaxed text-blue-950/75 mt-4 max-w-[320px] mx-auto">
          Find foods that fit your needs, one small step at a time.
        </p>
      </div>
      <div className="mt-auto flex-none flex flex-col gap-2 pt-3">
        <Link
          to="/login"
          className="flex items-center justify-center font-sans text-sm text-blue-950/75 underline min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950"
        >
          I already have an account
        </Link>
        <button
          type="button"
          onClick={onNext}
          className="flex-none w-full py-4 rounded-pill bg-blue-950 text-white font-sans font-semibold text-base min-h-[56px] hover:bg-blue-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950"
        >
          Get started
        </button>
      </div>
    </div>
  );
}
