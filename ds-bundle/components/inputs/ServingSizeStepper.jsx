import React from 'react';

export function ServingSizeStepper({ name, calories, value, unit = 'cup', onIncrement, onDecrement }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'var(--surface-card)', borderRadius:'var(--radius-lg)', padding:'18px 22px', boxShadow:'var(--shadow-card)' }}>
      <div style={{ minWidth:0 }}>
        <p style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:600, color:'var(--text-heading)', marginBottom:2 }}>{name}</p>
        {calories != null && <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-sans)' }}>{calories} kcal per {unit}</p>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
        <button onClick={onDecrement} style={{ width:36, height:36, borderRadius:'50%', background:'var(--sand-100)', border:'none', cursor:'pointer', fontSize:22, color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>−</button>
        <div style={{ textAlign:'center', minWidth:48 }}>
          <p style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, color:'var(--text-heading)', lineHeight:1 }}>{value}</p>
          <p style={{ fontSize:9, color:'var(--text-muted)', fontFamily:'var(--font-label)', letterSpacing:'.08em', textTransform:'uppercase', marginTop:2 }}>{unit}</p>
        </div>
        <button onClick={onIncrement} style={{ width:36, height:36, borderRadius:'50%', background:'var(--brand-primary)', border:'none', cursor:'pointer', fontSize:22, color:'var(--text-on-dark)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(98,140,34,.38)', lineHeight:1 }}>+</button>
      </div>
    </div>
  );
}
