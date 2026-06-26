import React from 'react';

export function SecondaryButton({ children, onClick, disabled, size = 'md', fullWidth = false }) {
  const sizes = {
    sm: { padding: '9px 20px', fontSize: '14px', minHeight: '40px' },
    md: { padding: '13px 26px', fontSize: '16px', minHeight: '52px' },
    lg: { padding: '17px 32px', fontSize: '18px', minHeight: '60px' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        minHeight: s.minHeight, padding: s.padding,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: s.fontSize, fontWeight: 600,
        border: '1px solid var(--border-subtle)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: 'var(--shadow-card)',
        opacity: disabled ? 0.38 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}
