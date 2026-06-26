import React from 'react';

const CONFIGS = {
  beneficial: { icon:'✓', bg:'var(--benefit-100)', color:'var(--benefit-600)', border:'var(--benefit-600)' },
  limit:      { icon:'!', bg:'var(--caution-100)', color:'var(--caution-600)', border:'var(--caution-600)' },
  avoid:      { icon:'✗', bg:'var(--avoid-100)',   color:'var(--avoid-600)',   border:'var(--avoid-600)' },
  info:       { icon:'ⓘ', bg:'var(--info-100)',    color:'var(--info-600)',    border:'var(--info-600)' },
};

export function Toast({ type = 'beneficial', title, message, onDismiss }) {
  const c = CONFIGS[type] || CONFIGS.info;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, background: c.bg, borderRadius:'var(--radius-md)', padding:'14px 16px', borderLeft:`4px solid ${c.border}` }}>
      <span style={{ fontSize:24, fontWeight:700, flexShrink:0, lineHeight:1, width:28, textAlign:'center', color: c.color }}>{c.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:700, color: c.color, fontFamily:'var(--font-label)', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:3 }}>{title}</p>
        {message && <p style={{ fontSize:14, fontWeight:500, color:'var(--text-secondary)', fontFamily:'var(--font-sans)' }}>{message}</p>}
      </div>
      {onDismiss && <span onClick={onDismiss} style={{ color:'var(--text-muted)', cursor:'pointer', fontSize:14, flexShrink:0, marginLeft:8 }}>✕</span>}
    </div>
  );
}
