/**
 * StepProgress — segmented progress bar for onboarding flows.
 *
 * Props (unchanged): current, total
 */
export default function StepProgress({ current, total }) {
  return (
    <div className="flex items-center gap-1.5 px-5 pt-4 pb-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-slow ease-ds-out ${
            i <= current ? "bg-forest-700" : "bg-sand-200"
          }`}
        />
      ))}
    </div>
  );
}
