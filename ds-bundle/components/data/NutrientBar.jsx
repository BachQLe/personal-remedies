import React from 'react';

const COLORS = {
  protein: 'var(--forest-700)',
  carbs:   'var(--yellow-600)',
  fat:     'var(--lavender-600)',
  fiber:   'var(--info-600)',
  default: 'var(--char-400)',
};
const BG_COLORS = {
  protein: 'rgba(98,140,34,.18)',
  carbs:   'rgba(245,204,48,.22)',
  fat:     'rgba(180,136,220,.2)',
  fiber:   'rgba(63,110,134,.15)',
  default: 'var(--sand-200)',
};

export function NutrientBar({ label, value, max, unit = 'g', nutrient = 'default' }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = COLORS[nutrient] || COLORS.default;
  const bgColor = BG_COLORS[nutrient] || BG_COLORS.default;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:7 }}>
        <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-sans)' }}>{label}</span>
        <span style={{ fontFamily:'var(--font-label)', fontSize:12, fontWeight:700, color }}>{value}{unit} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>/ {max}{unit}</span></span>
      </div>
      <div style={{ height:9, borderRadius:'var(--radius-pill)', background: bgColor, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, borderRadius:'var(--radius-pill)', background: color }}/>
      </div>
    </div>
  );
}
