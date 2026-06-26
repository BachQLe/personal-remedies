import React, { useState } from 'react';

export function SearchInput({ placeholder = 'Search conditions', value, onChange, onClear }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  return (
    <div style={{ position:'relative' }}>
      <span style={{ position:'absolute', left:15, top:'50%', transform:'translateY(-50%)', fontSize:17, pointerEvents:'none', color: focused ? 'var(--forest-700)' : 'var(--text-muted)' }}>🔍</span>
      <input
        type="text" value={value} placeholder={placeholder}
        onChange={e => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width:'100%', background:'var(--surface-card)', border: focused ? '1.5px solid var(--forest-600)' : '1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'15px 15px 15px 44px', fontSize:16, fontFamily:'var(--font-sans)', color:'var(--text-primary)', outline:'none', boxShadow: focused ? 'var(--ring-focus)' : 'var(--shadow-sm)' }}
      />
      {hasValue && (
        <button onClick={onClear} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:16, lineHeight:1 }}>✕</button>
      )}
    </div>
  );
}
