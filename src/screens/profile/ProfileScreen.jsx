/**
 * ProfileScreen — layout (top → bottom):
 *   1. Header zone   — page label + identity block (avatar, name, active conditions)
 *   2. Lower shell   — "Dietary Guidance" button (→ /app/suggestions), then
 *                      an inline editor below it: condition editor (saves on
 *                      change), macro-goals stub (flagged), and sub-edit rows
 *                      for the other profile fields. Scroll down to reach the
 *                      editor.
 *   3. Sub-edit sheets — BottomSheets for medications / allergies / dietary,
 *                        opened from the sub-edit rows.
 *   4. Navbar        — reused, pinned (AppShell)
 *
 * Mirrors HomeScreen: the shell flexes and the page may scroll (the inline
 * editor drives height); paper-100 fills to the bottom so no base cream shows.
 * The dietary guidance content (Top Dos & Don'ts, food groups, recipes) lives
 * on SuggestionsScreen now.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { getProfile, saveProfile, getConditionNames, getConditions } from '../../api/api.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import Icon from '../../components/shared/Icon.jsx';
import { getConditionMeta } from '../../utils/conditionMeta.js';
import { ftInToCm, cmToFtIn, lbsToKg, kgToLbs } from '../../api/calorieNeeds.js';

// ── Demo profile fallback ────────────────────────────────────────────────────

// Demo key conditions (see api/config.js): 203 = Aging, 244 = Pneumonia.
const DEMO_PROFILE = {
  conditions: DEFAULT_DEV_CONDITIONS,
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

const SEX_CHOICES = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const ACTIVITY_CHOICES = [
  { value: 'sedentary', label: 'Sedentary — little to no exercise' },
  { value: 'light', label: 'Lightly active — 1-3 workouts/week' },
  { value: 'moderate', label: 'Moderately active — 3-5 workouts/week' },
  { value: 'active', label: 'Active — 6-7 workouts/week' },
  { value: 'very_active', label: 'Very active — physical job or 2x/day' },
];

const aboutYouInputClass =
  'flex-1 bg-paper-100 border border-sand-200 rounded-lg px-4 py-3 text-sm font-sans outline-none focus:border-forest-700 transition-colors duration-base';

/**
 * EditAboutYou — height/weight/age/sex/activity level editor, backing
 * `estimateDailyNeed`/`computeBMI` (src/api/calorieNeeds.js). Every field is
 * optional and clearable: blanking a field and saving removes it from the
 * profile (via an explicit `undefined` in the patch) rather than leaving the
 * stale value behind, since this is an edit surface (unlike onboarding's
 * BiometricsStep, which only ever adds fields to a fresh profile).
 * Values are collected in US units and converted to metric on save — see
 * ftInToCm/lbsToKg.
 */
function EditAboutYou({ profile, onChange, onClose }) {
  const prefillHeight = cmToFtIn(profile?.heightCm);
  const [ft, setFt] = useState(profile?.heightCm ? String(prefillHeight.ft) : '');
  const [inches, setInches] = useState(profile?.heightCm ? String(prefillHeight.inches) : '');
  const [weightLbs, setWeightLbs] = useState(
    profile?.weightKg ? String(Math.round(kgToLbs(profile.weightKg))) : ''
  );
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [sex, setSex] = useState(profile?.sex ?? '');
  const [activityLevel, setActivityLevel] = useState(profile?.activityLevel ?? '');

  const save = () => {
    const patch = {
      heightCm: undefined,
      weightKg: undefined,
      age: undefined,
      sex: undefined,
      activityLevel: undefined,
    };

    if (ft.trim() || inches.trim()) {
      const cm = ftInToCm(Number(ft), Number(inches));
      if (cm > 0) patch.heightCm = Math.round(cm * 10) / 10;
    }
    if (weightLbs.trim()) {
      const kg = lbsToKg(Number(weightLbs));
      if (kg > 0) patch.weightKg = Math.round(kg * 10) / 10;
    }
    if (age.trim()) {
      const ageNum = Number(age);
      if (Number.isFinite(ageNum) && ageNum > 0) patch.age = ageNum;
    }
    if (sex) patch.sex = sex;
    if (activityLevel) patch.activityLevel = activityLevel;

    onChange(patch);
    onClose();
  };

  return (
    <BottomSheet open onClose={onClose} title="About you">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-char-400 font-sans -mt-1">
          Optional — this sizes your plan's portions. We don't track or log anything you eat.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold font-sans text-char-500">Height</label>
          <div className="flex gap-2">
            <input
              type="number" inputMode="numeric" min="0" value={ft}
              onChange={(e) => setFt(e.target.value)} placeholder="Feet"
              className={aboutYouInputClass}
            />
            <input
              type="number" inputMode="numeric" min="0" max="11" value={inches}
              onChange={(e) => setInches(e.target.value)} placeholder="Inches"
              className={aboutYouInputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold font-sans text-char-500">Weight (lbs)</label>
          <input
            type="number" inputMode="numeric" min="0" value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)} placeholder="e.g. 160"
            className={aboutYouInputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold font-sans text-char-500">Age</label>
          <input
            type="number" inputMode="numeric" min="0" value={age}
            onChange={(e) => setAge(e.target.value)} placeholder="e.g. 34"
            className={aboutYouInputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold font-sans text-char-500">Sex</label>
          <div className="grid grid-cols-2 gap-3">
            {SEX_CHOICES.map(({ value, label }) => {
              const isSel = sex === value;
              return (
                <button
                  key={value}
                  onClick={() => setSex(isSel ? '' : value)}
                  className={`px-4 py-3 rounded-lg border-2 text-center transition-all duration-fast
                    ${isSel ? 'border-forest-700 bg-forest-50' : 'border-sand-200 bg-white hover:border-forest-300'}`}
                >
                  <span className={`text-sm font-semibold font-sans ${isSel ? 'text-forest-700' : 'text-char-900'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold font-sans text-char-500">Activity level</label>
          <div className="flex flex-col gap-2">
            {ACTIVITY_CHOICES.map(({ value, label }) => {
              const isSel = activityLevel === value;
              return (
                <button
                  key={value}
                  onClick={() => setActivityLevel(isSel ? '' : value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-sans transition-all duration-fast
                    ${isSel ? 'border-forest-700 bg-forest-50 text-forest-700 font-semibold' : 'border-sand-200 bg-white text-char-900 hover:border-forest-300'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={save}
          className="w-full py-4 rounded-xs text-white font-semibold font-sans text-base mt-2 bg-forest-700 hover:bg-forest-800 transition-colors duration-fast"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Inline editor pieces — condition editor + macro stub + sub-edit nav ───────

/**
 * ConditionsEditor — the removable chip list of the profile's current
 * conditions. Adding is handled by ConditionDropdown ("browse all conditions")
 * above; this surface is just for reviewing and removing what's already set.
 */
function ConditionsEditor({ value, onChange }) {
  // Full {healthConditionID, description} objects from the Nutridigm dictionary.
  const [apiConditions, setApiConditions] = useState([]);

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

  const remove = (id) => onChange(value.filter((x) => x !== id));

  if (value.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Filled tags — colored per condition category, with a close ×.
          Subtle longDescription/ICD10 sub-text renders under each tag when
          present, rather than redesigning the chip itself. */}
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
  );
}

/**
 * ConditionDropdown — a fully custom (app-styled) picker over the *full*
 * /healthconditions dictionary, replacing the native <select> so the option
 * list matches the design system rather than the OS chrome. A pill trigger
 * opens a panel with a search field (matches description or AKA aliases) and a
 * scrollable, category-colored list. This is the stakeholder-demo surface
 * proving the condition list is driven by the database table (not hardcoded) —
 * see plan Part 1. Picking a condition adds its ID; already-added conditions
 * render dimmed with a ✓ and can't be re-added.
 */
function ConditionDropdown({ value, onChange }) {
  const [apiConditions, setApiConditions] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    getConditions()
      .then((conds) => setApiConditions((conds || []).filter((c) => c && c.description)))
      .catch(() => {});
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sortedConditions = useMemo(
    () => [...apiConditions].sort((a, b) => a.description.localeCompare(b.description)),
    [apiConditions]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return sortedConditions;
    const q = query.toLowerCase();
    // Match on description OR any AKA alias (semicolon-separated).
    return sortedConditions.filter((c) => {
      if (c.description.toLowerCase().includes(q)) return true;
      return (c.AKA || '')
        .split(';')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .some((alias) => alias.includes(q));
    });
  }, [query, sortedConditions]);

  const loading = sortedConditions.length === 0;

  const add = (id) => {
    // Number() guard — a stray string ID silently corrupts downstream CSV joins.
    if (Number.isFinite(id) && !value.includes(id)) onChange([...value, id]);
    setQuery('');
  };

  return (
    <div className="relative" ref={rootRef}>
      {/* Pill trigger — mirrors the app's searchbar/select styling */}
      <button
        type="button"
        onClick={() => !loading && setOpen((o) => !o)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 pl-4 pr-3 py-[15px] rounded-full border-[1.5px] bg-white text-[16px] text-char-500 font-sans shadow-sm outline-none transition-all duration-fast ease-ds-out disabled:opacity-60"
        style={{ borderColor: open ? '#111E58' : '#E6E6E0' }}
      >
        <span className="truncate">
          {loading ? 'Loading conditions…' : 'Browse all conditions (A–Z)…'}
        </span>
        <span
          className={`material-symbols-rounded text-[18px] text-char-400 flex-shrink-0 transition-transform duration-fast ease-ds-out ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* App-styled panel — search + scrollable colored list */}
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-2 rounded-2xl border border-sand-200 bg-white shadow-md overflow-hidden origin-top animate-sheet-up">
          <div className="p-2 border-b border-sand-200">
            <div className="relative group">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none transition-colors duration-fast text-char-400 group-focus-within:text-blue-900">
                search
              </span>
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conditions…"
                className="w-full pl-10 pr-3 py-2.5 rounded-full border-[1.5px] border-sand-200 bg-paper-100 text-[15px] text-char-900 placeholder:text-char-400 font-sans outline-none transition-colors duration-fast ease-ds-out focus:border-blue-900 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-[280px] overflow-y-auto p-1.5 flex flex-col gap-1">
            {filtered.map((c) => {
              const isSelected = value.includes(c.healthConditionID);
              const meta = getConditionMeta(c.description);
              return (
                <button
                  key={c.healthConditionID}
                  onClick={() => !isSelected && add(c.healthConditionID)}
                  disabled={isSelected}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium font-sans flex items-center gap-2.5 transition-colors duration-fast ${
                    isSelected ? 'opacity-45 cursor-default' : 'hover:bg-paper-100'
                  }`}
                >
                  <span
                    className="material-symbols-rounded text-[18px] flex-shrink-0"
                    style={{ color: meta.color }}
                  >
                    {isSelected ? 'check' : meta.icon}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="truncate text-char-900">{c.description}</span>
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
            {query.trim() && filtered.length === 0 && (
              <p className="text-sm text-char-400 font-sans italic text-center py-6">
                No conditions found for "{query}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubEditRow({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-4 text-left border-b border-sand-200 last:border-b-0 transition-opacity duration-fast hover:opacity-80"
    >
      <span className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-char-500">
          <Icon name={icon} size={20} />
        </span>
        <span className="flex-1 text-sm font-medium font-sans text-char-900">{label}</span>
      </span>
      <span className="text-char-400">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Display names for profile.conditions (healthConditionID[]), resolved via
  // the cached conditions dictionary.
  const [conditionNames, setConditionNames] = useState([]);
  // null | 'medications' | 'allergies' | 'dietary' | 'about'
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p ?? DEMO_PROFILE);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    getConditionNames(profile?.conditions ?? [])
      .then((names) => { if (alive) setConditionNames(names); })
      .catch(() => { if (alive) setConditionNames([]); });
    return () => { alive = false; };
  }, [profile?.conditions]);

  const save = async (updates) => {
    const next = { ...profile, ...updates };
    setProfile(next);
    setSaving(true);
    await saveProfile(next);
    setSaving(false);
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
      <div className="bg-forest-300 px-5 pt-10 pb-6">
        {/* Page label row — mirrors HomeScreen's label + right-side icon pattern */}
        <div className="flex items-start justify-between">
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

      {/* ── 2. Lower shell — glance button + inline editor ─────────────────── */}
      {/* flex-1 stretches paper-100 to the bottom (and behind the navbar via its
          own pb-28) so the base cream never shows. */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-4 pt-4 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col gap-5">

        {/* Inline profile editor — scroll down to edit conditions & details.
            Conditions save on change; the header chips update live off profile. */}
        <div className="flex flex-col gap-5">
          {/* Section 1 — Conditions */}
          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-3">
              Your conditions
            </p>
            <div className="flex flex-col gap-3">
              <ConditionDropdown
                value={profile?.conditions ?? []}
                onChange={(v) => save({ conditions: v })}
              />
              <ConditionsEditor
                value={profile?.conditions ?? []}
                onChange={(v) => save({ conditions: v })}
              />
            </div>
          </div>

          {/* Section 2 — Sub-edit rows (other profile fields) */}
          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-1">
              Profile details
            </p>
            <SubEditRow icon="scale" label="About you" onClick={() => setSheet('about')} />
            <SubEditRow icon="pill" label="Medications" onClick={() => setSheet('medications')} />
            <SubEditRow icon="shield" label="Allergies & intolerances" onClick={() => setSheet('allergies')} />
            <SubEditRow icon="leaf" label="Dietary preferences" onClick={() => setSheet('dietary')} />
          </div>
        </div>
      </div>

      {/* ── Sub-edit sheets (BottomSheet) ─────────────────────────────────── */}
      {sheet === 'about' && (
        <EditAboutYou
          profile={profile}
          onChange={(patch) => save(patch)}
          onClose={() => setSheet(null)}
        />
      )}
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
