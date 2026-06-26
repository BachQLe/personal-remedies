import React from 'react';
import { PrimaryButton } from '../buttons/PrimaryButton.jsx';

export function EmptyState({ emoji = '🥗', title, body, ctaLabel, onCta }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'32px 24px' }}>
      <span style={{ fontSize:52, marginBottom:16, lineHeight:1 }}>{emoji}</span>
      <p style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, color:'var(--text-heading)', marginBottom:8, letterSpacing:'-.01em' }}>{title}</p>
      {body && <p style={{ fontSize:14, color:'var(--text-secondary)', maxWidth:260, lineHeight:1.55, marginBottom:24, fontFamily:'var(--font-sans)' }}>{body}</p>}
      {ctaLabel && onCta && <PrimaryButton onClick={onCta}>{ctaLabel}</PrimaryButton>}
    </div>
  );
}
