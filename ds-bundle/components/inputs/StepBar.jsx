import React from 'react';

export function StepBar({ current, total, label }) {
  const isComplete = current >= total;
  return (
    <div>
      {label !== false && (
        <p style={{ fontFamily:'var(--font-label)', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color: isComplete ? 'var(--benefit-600)' : 'var(--text-muted)', marginBottom:7 }}>
          {isComplete ? 'Complete ✓' : label || `Step ${current} of ${total}`}
        </p>
      )}
      <div style={{ display:'flex', gap:6 }}>
        {Array.from({length:total}).map((_,i) => (
          <div key={i} style={{ flex:1, height:5, borderRadius:'var(--radius-pill)', background: i < current ? 'var(--brand-primary)' : 'var(--border-subtle)' }}/>
        ))}
      </div>
    </div>
  );
}
