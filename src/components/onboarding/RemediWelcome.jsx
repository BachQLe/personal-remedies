import { useNavigate } from 'react-router-dom';
import welcomeSalad from '../../assets/food-salad-simple-3d.png';

export default function RemediWelcome({ onNext }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col flex-1 px-7 text-blue-950" style={{ minHeight: '100%', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
      <div className="flex-none flex items-center justify-center pt-8 pb-2" style={{ height: '49dvh', minHeight: 240 }}>
        <img
          src={welcomeSalad}
          alt="A 3D-rendered bowl of fresh green salad"
          className="w-full h-full object-contain"
          fetchPriority="high"
        />
      </div>
      <div className="text-center pt-5 pb-6">
        <p className="font-label uppercase tracking-[0.16em] text-[11px] text-blue-950/65 mb-3">Welcome to Personal Remedies</p>
        <h1 className="text-[32px] leading-[1.16] font-semibold tracking-tight" style={{ fontFamily: 'Chillax, sans-serif' }}>
          Eating for your health can feel overwhelming.
        </h1>
        <p className="font-sans text-base leading-relaxed text-blue-950/75 mt-4 max-w-[320px] mx-auto">
          Find foods that fit your needs, one small step at a time.
        </p>
      </div>
      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 rounded-pill bg-blue-950 text-white font-sans font-semibold text-base min-h-[56px] hover:bg-blue-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950"
        >
          Get started
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full mt-3 py-3 font-sans text-sm text-blue-950/75 underline min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950"
        >
          I already have an account
        </button>
      </div>
    </div>
  );
}
