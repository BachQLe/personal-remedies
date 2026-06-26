import React from 'react';

export function RatingDots({ value = 5, max = 5, label, showValue = true }) {
  const filled = Math.round(value);
  const half = value - Math.floor(value) >= 0.5;
  const getColor = (v) => v >= 4 ? 'var(--forest-700)' : v >= 3 ? 'var(--forest-400)' : v >= 2 ? 'var(--caution-600)' : 'var(--avoid-600)';
  const color = getColor(value);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ display:'flex', gap:6 }}>
        {Array.from({length:max}).map((_,i) => (
          <div key={i} style={{ width:11, height:11, borderRadius:'50%', background: i < Math.floor(value) ? color : (i === Math.floor(value) && half ? 'var(--forest-400)' : 'var(--sand-200)') }}/>
        ))}
      </div>
      {showValue && <span style={{ fontFamily:'var(--font-label)', fontSize:14, fontWeight:700, color }}>{value.toFixed(1)}</span>}
      {label && <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-sans)' }}>{label}</span>}
    </div>
  );
}
