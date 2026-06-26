import React from 'react';

const CONFIGS = {
  warning: { icon:'⚠', bg:'var(--yellow-100)', color:'var(--yellow-800)', border:'var(--yellow-600)', ctaColor:'var(--yellow-700)' },
  success: { icon:'✓', bg:'var(--benefit-100)', color:'var(--benefit-600)', border:'var(--benefit-600)', ctaColor:'var(--benefit-600)' },
  info:    { icon:'ⓘ', bg:'var(--info-100)',    color:'var(--info-600)',    border:'var(--info-600)',    ctaColor:'var(--info-600)' },
  error:   { icon:'✗', bg:'var(--avoid-100)',   color:'var(--avoid-600)',   border:'var(--avoid-600)',   ctaColor:'var(--avoid-600)' },
};

export function AlertBanner({ type = 'info', message, ctaLabel, onCta, onDismiss }) {
  const c = CONFIGS[type] || CONFIGS.info;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, background: c.bg, padding:'14px 18px', borderRadius:'var(--radius-md)', borderLeft:`4px solid ${c.border}` }}>
      <span style={{ fontSize:17, flexShrink:0, lineHeight:1 }}>{c.icon}</span>
      <p style={{ flex:1, fontSize:14, fontWeight:600, color: c.color, fontFamily:'var(--font-sans)', minWidth:0 }}>{message}</p>
      {ctaLabel && onCta && <button onClick={onCta} style={{ border:'none', background:'none', fontWeight:700, color: c.ctaColor, cursor:'pointer', fontSize:13, whiteSpace:'nowrap', fontFamily:'var(--font-sans)', flexShrink:0, padding:0 }}>{ctaLabel} →</button>}
      {onDismiss && <span onClick={onDismiss} style={{ color:'var(--text-muted)', cursor:'pointer', fontSize:14, flexShrink:0, marginLeft:8 }}>✕</span>}
    </div>
  );
}
