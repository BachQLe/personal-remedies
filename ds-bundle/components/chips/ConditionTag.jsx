import React from 'react';

const CONDITION_COLORS = {
  diabetes:      { bg: 'var(--forest-100)', color: 'var(--forest-900)' },
  hypertension:  { bg: 'var(--blue-100)',   color: 'var(--blue-800)' },
  cholesterol:   { bg: 'var(--yellow-100)', color: 'var(--yellow-800)' },
  kidney:        { bg: 'var(--lavender-100)', color: 'var(--lavender-800)' },
  heart:         { bg: 'var(--red-100)',    color: 'var(--red-800)' },
  default:       { bg: 'var(--sand-100)',   color: 'var(--char-700)' },
};

export function ConditionTag({ label, colorKey = 'default', size = 'md' }) {
  const c = CONDITION_COLORS[colorKey] || CONDITION_COLORS.default;
  const sizes = {
    sm: { padding: '2px 9px', fontSize: 11 },
    md: { padding: '6px 16px', fontSize: 14 },
  };
  const s = sizes[size] || sizes.md;
  return (
    <span style={{ display:'inline-flex', padding: s.padding, borderRadius:'var(--radius-pill)', background: c.bg, color: c.color, fontSize: s.fontSize, fontWeight: 600, fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
}
