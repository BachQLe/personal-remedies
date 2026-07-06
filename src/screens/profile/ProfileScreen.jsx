/**
 * ProfileScreen — layout (top → bottom):
 *   1. Header zone   — page label + identity block (avatar, name, active conditions)
 *   2. Lower shell   — CategoryCarousel, then an inline editor below it:
 *                      condition editor (saves on change), macro-goals stub
 *                      (flagged), and sub-edit rows for the other profile fields.
 *                      Scroll down to reach the editor.
 *   3. Sub-edit sheets — BottomSheets for medications / allergies / dietary,
 *                        opened from the sub-edit rows.
 *   4. Navbar        — reused, pinned (AppShell)
 *
 * Mirrors HomeScreen: the shell flexes and the page may scroll (the carousel's
 * 3:4 cards + the inline editor drive height); paper-100 fills to the bottom so
 * no base cream shows.
 * Real /suggest-per-fineFoodGroup wiring for the carousel is a one-line swap
 * once the mock is replaced (getCategoryTopPicks).
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import Icon from '../../components/shared/Icon.jsx';
import { getConditionMeta } from '../../utils/conditionMeta.js';
import { getConditions } from '../../api/api.js';
import CategoryCarousel from './CategoryCarousel.jsx';

// ── Feature flags ────────────────────────────────────────────────────────────

const ENABLE_MACRO_GOALS = false;

// ── Mock data layer ──────────────────────────────────────────────────────────
// Shape matches getCategoryTopPicks() → CategoryTopPick[] contract from spec.
// Swap the function body for real /suggest calls when the API wiring is ready.

const MOCK_TOP_PICKS = [
  {
    categoryId: 'd',
    categoryLabel: 'Fruits & Juices',
    topIngredient: {
      id: 'blueberries',
      name: 'Blueberries',
      imageUrl:
        'https://images.unsplash.com/photo-1519996529931-28324d5a630e?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'e',
    categoryLabel: 'Vegetables',
    topIngredient: {
      id: 'spinach',
      name: 'Spinach',
      imageUrl:
        'https://images.unsplash.com/photo-1576045057995-568f588f82fb?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'b',
    categoryLabel: 'Meat, Fish & Poultry',
    topIngredient: {
      id: 'salmon',
      name: 'Salmon',
      imageUrl:
        'https://images.unsplash.com/photo-1467003909585-2f8a72700288?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'c',
    categoryLabel: 'Nuts & Seeds',
    topIngredient: {
      id: 'almonds',
      name: 'Almonds',
      imageUrl:
        'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'f',
    categoryLabel: 'Grains & Cereals',
    topIngredient: {
      id: 'oats',
      name: 'Rolled Oats',
      imageUrl:
        'https://images.unsplash.com/photo-1568254183919-78a4f43a2877?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'g',
    categoryLabel: 'Dairy, Fats & Oils',
    topIngredient: {
      id: 'olive-oil',
      name: 'Olive Oil',
      imageUrl:
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'i',
    categoryLabel: 'Herbs & Spices',
    topIngredient: {
      id: 'turmeric',
      name: 'Turmeric',
      imageUrl:
        'https://images.unsplash.com/photo-1615485925600-97237c4fc1ec?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
  {
    categoryId: 'k',
    categoryLabel: 'Key Nutrients',
    topIngredient: {
      id: 'walnuts',
      name: 'Walnuts',
      imageUrl:
        'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?fm=jpg&q=80&w=800&auto=format&fit=crop',
    },
  },
];

async function getCategoryTopPicks() {
  return MOCK_TOP_PICKS;
}

// ── Demo profile fallback ────────────────────────────────────────────────────

// Demo key conditions (see api/config.js DEFAULT_DEV_CONDITIONS): 203 = Aging, 244 = Pneumonia.
const DEMO_PROFILE = {
  conditions: [203, 244],
  medications: ['Metformin 500mg', 'Lisinopril 10mg'],
  allergies: ['Shellfish'],
  dietary: ['low-sodium'],
  tasteLikes: [],
  tasteDislikes: [],
};

const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: 'leaf' },
  { value: 'vegan', label: 'Vegan', icon: 'sun' },
  { value: 'pescatarian', label: 'Pescatarian', icon: 'utensils' },
  { value: 'avoid-pork', label: 'Avoid Pork', icon: 'shield' },
  { value: 'gluten-free', label: 'Gluten-Free', icon: 'zap' },
  { value: 'dairy-free', label: 'Dairy-Free', icon: 'cloud' },
  { value: 'low-sodium', label: 'Low Sodium', icon: 'activity' },
];

// ── Sub-edit sheets (unchanged from prior screen) ────────────────────────────

function EditList({ title, value, placeholder, onChange, onClose }) {
  const [items, setItems] = useState([...value]);
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setInput('');
  };

  const remove = (item) => setItems(items.filter((x) => x !== item));

  return (
    <BottomSheet open onClose={onClose} title={title}>
      <div className="flex flex-col gap-3" style={{ minHeight: 380 }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={placeholder}
            className="flex-1 bg-paper-100 border border-sand-200 rounded-lg px-4 py-3 text-sm font-sans outline-none focus:border-forest-700 transition-colors duration-base"
          />
          <button
            onClick={add}
            disabled={!input.trim()}
            className="px-4 py-3 rounded-lg text-sm font-semibold font-sans text-white bg-forest-700 hover:bg-forest-800 disabled:opacity-40 transition-all duration-fast"
          >
            Add
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 240 }}>
          {items.length === 0 && (
            <p className="text-sm text-char-400 font-sans italic text-center py-6">None added yet</p>
          )}
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between px-4 py-3 bg-paper-100 rounded-lg">
              <span className="text-sm text-char-900 font-sans">{item}</span>
              <button
                onClick={() => remove(item)}
                className="text-xs font-semibold font-sans text-char-500 hover:text-avoid-600 transition-colors duration-fast"
                style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => { onChange(items); onClose(); }}
          className="w-full py-4 rounded-xs text-white font-semibold font-sans text-base mt-auto bg-forest-700 hover:bg-forest-800 transition-colors duration-fast"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

function EditDietary({ value, onChange, onClose }) {
  const [selected, setSelected] = useState([...value]);

  const toggle = (v) => {
    if (selected.includes(v)) setSelected(selected.filter((x) => x !== v));
    else setSelected([...selected, v]);
  };

  return (
    <BottomSheet open onClose={onClose} title="Dietary preferences">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {DIETARY_OPTIONS.map(({ value: v, label, icon }) => {
            const isSel = selected.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggle(v)}
                className={`flex items-center gap-3 px-4 py-4 rounded-lg border-2 text-left transition-all duration-fast
                  ${isSel ? 'border-forest-700 bg-forest-50' : 'border-sand-200 bg-white hover:border-forest-300'}`}
              >
                <span style={{ color: isSel ? '#628C22' : '#8A8377' }}>
                  <Icon name={icon} size={22} />
                </span>
                <span className={`text-sm font-semibold font-sans ${isSel ? 'text-forest-700' : 'text-char-900'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { onChange(selected); onClose(); }}
          className="w-full py-4 rounded-xs text-white font-semibold font-sans text-base bg-forest-700 hover:bg-forest-800 transition-colors duration-fast"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Inline editor pieces — condition editor + macro stub + sub-edit nav ───────

function ConditionsEditor({ value, onChange }) {
  const [query, setQuery] = useState('');
  // Full {healthConditionID, description} objects from the Nutridigm dictionary.
  const [apiConditions, setApiConditions] = useState([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    getConditions()
      .then((conds) => setApiConditions((conds || []).filter((c) => c && c.description)))
      .catch(() => {});
  }, []);

  const conditionById = useMemo(
    () => new Map(apiConditions.map((c) => [c.healthConditionID, c.description])),
    [apiConditions]
  );
  const describeCondition = (id) => conditionById.get(id) || `Condition ${id}`;

  // Full dictionary objects (not just the display name) keyed by id, so the
  // "in profile" chip list can also surface longDescription / ICD10.
  const conditionObjById = useMemo(
    () => new Map(apiConditions.map((c) => [c.healthConditionID, c])),
    [apiConditions]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return apiConditions.slice(0, 20);
    const q = query.toLowerCase();
    // Match on description OR any AKA alias from the Nutridigm dictionary
    // (semicolon-separated; defensive `c.AKA || ''` in case it's absent).
    return apiConditions
      .filter((c) => {
        if (c.description.toLowerCase().includes(q)) return true;
        return (c.AKA || '')
          .split(';')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .some((alias) => alias.includes(q));
      })
      .slice(0, 20);
  }, [query, apiConditions]);

  // Reveal the results only while the search is active; exclude already-picked.
  const open = focused || !!query.trim();
  const availableResults = filtered.filter((c) => !value.includes(c.healthConditionID));

  const add = (id) => {
    if (!value.includes(id)) onChange([...value, id]);
    setQuery('');
  };
  const remove = (id) => onChange(value.filter((x) => x !== id));

  return (
    <div className="flex flex-col gap-3">
      {/* Filled tags — colored per condition category, with a close ×.
          Subtle longDescription/ICD10 sub-text renders under each tag when
          present, rather than redesigning the chip itself. */}
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((id) => {
            const label = describeCondition(id);
            const meta = getConditionMeta(label);
            const cond = conditionObjById.get(id);
            return (
              <div key={id} className="flex flex-col gap-1">
                <button
                  onClick={() => remove(id)}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium font-sans text-white transition-colors duration-fast"
                  style={{ backgroundColor: `${meta.color}88` }}
                >
                  {label}
                  <span className="opacity-70">
                    <Icon name="x" size={14} />
                  </span>
                </button>
                {(cond?.longDescription || cond?.ICD10) && (
                  <div className="flex items-baseline gap-2 px-3">
                    {cond?.longDescription && (
                      <span className="text-[11px] text-char-400 font-sans truncate">
                        {cond.longDescription}
                      </span>
                    )}
                    {cond?.ICD10 && (
                      <span className="text-[10px] text-char-300 font-mono flex-none">
                        {cond.ICD10}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pill searchbar — leading search icon, blue focus */}
      <div className="relative group">
        <span className="material-symbols-rounded absolute left-[15px] top-1/2 -translate-y-1/2 text-[18px] pointer-events-none transition-colors duration-fast text-char-400 group-focus-within:text-blue-900">
          search
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search conditions…"
          className="w-full pl-11 pr-4 py-[15px] rounded-full border-[1.5px] border-sand-200 bg-white text-[16px] text-char-900 placeholder:text-char-400 font-sans shadow-sm outline-none transition-all duration-fast ease-ds-out focus:border-blue-900"
        />
      </div>

      {/* Compact results — reveal on focus, scrolls internally */}
      {open && (
        <div
          className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[240px]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {availableResults.map((c) => {
            const meta = getConditionMeta(c.description);
            return (
              <button
                key={c.healthConditionID}
                onClick={() => add(c.healthConditionID)}
                className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium font-sans bg-white text-char-900 border border-sand-200 hover:border-blue-900 shadow-sm transition-all duration-fast flex items-center gap-2.5"
              >
                <span
                  className="material-symbols-rounded text-[18px] flex-shrink-0"
                  style={{ color: meta.color }}
                >
                  {meta.icon}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="truncate">{c.description}</span>
                  {c.longDescription && (
                    <span className="block text-[11px] font-normal text-char-400 truncate">
                      {c.longDescription.length > 70
                        ? c.longDescription.trim().slice(0, 69).trimEnd() + '…'
                        : c.longDescription.trim()}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {query.trim() && availableResults.length === 0 && (
            <p className="text-sm text-char-400 font-sans italic text-center py-6">
              No conditions found for "{query}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MacroGoalsStub() {
  return (
    <div className="rounded-xl bg-paper-100 border border-sand-200 p-4 opacity-60">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold font-sans text-char-900">Macro & micro goals</p>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans bg-sand-200 text-char-500">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-char-400 font-sans">
        Set personal nutrition targets to guide your daily picks.
      </p>
    </div>
  );
}

function SubEditRow({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-4 text-left border-b border-sand-200 last:border-b-0 hover:opacity-80 transition-opacity duration-fast"
    >
      <span className="text-char-500">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex-1 text-sm font-medium font-sans text-char-900">{label}</span>
      <span className="text-char-400">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [topPicks, setTopPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Display names for profile.conditions (healthConditionID[]), resolved via
  // the cached conditions dictionary.
  const [conditionNames, setConditionNames] = useState([]);
  // null | 'medications' | 'allergies' | 'dietary'
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      getCategoryTopPicks(),
    ]).then(([p, picks]) => {
      setProfile(p ?? DEMO_PROFILE);
      setTopPicks(picks);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .getConditionNames(profile?.conditions ?? [])
      .then((names) => { if (alive) setConditionNames(names); })
      .catch(() => { if (alive) setConditionNames([]); });
    return () => { alive = false; };
  }, [profile?.conditions]);

  const save = async (updates) => {
    const next = { ...profile, ...updates };
    setProfile(next);
    setSaving(true);
    await api.saveProfile(next);
    setSaving(false);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-paper-100">
        <div
          className="w-8 h-8 rounded-full border-2 border-sand-200 animate-spin"
          style={{ borderTopColor: '#628C22' }}
        />
      </div>
    );
  }

  const initials = user?.email ? user.email[0].toUpperCase() : 'P';
  const displayName = profile?.firstName?.trim() || user?.email?.split('@')[0] || 'Your profile';

  return (
    // Fills at least one viewport and may scroll if the carousel's 3:4 cards run
    // taller. `min-h-screen` keeps the paper-100 bg reaching the bottom; `-mb-28`
    // cancels the AppShell main's pb-28 navbar reserve so no base cream peeks
    // through (mirrors HomeScreen / the appshell-cream-fix pattern).
    <div className="min-h-screen -mb-28 bg-forest-300 flex flex-col">

      {/* ── 1. Header zone ─────────────────────────────────────────────────── */}
      <div className="bg-forest-300 px-5 pt-6 pb-6">
        {/* Page label row — mirrors HomeScreen's label + right-side icon pattern */}
        <div className="flex items-center justify-between">
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/60">Profile</p>
          <div className="w-12 h-12 mt-2 ml-2 rounded-full bg-forest-700 flex items-center justify-center text-white text-base font-bold font-sans flex-shrink-0 shadow-xs">
            {initials}
          </div>
        </div>

        {/* Display name — same size as HomeScreen's "Hi there, [name]" greeting */}
        <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
          {displayName}
        </h1>

        {/* Active conditions — stacked vertically, bigger chips */}
        {profile?.conditions?.length > 0 && (
          <div className="flex flex-col gap-2 mt-3 items-start">
            {profile.conditions.map((id, i) => (
              <ConditionTag key={id} condition={conditionNames[i] ?? `Condition ${id}`} solid truncate className="max-w-[50%]" />
            ))}
          </div>
        )}

        {saving && (
          <span className="text-xs text-char-400 font-sans flex items-center gap-1.5 mt-2">
            <span className="animate-spin inline-flex">
              <Icon name="refresh-cw" size={13} />
            </span>
            Saving
          </span>
        )}
      </div>

      {/* ── 2. Lower shell — carousel + inline editor ──────────────────────── */}
      {/* flex-1 stretches paper-100 to the bottom (and behind the navbar via its
          own pb-28) so the base cream never shows. */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-4 pt-4 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col gap-5">

        {/* Carousel container — sizes to its content; the 3:4 cards drive height */}
        <div>
          <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-3">
            Your profile at a glance
          </p>
          <div className="bg-neutral-50 rounded-xl border border-neutral-300/50 shadow-xs px-3 py-2">
            <CategoryCarousel picks={topPicks} autoAdvance />
          </div>
        </div>

        {/* Inline profile editor — scroll down to edit conditions & details.
            Conditions save on change; the header chips update live off profile. */}
        <div className="flex flex-col gap-5">
          {/* Section 1 — Conditions */}
          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-3">
              Your conditions
            </p>
            <ConditionsEditor
              value={profile?.conditions ?? []}
              onChange={(v) => save({ conditions: v })}
            />
          </div>

          {/* Section 2 — Macro goals (flagged) */}
          {ENABLE_MACRO_GOALS ? null : <MacroGoalsStub />}

          {/* Section 3 — Sub-edit rows (other profile fields) */}
          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-1">
              Profile details
            </p>
            <SubEditRow icon="pill" label="Medications" onClick={() => setSheet('medications')} />
            <SubEditRow icon="shield" label="Allergies & intolerances" onClick={() => setSheet('allergies')} />
            <SubEditRow icon="leaf" label="Dietary preferences" onClick={() => setSheet('dietary')} />
          </div>
        </div>
      </div>

      {/* ── Sub-edit sheets (BottomSheet) ─────────────────────────────────── */}
      {sheet === 'medications' && (
        <EditList
          title="Edit medications"
          value={profile?.medications ?? []}
          placeholder="e.g. Metformin 500mg"
          onChange={(v) => save({ medications: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'allergies' && (
        <EditList
          title="Edit allergies & intolerances"
          value={profile?.allergies ?? []}
          placeholder="e.g. Shellfish, Peanuts"
          onChange={(v) => save({ allergies: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'dietary' && (
        <EditDietary
          value={profile?.dietary ?? []}
          onChange={(v) => save({ dietary: v })}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
