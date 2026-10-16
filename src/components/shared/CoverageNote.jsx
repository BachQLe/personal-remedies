/**
 * CoverageNote — neutral line naming which of the user's conditions the
 * guidance on screen covers (checklist 4.2). Renders only for a PARTIAL
 * result (some conditions scored, some not); adapter.js's `withAuthorized`
 * is the source of `coverage` ({ scored, unscored }: display names) and
 * leaves it absent when every condition was scored. Functional copy only.
 */
export default function CoverageNote({ coverage, className = '' }) {
  if (!coverage?.scored?.length || !coverage?.unscored?.length) return null;
  return (
    <p className={`text-xs text-char-500 font-sans ${className}`}>
      Showing guidance for: {coverage.scored.join(', ')}. Not yet available for: {coverage.unscored.join(', ')}.
    </p>
  );
}
