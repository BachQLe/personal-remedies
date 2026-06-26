import React from 'react';

const VARIANTS = {
  forest:     { bg: 'var(--forest-700)', color: 'var(--text-on-dark)', border: 'none' },
  accent:     { bg: 'var(--yellow-400)', color: 'var(--yellow-950)', border: 'none' },
  ghost:      { bg: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
  'ghost-dark': { bg: 'transparent', color: 'var(--text-on-dark)', border: '1px solid rgba(243,239,230,0.25)' },
};

export function PillButton({ children, onClick, disabled, variant = 'forest', size = 'md' }) {
  const sizes = {
    sm: { padding: '7px 16px', fontSize: '13px' },
    md: { padding: '10px 22px', fontSize: '15px' },
    lg: { padding: '13px 28px', fontSize: '17px' },
  };
  const s = sizes[size] || sizes.md;
  const v = VARIANTS[variant] || VARIANTS.forest;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        borderRadius: 'var(--radius-pill)',
        padding: s.padding, fontSize: s.fontSize, fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        background: v.bg, color: v.color, border: v.border,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}
