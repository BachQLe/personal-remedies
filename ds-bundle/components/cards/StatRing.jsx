import React from 'react';

export function StatRing({ value, max, label, color, size }) {
  max = max || 30;
  color = color || 'var(--forest-700)';
  size = size || 76;
  var r = size * 0.39;
  var circ = 2 * Math.PI * r;
  var filled = Math.min(1, value / max) * circ;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
      <div style={{position:'relative',width:size,height:size}}>
        <svg width={size} height={size} style={{transform:'rotate(-90deg)'}} viewBox={'0 0 ' + size + ' ' + size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sand-200)" strokeWidth={size*0.17}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.17} strokeDasharray={filled + ' ' + circ} strokeLinecap="round"/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:size*0.27,fontWeight:700,color:'var(--text-heading)'}}>{value}</span>
        </div>
      </div>
      {label && <span style={{fontSize:11,color:'var(--text-heading)',fontFamily:'var(--font-sans)'}}>{label}</span>}
    </div>
  );
}
