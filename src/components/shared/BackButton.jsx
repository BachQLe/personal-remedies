import { BackArrow } from './Icon.jsx';

export default function BackButton({ onClick, 'aria-label': ariaLabel = 'Go back' }) {
  return (
    <button
      onClick={onClick}
      className="tap-target w-9 h-9 flex items-center justify-center rounded-full bg-white border border-sand-200 text-char-900 shadow-xs transition-colors duration-fast hover:bg-sand-100 flex-shrink-0"
      aria-label={ariaLabel}
    >
      <BackArrow aria-hidden="true" />
    </button>
  );
}
