import React from 'react';

const CATEGORY_COLORS = {
  vegetables: { bg:'var(--forest-100)', iconBg:'rgba(98,140,34,.2)' },
  fruits:     { bg:'var(--yellow-100)', iconBg:'rgba(245,204,48,.3)' },
  nuts:       { bg:'var(--lavender-100)', iconBg:'rgba(180,136,220,.3)' },
  fish:       { bg:'var(--blue-100)', iconBg:'rgba(88,120,224,.25)' },
  grains:     { bg:'var(--yellow-50)', iconBg:'rgba(224,176,16,.2)' },
  default:    { bg:'var(--sand-100)', iconBg:'rgba(180,180,180,.2)' },
};

export function CategoryCard({ emoji, label, count, colorKey, onClick }) {
  colorKey = colorKey || 'default';
  const c = CATEGORY_COLORS[colorKey] || CATEGORY_COLORS.default;
  return (
    <div onClick={onClick} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:7,padding:14,borderRadius:24,background:c.bg,boxShadow:'var(--shadow-card)',minWidth:68,cursor:onClick?'pointer':'default'}}>
      <div style={{width:44,height:44,borderRadius:'var(--radius-md)',background:c.iconBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{emoji}</div>
      <span style={{fontSize:13,fontWeight:600,color:'var(--text-heading)',textAlign:'center',fontFamily:'var(--font-sans)'}}>{label}</span>
      {count != null && <span style={{fontFamily:'var(--font-label)',fontSize:12,color:'var(--text-heading)'}}>{count}</span>}
    </div>
  );
}
