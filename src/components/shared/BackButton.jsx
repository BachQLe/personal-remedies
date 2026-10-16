import { BackArrow } from './Icon.jsx';
import { useGoBack } from '../../hooks/useGoBack.js';

function Button({ onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target w-9 h-9 flex items-center justify-center rounded-full bg-white border border-sand-200 text-char-900 shadow-xs transition-colors duration-fast hover:bg-sand-100 flex-shrink-0"
      aria-label={ariaLabel}
    >
      <BackArrow aria-hidden="true" />
    </button>
  );
}

// Split out so only the no-`onClick` form needs a Router above it.
function HistoryBackButton({ fallback, ariaLabel }) {
  return <Button onClick={useGoBack(fallback)} ariaLabel={ariaLabel} />;
}

// No `onClick` → real history back (see useGoBack); `fallback` is where a
// deep-linked screen with nothing behind it lands instead.
export default function BackButton({ onClick, fallback, 'aria-label': ariaLabel = 'Go back' }) {
  return onClick
    ? <Button onClick={onClick} ariaLabel={ariaLabel} />
    : <HistoryBackButton fallback={fallback} ariaLabel={ariaLabel} />;
}
