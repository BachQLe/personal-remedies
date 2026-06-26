import React from 'react';
import { StepBar } from '../inputs/StepBar.jsx';
import { PrimaryButton } from '../buttons/PrimaryButton.jsx';

export function ProfileProgressCard({ steps = [], currentStep, totalSteps, onContinue }) {
  return (
    <div style={{ background:'var(--surface-card)', borderRadius:'var(--radius-xl)', padding:24, boxShadow:'var(--shadow-card)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <p style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, color:'var(--text-heading)', letterSpacing:'-.01em' }}>Build your profile</p>
        <span style={{ fontFamily:'var(--font-label)', fontSize:12, fontWeight:700, color:'var(--brand-primary)', letterSpacing:'.06em' }}>{currentStep} OF {totalSteps}</span>
      </div>
      <StepBar current={currentStep} total={totalSteps} label={false} />
      <div style={{ display:'flex', flexDirection:'column', gap:10, margin:'20px 0' }}>
        {steps.map((step,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background: i < currentStep ? 'var(--brand-primary)' : 'transparent', border: i < currentStep ? 'none' : '2px solid var(--border-subtle)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {i < currentStep && <span style={{ color:'#fff', fontSize:11, lineHeight:1 }}>✓</span>}
            </div>
            <span style={{ fontSize:14, color: i < currentStep ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily:'var(--font-sans)' }}>{step}</span>
          </div>
        ))}
      </div>
      {onContinue && <PrimaryButton fullWidth onClick={onContinue}>Continue setup</PrimaryButton>}
    </div>
  );
}
