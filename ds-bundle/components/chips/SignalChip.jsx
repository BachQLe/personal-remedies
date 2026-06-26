import React from 'react';

const CONFIGS = {
  beneficial: { icon:'✓', bg:'var(--benefit-100)', color:'var(--benefit-600)', label:'Beneficial' },
  limit:      { icon:'!', bg:'var(--caution-100)', color:'var(--caution-600)', label:'Limit' },
  avoid:      { icon:'✗', bg:'var(--avoid-100)',   color:'var(--avoid-600)',   label:'Avoid' },
  info:       { icon:'ⓘ', bg:'var(--info-100)',    color:'var(--info-600)',    label:'Info' },
};

export function SignalChip({ signal = 'beneficial', compact = false, size = 'md' }) {
  const c = CONFIGS[signal] || CONFIGS.beneficial;
  const sizes = {
    sm: { padding: compact ? '3px 8px' : '4px 10px', fontSize: 12 },
    md: { padding: compact ? '6px 12px' : '6px 16px', fontSize: 14 },
  };
  const s = sizes[size] || sizes.md;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: compact ? 0 : 5, padding: s.padding, borderRadius:'var(--radius-pill)', background: c.bg, color: c.color, fontSize: s.fontSize, fontWeight: 600, fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
      <span>{c.icon}</span>
      {!compact && <span>{c.label}</span>}
    </span>
  );
}
