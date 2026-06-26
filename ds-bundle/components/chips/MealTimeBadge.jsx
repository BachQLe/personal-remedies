import React from 'react';

const MEALS = {
  breakfast: { label:'Breakfast', emoji:'☀️', activeBg:'var(--yellow-700)', inactiveBg:'var(--yellow-50)', inactiveColor:'var(--yellow-700)', inactiveBorder:'rgba(154,112,0,.2)' },
  lunch:     { label:'Lunch',     emoji:'🌿', activeBg:'var(--forest-700)', inactiveBg:'var(--forest-50)',  inactiveColor:'var(--forest-800)', inactiveBorder:'rgba(74,110,24,.2)' },
  dinner:    { label:'Dinner',    emoji:'🌙', activeBg:'var(--blue-700)',   inactiveBg:'var(--blue-50)',   inactiveColor:'var(--blue-700)',   inactiveBorder:'rgba(46,70,168,.2)' },
  snack:     { label:'Snack',     emoji:'🍃', activeBg:'var(--lavender-700)', inactiveBg:'var(--lavender-50)', inactiveColor:'var(--lavender-700)', inactiveBorder:'rgba(106,61,142,.2)' },
};

export function MealTimeBadge({ meal = 'breakfast', active = false, onClick }) {
  const m = MEALS[meal] || MEALS.breakfast;
  return (
    <span onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:7, padding: active ? '8px 18px' : '7px 16px', borderRadius:'var(--radius-pill)', background: active ? m.activeBg : m.inactiveBg, color: active ? 'var(--text-on-dark)' : m.inactiveColor, border: active ? 'none' : `1.5px solid ${m.inactiveBorder}`, fontFamily:'var(--font-sans)', fontSize:14, fontWeight:600, cursor:'pointer', transition:'all .15s ease' }}>
      <span>{m.emoji}</span><span>{m.label}</span>
    </span>
  );
}
