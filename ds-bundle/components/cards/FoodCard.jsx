import React from 'react';
import { SignalChip } from '../chips/SignalChip.jsx';
import { ConditionTag } from '../chips/ConditionTag.jsx';

const SIGNAL_BG = {
  beneficial: 'var(--benefit-100)',
  limit: 'var(--caution-100)',
  avoid: 'var(--avoid-100)',
  info: 'var(--info-100)',
};

export function FoodCard({ emoji, name, signal, conditions, studyCount, onClick }) {
  signal = signal || 'beneficial';
  conditions = conditions || [];
  const bg = SIGNAL_BG[signal] || SIGNAL_BG.beneficial;
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:14,background:bg,borderRadius:'var(--radius-xl)',padding:16,boxShadow:'var(--shadow-card)',cursor:onClick?'pointer':'default'}}>
      <div style={{width:64,height:64,borderRadius:'var(--radius-md)',background:'rgba(0,0,0,.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>{emoji || '🍎'}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:5}}>
          <span style={{fontFamily:'var(--font-sans)',fontWeight:700,color:'var(--text-heading)',fontSize:15}}>{name}</span>
          <SignalChip signal={signal} compact />
        </div>
        {conditions.length > 0 && (
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
            {conditions.map(function(c,i){ return React.createElement(ConditionTag, {key:i,label:c.label,colorKey:c.colorKey,size:'sm'}); })}
          </div>
        )}
        {studyCount != null && <p style={{fontSize:12,color:'var(--text-muted)',fontFamily:'var(--font-sans)'}}>{studyCount} studies</p>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--char-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  );
}
