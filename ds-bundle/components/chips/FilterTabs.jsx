import React, { useState } from 'react';

export function FilterTabs({ tabs, value, onChange }) {
  const active = value ?? tabs[0]?.key;
  return (
    <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <button key={tab.key} onClick={() => onChange && onChange(tab.key)}
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:'var(--radius-pill)', background: isActive ? 'var(--brand-primary)' : 'var(--surface-card)', color: isActive ? 'var(--text-on-dark)' : tab.color || 'var(--text-primary)', border: isActive ? 'none' : '1px solid var(--border-subtle)', fontFamily:'var(--font-sans)', fontSize:14, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'background .15s ease' }}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
