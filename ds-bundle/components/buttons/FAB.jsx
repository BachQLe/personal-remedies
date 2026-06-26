import React from 'react';

export function FAB({ onClick, label, size = 'md', icon }) {
  const isExtended = !!label;
  const sizes = { sm: 44, md: 60, lg: 72 };
  const iconSizes = { sm: 18, md: 24, lg: 28 };
  const d = sizes[size] || sizes.md;
  const is = iconSizes[size] || iconSizes.md;
  const PlusIcon = () => (
    <svg width={is} height={is} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
  if (isExtended) {
    return (
      <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'16px 28px', borderRadius:'var(--radius-pill)', background:'var(--brand-primary)', color:'var(--text-on-dark)', border:'none', cursor:'pointer', boxShadow:'0 8px 28px rgba(98,140,34,.55)', fontFamily:'var(--font-sans)', fontSize:16, fontWeight:600 }}>
        {icon || <PlusIcon />}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{ width:d, height:d, borderRadius:'50%', background:'var(--brand-primary)', color:'var(--text-on-dark)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 28px rgba(98,140,34,.55)', transition:'transform .15s ease' }}>
      {icon || <PlusIcon />}
    </button>
  );
}
