export default function StepProgress({ current, total }) {
  const pct = ((current + 1) / total) * 100;

  return (
    <div className="px-5 pt-8 pb-2">
      <div className="h-1.5 rounded-pill bg-sand-200 overflow-hidden">
        <div
          className="h-full rounded-pill bg-forest-700 transition-all duration-slow ease-ds-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-char-500 tracking-eyebrow">
        Step {current + 1} of {total}
      </p>
    </div>
  );
}
