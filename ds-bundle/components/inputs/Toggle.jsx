import React from 'react';

export function Toggle({ checked = false, onChange, label, description, disabled }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, opacity: disabled ? 0.4 : 1 }}>
      {(label || description) && (
        <div style={{ minWidth:0 }}>
          {label && <p style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-sans)', marginBottom:2 }}>{label}</p>}
          {description && <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-sans)' }}>{description}</p>}
        </div>
      )}
      <div onClick={() => !disabled && onChange && onChange(!checked)}
        style={{ width:50, height:28, borderRadius:'var(--radius-pill)', background: checked ? 'var(--brand-primary)' : 'var(--border-subtle)', position:'relative', flexShrink:0, cursor: disabled ? 'not-allowed' : 'pointer', transition:'background .2s ease', boxShadow: checked ? '0 2px 8px rgba(98,140,34,.4)' : 'none' }}>
        <div style={{ position:'absolute', top:3, left: checked ? undefined : 3, right: checked ? 3 : undefined, width:22, height:22, borderRadius:'50%', background:'var(--white)', boxShadow:'0 1px 4px rgba(0,0,0,.18)', transition:'all .2s ease' }}/>
      </div>
    </div>
  );
}
