import React from 'react';
import { SignalChip } from '../chips/SignalChip.jsx';

const ROW_BG = { beneficial:'var(--benefit-100)', limit:'var(--caution-100)', avoid:'var(--avoid-100)', info:'var(--info-100)' };
const CHECK_COLOR = { beneficial:'var(--benefit-600)', limit:'var(--caution-600)', avoid:'var(--avoid-600)', info:'var(--info-600)' };

export function GroceryChecklistRow({ name, signal = 'beneficial', checked = false, onToggle }) {
  const bg = checked ? 'rgba(245,245,240,.7)' : (ROW_BG[signal] || ROW_BG.beneficial);
  const checkColor = CHECK_COLOR[signal] || CHECK_COLOR.beneficial;
  return (
    <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', background: bg, borderRadius:'var(--radius-md)', cursor:'pointer' }}>
      <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, border: checked ? 'none' : `2px solid ${checkColor}`, background: checked ? 'var(--brand-primary)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {checked && <span style={{ color:'#fff', fontSize:12, lineHeight:1 }}>✓</span>}
      </div>
      <span style={{ flex:1, fontSize:15, fontWeight:600, color: checked ? 'var(--char-300)' : 'var(--text-primary)', fontFamily:'var(--font-sans)', textDecoration: checked ? 'line-through' : 'none' }}>{name}</span>
      <SignalChip signal={signal} compact size="sm"/>
    </div>
  );
}
