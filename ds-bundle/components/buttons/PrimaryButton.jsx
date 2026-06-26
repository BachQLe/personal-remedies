import React from 'react';

export function PrimaryButton({ children, onClick, disabled, size = 'md', fullWidth = false }) {
  const sizes = {
    sm: { padding: '10px 20px', fontSize: '14px', minHeight: '40px' },
    md: { padding: '14px 26px', fontSize: '16px', minHeight: '52px' },
    lg: { padding: '18px 32px', fontSize: '18px', minHeight: '60px' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative', overflow: 'hidden',
        width: fullWidth ? '100%' : undefined,
        minHeight: s.minHeight, padding: s.padding,
        borderRadius: 'var(--radius-xs)',
        background: 'var(--brand-primary)',
        color: 'var(--text-on-dark)',
        fontFamily: 'var(--font-sans)',
        fontSize: s.fontSize, fontWeight: 600,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: 'var(--shadow-md)',
        opacity: disabled ? 0.38 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
      <span style={{ position: 'absolute', top: 6, right: 6, width: 11, height: 11, borderTop: '2px solid rgba(255,255,255,0.6)', borderRight: '2px solid rgba(255,255,255,0.6)', display: 'block' }} />
    </button>
  );
}
