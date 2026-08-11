import { useState, useRef, useEffect } from 'react';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';

function AnimatedPanel({ open, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    if (open) {
      setHeight(ref.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [open]);

  return (
    <div
      style={{
        overflow: 'hidden',
        height,
        transition: 'height 200ms cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

export default function StudyReferences({ references, loading }) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 mt-2">
        <Skeleton shape="text" className="w-3/4" />
        <Skeleton shape="text" className="w-1/2" />
      </div>
    );
  }

  if (!references || references.length === 0) {
    return (
      <p className="text-xs text-char-500 mt-2 italic font-sans">
        References available on request
      </p>
    );
  }

  const label = references.length === 1 ? '1 study' : `${references.length} studies`;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-semibold text-forest-700"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <Icon name="book-open" size={14} aria-hidden="true" />
        {open ? `Hide ${label}` : `See ${label}`}
        <span
          aria-hidden="true"
          style={{
            transition: 'transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-flex',
          }}
        >
          <Icon name="chevron-down" size={14} />
        </span>
      </button>

      <AnimatedPanel open={open}>
        <ul className="mt-2 flex flex-col gap-2 pb-1">
          {references.map((ref, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-forest-700 mt-0.5 flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="currentColor" /></svg>
              </span>
              {ref.url ? (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-forest-700 underline underline-offset-2 leading-relaxed font-sans"
                >
                  <span>{ref.source}{ref.year ? `, ${ref.year}` : ''}</span>
                  <Icon name="external-link" size={11} className="opacity-60" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-xs text-char-500 leading-relaxed font-sans">
                  {ref.source}{ref.year ? `, ${ref.year}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      </AnimatedPanel>
    </div>
  );
}
