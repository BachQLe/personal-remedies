import { useState, useRef, useEffect } from 'react';
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
        className="flex items-center gap-1.5 text-xs font-semibold text-forest-700"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>menu_book</span>
        {open ? `Hide ${label}` : `See ${label}`}
        <span
          className="material-symbols-rounded"
          style={{
            fontSize: '14px',
            transition: 'transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </button>

      <AnimatedPanel open={open}>
        <ul className="mt-2 flex flex-col gap-2 pb-1">
          {references.map((ref, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="material-symbols-rounded text-forest-700 mt-0.5 flex-shrink-0" style={{ fontSize: '10px' }}>
                circle
              </span>
              {ref.url ? (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-forest-700 underline underline-offset-2 leading-relaxed font-sans"
                >
                  <span>{ref.source}{ref.year ? `, ${ref.year}` : ''}</span>
                  <span className="material-symbols-rounded opacity-60" style={{ fontSize: '11px' }}>open_in_new</span>
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
