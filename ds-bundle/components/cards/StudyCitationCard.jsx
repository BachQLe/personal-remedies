import React from 'react';

var QUALITY = {
  strong:   { stars:'★★★★★', label:'Strong',   bg:'var(--benefit-100)', color:'var(--benefit-600)', border:'var(--benefit-600)' },
  moderate: { stars:'★★★☆☆', label:'Moderate', bg:'var(--caution-100)', color:'var(--caution-600)', border:'var(--caution-600)' },
  limited:  { stars:'★★☆☆☆', label:'Limited',  bg:'var(--info-100)',    color:'var(--info-600)',    border:'var(--info-600)' },
  weak:     { stars:'★☆☆☆☆', label:'Weak',     bg:'var(--sand-100)',    color:'var(--char-400)',    border:'var(--char-300)' },
};

export function StudyCitationCard({ journal, year, title, quality, onRead }) {
  quality = quality || 'strong';
  var q = QUALITY[quality] || QUALITY.strong;
  return (
    <div style={{background:'var(--surface-card)',borderRadius:'var(--radius-md)',padding:'18px 20px',borderLeft:'4px solid ' + q.border,display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
        <p style={{fontFamily:'var(--font-label)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--info-600)'}}>{journal} · {year}</p>
        <span style={{display:'inline-flex',alignItems:'center',padding:'2px 10px',borderRadius:'var(--radius-pill)',background:q.bg,color:q.color,fontSize:11,fontWeight:600,fontFamily:'var(--font-sans)',whiteSpace:'nowrap',flexShrink:0}}>{q.stars} {q.label}</span>
      </div>
      <p style={{fontSize:14,fontWeight:600,color:'var(--text-heading)',lineHeight:1.4,fontFamily:'var(--font-sans)'}}>{title}</p>
      {onRead && <p onClick={onRead} style={{fontSize:13,color:'var(--brand-primary)',fontWeight:700,fontFamily:'var(--font-sans)',cursor:'pointer'}}>Read study →</p>}
    </div>
  );
}
