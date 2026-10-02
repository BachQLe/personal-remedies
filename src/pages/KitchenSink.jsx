import { useState } from 'react';
import Card from '../components/shared/Card';
import PrimaryButton from '../components/shared/PrimaryButton';
import SecondaryButton from '../components/shared/SecondaryButton';
import SignalChip from '../components/shared/SignalChip';
import ConditionTag from '../components/shared/ConditionTag';
import StatRing from '../components/shared/StatRing';
import EmptyState from '../components/shared/EmptyState';

const KITCHEN_SINK_FOODS = [
  {
    id: 'ks1', name: 'Salmon', signal: 'helpful',
    matchedConditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'Heart failure'],
    referenceCount: 5,
  },
  {
    id: 'ks2', name: 'Processed Meats', signal: 'avoid',
    matchedConditions: ['Hypertension (high blood pressure)', 'Heart failure'],
    referenceCount: 2,
  },
];

/* ── Color palette for swatch display ──────────────────────── */
const PALETTES = {
  Forest: [
    ['forest-900', '#0F2A21'], ['forest-800', '#143628'], ['forest-700', '#1E4736'],
    ['forest-600', '#2A5A45'], ['forest-500', '#3A7058'], ['forest-300', '#A7C0AC'],
    ['forest-100', '#DCE9DF'], ['forest-50', '#EDF3EE'],
  ],
  Plum: [
    ['plum-900', '#2E1626'], ['plum-800', '#401F33'], ['plum-700', '#5C2A47'],
    ['plum-600', '#743A5C'], ['plum-400', '#A86C8E'], ['plum-100', '#EBDDE6'],
    ['plum-50', '#F4ECF0'],
  ],
  Honey: [
    ['honey-700', '#94691C'], ['honey-600', '#C2902F'], ['honey-500', '#D6A642'],
    ['honey-100', '#F3E6C7'], ['honey-50', '#FAF3E2'],
  ],
  Neutrals: [
    ['char-900', '#211E1B'], ['char-700', '#423D36'], ['char-500', '#6B645A'],
    ['char-400', '#8A8377'], ['char-300', '#B7AF9F'], ['sand-200', '#FFFFFF'],
    ['sand-100', '#FFFFFF'], ['paper-200', '#F5F5F0'], ['paper-100', '#FAFAF8'],
  ],
  Signals: [
    ['beneficial', '#2F8C5A'], ['beneficial-tint', '#DCEDE2'],
    ['limit', '#C98A2E'], ['limit-tint', '#F6E8CB'],
    ['avoid', '#C04A2F'], ['avoid-tint', '#F6DED5'],
    ['info', '#3F6E86'], ['info-tint', '#DDE8ED'],
  ],
};

const RADII = [
  ['xs', '6px'], ['sm', '10px'], ['md', '14px'], ['lg', '20px'],
  ['xl', '28px'], ['2xl', '36px'], ['pill', '999px'],
];

const SHADOWS = [
  ['xs', '0 1px 2px rgba(45,36,24,0.06)'],
  ['sm', '0 2px 8px rgba(45,36,24,0.06)'],
  ['card', '0 3px 16px rgba(45,36,24,0.07)'],
  ['md', '0 8px 24px rgba(45,36,24,0.10)'],
  ['lg', '0 14px 40px rgba(45,36,24,0.14)'],
  ['sheet', '0 -8px 32px rgba(45,36,24,0.12)'],
];

const SAMPLE_ICONS = [
  'home', 'search', 'favorite', 'settings', 'restaurant',
  'local_pharmacy', 'science', 'eco', 'water_drop', 'nutrition',
  'check_circle', 'warning', 'error', 'info',
];

export default function KitchenSink() {
  const [inputVal, setInputVal] = useState('');

  /* Build a mock food with note + meta for the gallery */
  const sampleFood = { ...KITCHEN_SINK_FOODS[0], note: 'Rich in omega-3 fatty acids' };
  const avoidFood = { ...KITCHEN_SINK_FOODS[1], note: 'High sodium, nitrate concerns' };

  return (
    <div className="min-h-screen bg-paper-200 pb-24">
      <div className="max-w-3xl mx-auto px-5 py-12 flex flex-col gap-14">

        {/* ── Page header ─────────────────────────────── */}
        <header>
          <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-500 mb-2">
            Design System
          </p>
          <h1 className="font-display text-[40px] font-semibold tracking-tightish leading-[1.08] text-char-900">
            Remedy Component Gallery
          </h1>
          <p className="text-char-500 text-lg mt-2 max-w-prose">
            Every token, primitive, and component in the Remedy Design System.
            This page serves as the single source of truth for visual QA.
          </p>
        </header>

        {/* ══════════════════════════════════════════════
            TYPOGRAPHY
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Foundations" title="Type Scale">
          <div className="flex flex-col gap-6">
            {/* Display / Serif */}
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Newsreader (display)
              </p>
              <div className="flex flex-col gap-3">
                <span className="font-display font-semibold text-[56px] leading-[1.08] tracking-tightish text-char-900">
                  Display 56
                </span>
                <span className="font-display font-semibold text-[40px] leading-[1.08] tracking-tightish text-char-900">
                  Heading 1 &mdash; 40px
                </span>
                <span className="font-display font-semibold text-[30px] leading-[1.08] tracking-tightish text-char-900">
                  Heading 2 &mdash; 30px
                </span>
                <span className="font-display font-semibold text-[23px] leading-snug tracking-tightish text-char-900">
                  Heading 3 &mdash; 23px
                </span>
                <span className="font-display font-semibold text-[19px] leading-snug tracking-tightish text-char-900">
                  Heading 4 &mdash; 19px
                </span>
              </div>
            </div>
            {/* Sans / Body */}
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Hanken Grotesk (body)
              </p>
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[18px] text-char-900">Body Large &mdash; 18px</span>
                <span className="font-sans text-[16px] text-char-900">Body &mdash; 16px</span>
                <span className="font-sans text-[14px] text-char-700">Body Small &mdash; 14px</span>
                <span className="font-sans text-[13px] text-char-500">Caption &mdash; 13px</span>
                <span className="font-sans text-[12px] font-bold tracking-eyebrow uppercase text-char-500">
                  Label / Eyebrow &mdash; 12px
                </span>
              </div>
            </div>
            {/* Mono / Data */}
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                IBM Plex Mono (data)
              </p>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[16px] tabular-nums text-char-900">
                  1,234.56 &mdash; 16px mono
                </span>
                <span className="font-mono text-[13px] tabular-nums text-char-500">
                  0.0042 mg/dL &mdash; 13px mono
                </span>
              </div>
            </div>
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            COLOR TOKENS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Foundations" title="Color Tokens">
          <div className="flex flex-col gap-6">
            {Object.entries(PALETTES).map(([name, swatches]) => (
              <div key={name}>
                <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                  {name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {swatches.map(([token, hex]) => (
                    <div key={token} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-14 h-14 rounded-md border border-sand-200"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="text-[11px] font-mono text-char-500 text-center leading-tight">
                        {token}
                      </span>
                      <span className="text-[10px] font-mono text-char-400">
                        {hex}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            RADII
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Foundations" title="Border Radii">
          <div className="flex flex-wrap gap-4 items-end">
            {RADII.map(([name, val]) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 bg-forest-100 border-2 border-forest-300"
                  style={{ borderRadius: val }}
                />
                <span className="text-[12px] font-mono text-char-500">{name}</span>
                <span className="text-[10px] font-mono text-char-400">{val}</span>
              </div>
            ))}
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            SHADOWS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Foundations" title="Elevation / Shadows">
          <div className="flex flex-wrap gap-6 items-end">
            {SHADOWS.map(([name, val]) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <div
                  className="w-20 h-20 bg-white rounded-xl"
                  style={{ boxShadow: val }}
                />
                <span className="text-[12px] font-mono text-char-500">{name}</span>
              </div>
            ))}
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            ICONS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Foundations" title="Material Symbols Rounded">
          <div>
            <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
              Outline (default)
            </p>
            <div className="flex flex-wrap gap-4">
              {SAMPLE_ICONS.map((icon) => (
                <div key={icon} className="flex flex-col items-center gap-1.5">
                  <span className="material-symbols-rounded text-char-700" style={{ fontSize: 28 }}>
                    {icon}
                  </span>
                  <span className="text-[10px] font-mono text-char-400">{icon}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
              Filled
            </p>
            <div className="flex flex-wrap gap-4">
              {SAMPLE_ICONS.map((icon) => (
                <div key={icon} className="flex flex-col items-center gap-1.5">
                  <span className="material-symbols-rounded fill text-forest-700" style={{ fontSize: 28 }}>
                    {icon}
                  </span>
                  <span className="text-[10px] font-mono text-char-400">{icon}</span>
                </div>
              ))}
            </div>
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            BUTTONS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="Buttons">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400">
                PrimaryButton (forest)
              </p>
              <PrimaryButton>Primary Action</PrimaryButton>
              <PrimaryButton loading>Loading</PrimaryButton>
              <PrimaryButton disabled>Disabled</PrimaryButton>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400">
                SecondaryButton (outline)
              </p>
              <SecondaryButton>Secondary Action</SecondaryButton>
              <SecondaryButton disabled>Disabled</SecondaryButton>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
              Pill variants (class-based)
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="pill-forest">Forest</button>
              <button className="pill-plum">Plum</button>
              <button className="pill-honey">Honey</button>
              <button className="pill-ghost">Ghost</button>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
              Danger (inline)
            </p>
            <button className="pill-btn bg-signal-avoid text-white hover:opacity-90 active:translate-y-[1px] active:scale-[0.99]">
              Danger / Destructive
            </button>
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            SIGNAL CHIPS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="SignalChip">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Standard
              </p>
              <div className="flex flex-wrap gap-3">
                <SignalChip signal="beneficial" />
                <SignalChip signal="limit" />
                <SignalChip signal="avoid" />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Compact
              </p>
              <div className="flex flex-wrap gap-3">
                <SignalChip signal="beneficial" compact />
                <SignalChip signal="limit" compact />
                <SignalChip signal="avoid" compact />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Label hidden
              </p>
              <div className="flex flex-wrap gap-3">
                <SignalChip signal="beneficial" label={false} />
                <SignalChip signal="limit" label={false} />
                <SignalChip signal="avoid" label={false} />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Custom label
              </p>
              <div className="flex flex-wrap gap-3">
                <SignalChip signal="beneficial" label="Eat freely" />
                <SignalChip signal="limit" label="Moderate" />
                <SignalChip signal="avoid" label="Restrict" />
              </div>
            </div>
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            CONDITION TAGS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="ConditionTag">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Per-condition hues
              </p>
              <div className="flex flex-wrap gap-2">
                <ConditionTag condition="Type 2 Diabetes" />
                <ConditionTag condition="Hypertension (high blood pressure)" />
                <ConditionTag condition="Heart failure" />
                <ConditionTag condition="High cholesterol" />
                <ConditionTag condition="Depression" />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                Solid variant
              </p>
              <div className="flex flex-wrap gap-2">
                <ConditionTag condition="Type 2 Diabetes" solid />
                <ConditionTag condition="Hypertension (high blood pressure)" solid />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
                With remove button
              </p>
              <div className="flex flex-wrap gap-2">
                <ConditionTag condition="Heart failure" onRemove={() => {}} />
                <ConditionTag condition="Type 2 Diabetes" onRemove={() => {}} />
              </div>
            </div>
          </div>
        </GallerySection>

{/* ══════════════════════════════════════════════
            CARDS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="Card Variants">
          <div className="grid sm:grid-cols-2 gap-4">
            {['default', 'flat', 'raised', 'warm', 'forest', 'plum'].map((v) => (
              <Card key={v} variant={v}>
                <p className={`font-semibold text-sm ${v === 'forest' || v === 'plum' ? 'text-white' : 'text-char-900'}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </p>
                <p className={`text-xs mt-1 ${v === 'forest' || v === 'plum' ? 'text-white/70' : 'text-char-500'}`}>
                  variant=&quot;{v}&quot;
                </p>
              </Card>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-400 mb-3">
              With eyebrow + title + action
            </p>
            <Card
              eyebrow="Daily Summary"
              title="Your food plan for today"
              action={<button className="pill-forest text-[13px] px-4 py-1.5">View all</button>}
            >
              <p className="text-sm text-char-500">Card content goes here.</p>
            </Card>
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            STAT RINGS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="StatRing">
          <div className="flex flex-wrap gap-8 justify-center py-4">
            <StatRing value={12} max={20} label="Helpful" tone="forest" />
            <StatRing value={5} max={20} label="Limit" tone="honey" />
            <StatRing value={3} max={20} label="Avoid" tone="avoid" />
            <StatRing value={8} max={10} label="Score" sublabel="of 10" tone="plum" />
          </div>
        </GallerySection>

        {/* ══════════════════════════════════════════════
            EMPTY STATE
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="EmptyState">
          <EmptyState
            icon="search"
            title="No results found"
            body="Try a different food or ingredient to see guidance."
            action={<button className="pill-forest text-[14px]">Browse foods</button>}
          />
        </GallerySection>

        {/* ══════════════════════════════════════════════
            FORM INPUTS
           ══════════════════════════════════════════════ */}
        <GallerySection eyebrow="Components" title="Form Inputs">
          <div className="flex flex-col gap-4 max-w-sm">
            <div>
              <label className="text-sm font-medium text-char-700 mb-1.5 block">
                Text input
              </label>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Enter a food name..."
                className="w-full h-[48px] px-4 rounded-md border border-sand-200 bg-white
                  text-char-900 font-sans text-[15px] placeholder:text-char-400
                  outline-none transition-shadow duration-fast
                  focus:border-forest-600 focus:ring-[3px] focus:ring-forest-600/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-char-700 mb-1.5 block">
                Select
              </label>
              <select
                className="w-full h-[48px] px-4 rounded-md border border-sand-200 bg-white
                  text-char-900 font-sans text-[15px]
                  outline-none transition-shadow duration-fast
                  focus:border-forest-600 focus:ring-[3px] focus:ring-forest-600/20"
              >
                <option>Type 2 Diabetes</option>
                <option>Hypertension</option>
                <option>High cholesterol</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-char-700 mb-1.5 block">
                Textarea
              </label>
              <textarea
                rows={3}
                placeholder="Add notes..."
                className="w-full px-4 py-3 rounded-md border border-sand-200 bg-white
                  text-char-900 font-sans text-[15px] placeholder:text-char-400
                  outline-none transition-shadow duration-fast resize-none
                  focus:border-forest-600 focus:ring-[3px] focus:ring-forest-600/20"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="ds-check"
                className="w-5 h-5 rounded-sm border-sand-200 text-forest-700
                  focus:ring-forest-600/20 focus:ring-[3px] accent-forest-700"
              />
              <label htmlFor="ds-check" className="text-sm text-char-700">
                I agree to the terms
              </label>
            </div>
          </div>
        </GallerySection>

      </div>
    </div>
  );
}

/* ── Gallery section wrapper ──────────────────────────────── */
function GallerySection({ eyebrow, title, children }) {
  return (
    <section className="flex flex-col gap-5">
      {eyebrow && (
        <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-500">
          {eyebrow}
        </p>
      )}
      <div className="bg-white rounded-xl border border-sand-200 shadow-card p-6 sm:p-8">
        {title && (
          <h2 className="font-display text-[23px] font-semibold tracking-tightish leading-snug text-char-900 mb-5">
            {title}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}
