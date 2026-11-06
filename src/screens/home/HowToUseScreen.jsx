/**
 * HowToUseScreen — /app/how-to-use, from Home's "How to use" button. The
 * interim page until the first-run slideshow (checklist 9.10) replaces it.
 * Copy is the planner's step labels (plannerCopy.js, DRAFT pending C13).
 */
import BackButton from '../../components/shared/BackButton.jsx';
import { COPY } from '../plan/plannerCopy.js';

const STEPS = [COPY.stepFavorites, COPY.stepGenerate, COPY.stepDay, COPY.stepSave];

export default function HowToUseScreen() {
  return (
    <div className="min-h-screen -mb-28 bg-forest-300 flex flex-col">
      <div className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 flex items-center gap-3">
        <BackButton fallback="/app/home" />
        <h1 className="min-w-0 font-display text-title font-semibold text-blue-950 leading-tight">
          How to use
        </h1>
      </div>
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-6 pb-28 flex flex-col gap-6">
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-100 font-sans text-sm font-semibold text-blue-950"
              >
                {i + 1}
              </span>
              <p className="min-w-0 pt-0.5 text-sm text-char-900 font-sans leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
        <p className="rounded-xl bg-white p-4 text-sm text-char-900 font-sans leading-relaxed">{COPY.howToUseNote}</p>
      </div>
    </div>
  );
}
