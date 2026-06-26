import React from 'react';

const ICONS = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  search: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  grid: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  insights: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  profile: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

export function BottomTabBar({ tabs, activeKey, onChange }) {
  return (
    <div style={{ background:'var(--surface-card)', borderTop:'1px solid var(--border-subtle)', display:'flex', alignItems:'stretch' }}>
      {tabs.map(tab => {
        const isActive = tab.key === activeKey;
        return (
          <div key={tab.key} onClick={() => onChange && onChange(tab.key)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 0 14px', cursor:'pointer', position:'relative', color: isActive ? 'var(--brand-primary)' : 'var(--char-300)' }}>
            {ICONS[tab.icon] || ICONS.home}
            <span style={{ fontFamily:'var(--font-label)', fontSize:12, fontWeight:700, letterSpacing:'.04em' }}>{tab.label}</span>
            {isActive && <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:24, height:3, borderRadius:'999px 999px 0 0', background:'var(--brand-primary)' }}/>}
          </div>
        );
      })}
    </div>
  );
}
