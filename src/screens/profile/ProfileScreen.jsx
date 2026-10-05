/**
 * ProfileScreen — layout (top → bottom):
 *   1. Header zone   — page label + identity block (avatar, name, active conditions)
 *   2. Lower shell   — an inline editor: condition editor (saves on
 *                      change), macro-goals stub (flagged), and sub-edit rows
 *                      for the other profile fields. Scroll down to reach the
 *                      editor.
 *   3. Sub-edit sheets — BottomSheet for medications, opened from the
 *                        sub-edit row.
 *   4. Navbar        — reused, pinned (AppShell)
 *
 * Mirrors HomeScreen: the shell flexes and the page may scroll (the inline
 * editor drives height); paper-100 fills to the bottom so no base cream shows.
 * The dietary guidance content (Top Dos & Don'ts, food groups, recipes) lives
 * on SuggestionsScreen now.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, saveProfile, getConditionNames, getConditions } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import DataState from '../../components/shared/DataState.jsx';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import Icon from '../../components/shared/Icon.jsx';
import { getConditionMeta } from '../../utils/conditionMeta.js';
import OtpCodeEntry from '../../components/auth/OtpCodeEntry.jsx';
import { pullProfile } from '../../api/profileSync.js';
import { getActiveMessages } from '../../api/messages.js';
import WhatsNewSheet from './WhatsNewSheet.jsx';
import { buildSupportMailto } from './supportMailto.js';
import { deleteAccount } from '../../api/deleteAccount.js';

// No demo-profile fallback: a missing profile renders empty, a failed load
// shows an error state with Retry.
const EMPTY_PROFILE = { conditions: [], medications: [] };

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
            aria-label={title}
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

/**
 * EditCalorieTarget — single-field editor for `Profile.calorieTarget`, the
 * fixed, user-editable daily calorie baseline that replaced the removed
 * Mifflin-St Jeor estimate (see src/api/calorieNeeds.js). Defaults to 2000
 * when somehow absent. Light validation only: must be a finite number > 0
 * before Save is enabled — mirrors the light "don't save garbage" checks the
 * old biometrics fields used, without inventing new rules.
 */
function EditCalorieTarget({ profile, onChange, onClose }) {
  const [value, setValue] = useState(String(profile?.calorieTarget ?? 2000));

  const parsed = Number(value);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  const save = () => {
    if (!isValid) return;
    onChange({ calorieTarget: Math.round(parsed) });
    onClose();
  };

  return (
    <BottomSheet open onClose={onClose} title="Daily calorie target">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-char-400 font-sans -mt-1">
          Used to gauge whether my plan has enough — change it any time.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="calorie-target-input" className="text-xs font-semibold font-sans text-char-500">Calories per day</label>
          <input
            id="calorie-target-input"
            type="number"
            inputMode="numeric"
            min="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 2000"
            className="flex-1 bg-paper-100 border border-sand-200 rounded-lg px-4 py-3 text-sm font-sans outline-none focus:border-forest-700 transition-colors duration-base"
          />
        </div>

        <button
          onClick={save}
          disabled={!isValid}
          className="w-full py-4 rounded-xs text-white font-semibold font-sans text-base mt-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-40 transition-colors duration-fast"
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
                <Icon name="x" size={14} aria-hidden="true" />
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
        style={{ borderColor: open ? '#111E58' : '#FFFFFF' }}
      >
        <span className="truncate">
          {loading ? 'Loading conditions…' : 'Select your conditions'}
        </span>
        <span
          aria-hidden="true"
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
                aria-label="Search conditions"
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

function SubEditRow({ icon, label, onClick, dot = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-4 text-left border-b border-sand-200 last:border-b-0 transition-opacity duration-fast hover:opacity-80"
    >
      <span className="flex items-center gap-3 flex-1 min-w-0">
        <span className="relative text-char-500">
          <Icon name={icon} size={20} aria-hidden="true" />
          {dot && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-avoid-700"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="flex-1 text-sm font-medium font-sans text-char-900">
          {label}
          {dot && <span className="sr-only"> (new)</span>}
        </span>
      </span>
      <span className="text-char-400">
        <Icon name="chevron-right" size={18} aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * BackupSheet — signed-out "Back up & sync" flow (email → 6-digit code),
 * opened from the Account row in the main screen below. Mirrors this
 * screen's other sub-edit sheets (EditList/EditCalorieTarget) for the
 * email-collection stage, then hands off to the shared OtpCodeEntry (also
 * used by the onboarding backup step and Login.jsx) for the code stage —
 * see REMEDI_MASTER_PLAN.md §4.3-4.5.
 */
function BackupSheet({ onClose }) {
  const { signInWithEmail, isSupabaseConfigured } = useAuth();
  const [stage, setStage] = useState('email'); // 'email' | 'code' | 'done'
  const [email, setEmail] = useState('');
  const [sentAt, setSentAt] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setSending(true);
    setError('');
    try {
      await signInWithEmail(email);
      setSentAt(Date.now());
      setStage('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Same pull-then-continue pattern as Login.jsx / the onboarding backup
  // step: reuse the existing profileSync reconciliation rather than
  // duplicating merge logic here. The user is already signed OUT-turned-IN
  // mid-session on an existing profile screen, so there's no first-time/
  // returning routing decision to make — just settle sync, then close.
  const handleVerified = async (session) => {
    if (session?.user) {
      try {
        await pullProfile(session.user);
      } catch {
        /* best-effort — profileSync already logs/swallows its own errors */
      }
    }
    setStage('done');
    setTimeout(onClose, 1100);
  };

  return (
    <BottomSheet open onClose={onClose} title="Back up & sync">
      <div className="flex flex-col gap-4" style={{ minHeight: 220 }}>
        {stage === 'done' ? (
          <p className="text-sm font-semibold font-sans text-forest-700 text-center py-6">
            You're synced — your profile and plan will follow you across devices.
          </p>
        ) : stage === 'code' ? (
          <OtpCodeEntry
            email={email}
            sentAt={sentAt}
            onVerified={handleVerified}
            onCancel={() => {
              setStage('email');
              setError('');
            }}
          />
        ) : (
          <form onSubmit={submitEmail} className="flex flex-col gap-3">
            <p className="text-xs text-char-400 font-sans -mt-1">
              Add an email to back up your profile and plan, and pick up where you left off on
              another device.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="you@example.com"
              aria-label="Email address"
              autoComplete="email"
              autoFocus
              className="flex-1 bg-paper-100 border border-sand-200 rounded-lg px-4 py-3 text-sm font-sans outline-none focus:border-forest-700 transition-colors duration-base"
            />
            {error && <p className="text-sm text-signal-avoid font-sans">{error}</p>}
            {!isSupabaseConfigured && (
              <p className="text-xs text-char-400 font-sans italic">
                Sync isn't configured for this build yet.
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 rounded-xs text-white font-semibold font-sans text-base bg-forest-700 hover:bg-forest-800 disabled:opacity-40 transition-colors duration-fast"
            >
              {sending ? 'Sending…' : 'Send code'}
            </button>
            <p className="text-xs text-char-400 font-sans text-center">
              By continuing you agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms of Use</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>
            </p>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}

// ── Delete account / data ─────────────────────────────────────────────────────

function DeleteAccountSheet({ user, onClose }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // null | { ok:false, reason } | { ok:true, mode:'rows-only' }
  const where = user ? 'on this device and in the cloud' : 'on this device';

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const r = await deleteAccount(user);
    setBusy(false);
    if (r.ok && r.mode !== 'rows-only') { window.location.replace('/onboarding'); return; }
    setResult(r);
  };

  const done = result?.ok;
  return (
    <BottomSheet open onClose={done ? () => window.location.replace('/onboarding') : onClose} title={user ? 'Delete account & data' : 'Delete my data'}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-sans text-char-700">
            Your data was removed. We couldn&apos;t remove your sign-in record automatically; it will be removed on request.{' '}
            <a className="underline" href={buildSupportMailto()}>Email support</a> to finish.
          </p>
          <button onClick={() => window.location.replace('/onboarding')} className="w-full py-3 rounded-full bg-char-900 text-white text-sm font-semibold font-sans">Continue</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-sans text-char-700">
            This permanently deletes your profile, health conditions, allergies, medications, saved recipes and meal plans {where}. This can&apos;t be undone.
          </p>
          {result && (
            <p role="alert" className="text-sm font-sans text-avoid-700">
              {result.reason === 'offline' ? "You're offline." : "Something went wrong."} Nothing was deleted. Check your connection and try again.
            </p>
          )}
          <button onClick={confirm} disabled={busy} className="w-full py-3 rounded-full bg-avoid-700 text-white text-sm font-semibold font-sans disabled:opacity-40">
            {busy ? 'Deleting…' : result ? 'Retry' : user ? 'Delete account & data' : 'Delete my data'}
          </button>
          <button onClick={onClose} disabled={busy} className="w-full py-3 rounded-full border border-sand-200 text-char-900 text-sm font-semibold font-sans disabled:opacity-40">Cancel</button>
        </div>
      )}
    </BottomSheet>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // Display names for profile.conditions (healthConditionID[]), resolved via
  // the cached conditions dictionary.
  const [conditionNames, setConditionNames] = useState([]);
  // null | 'medications' | 'calorieTarget' | 'backup' | 'whatsNew'
  const [sheet, setSheet] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  // News/alerts channel (src/api/messages.js, REMEDI_MASTER_PLAN.md §4.7).
  // Fetched once on mount — messages.js's own cache.js layer already TTLs
  // this at 15 min, so no extra caching is added here. Drives both the
  // "What's new" sheet's contents and its unread dot.
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let alive = true;
    getProfile()
      .then((p) => { if (alive) setProfile(p ?? EMPTY_PROFILE); })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    getActiveMessages()
      .then((active) => { if (alive) setMessages(active); })
      .catch(() => { if (alive) setMessages([]); });
    return () => { alive = false; };
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

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      /* signOut() only throws on the unconfigured guard, which can't be
         reached from here since a signed-in user implies Supabase is
         configured — swallow defensively rather than surface a dead-end
         error the user can't act on. */
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-paper-100">
        <div
          className="w-8 h-8 rounded-full border-2 border-sand-200 animate-spin"
          style={{ borderTopColor: '#4F7118' }}
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-paper-100 px-4 pt-10">
        <DataState
          status={navigator.onLine === false ? 'offline-no-cache' : 'error-api'}
          screenName="profile"
          onRetry={() => { setLoading(true); setLoadError(false); setReloadKey((k) => k + 1); }}
        >
          {null}
        </DataState>
      </div>
    );
  }

  const displayName = profile?.firstName?.trim() || user?.email?.split('@')[0] || 'Your profile';

  return (
    // Fills at least one viewport and may scroll if the carousel's 3:4 cards run
    // taller. `min-h-screen` keeps the paper-100 bg reaching the bottom; `-mb-28`
    // cancels the AppShell main's pb-28 navbar reserve so no base cream peeks
    // through (mirrors HomeScreen / the appshell-cream-fix pattern).
    <div className="min-h-screen -mb-28 bg-forest-300 flex flex-col">

      {/* ── 1. Header zone ─────────────────────────────────────────────────── */}
      <div className="bg-forest-300 px-5 pt-10 pb-6">
        {/* Page label row */}
        <p className="font-label text-xs tracking-widest uppercase text-blue-950/60">Edit profile</p>

        {/* Display name — same size as HomeScreen's "Hi there, [name]" greeting */}
        <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
          {displayName}
        </h1>

        {/* Active conditions — single horizontal scrollable line */}
        {profile?.conditions?.length > 0 && (
          <div className="flex flex-nowrap gap-2 mt-3 overflow-x-auto">
            {profile.conditions.map((id, i) => (
              <ConditionTag
                key={id}
                condition={conditionNames[i] ?? `Condition ${id}`}
                solid
                truncate
                className="shrink-0 max-w-[220px]"
              />
            ))}
          </div>
        )}

        {saving && (
          <span className="text-xs text-char-400 font-sans flex items-center gap-1.5 mt-2">
            <span className="animate-spin inline-flex">
              <Icon name="refresh-cw" size={13} aria-hidden="true" />
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
            <SubEditRow icon="scale" label="Daily calorie target" onClick={() => setSheet('calorieTarget')} />
            <SubEditRow icon="pill" label="Medications" onClick={() => setSheet('medications')} />
            <SubEditRow
              icon="bell"
              label="What's new"
              onClick={() => setSheet('whatsNew')}
              dot={messages.length > 0}
            />
          </div>

          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-1">
              About
            </p>
            <SubEditRow icon="info" label="Important notes" onClick={() => navigate('/app/profile/important-notes')} />
            <a
              href={buildSupportMailto()}
              className="w-full flex items-center gap-3 py-4 text-left border-b border-sand-200 last:border-b-0 transition-opacity duration-fast hover:opacity-80"
            >
              <span className="text-char-500"><Icon name="mail" size={20} aria-hidden="true" /></span>
              <span className="flex-1 text-sm font-medium font-sans text-char-900">Help &amp; feedback</span>
              <span className="text-char-400"><Icon name="chevron-right" size={18} aria-hidden="true" /></span>
            </a>
          </div>

          {/* Section 2.5 — Remedi Plus. Scaffolding-only entry point (Task
              T5C, master plan §6.2): everything in the app is unlocked
              today, so this just opens the placeholder paywall screen —
              never auto-triggered, never an interstitial. */}
          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-1">
              Upgrade
            </p>
            <SubEditRow icon="award" label="Personal Remedies Plus" onClick={() => navigate('/app/upgrade')} />
          </div>

          {/* Section 3 — Account. Auth stays entirely optional (master plan
              §4.3-4.5): signed-out shows a "Back up & sync" row that opens
              the email + OTP flow; signed-in shows the account email + sign
              out. Nothing here ever blocks using the app. */}
          <div>
            <p className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-1">
              Account
            </p>
            {user ? (
              <div className="flex items-center justify-between gap-3 py-4">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-char-500">
                    <Icon name="mail" size={20} aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-sm font-medium font-sans text-char-900 truncate">
                    {user.email}
                  </span>
                </span>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="text-xs font-semibold font-sans text-char-500 hover:text-avoid-600 disabled:opacity-40 transition-colors duration-fast flex-shrink-0"
                  style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            ) : (
              <SubEditRow icon="shield" label="Back up & sync" onClick={() => setSheet('backup')} />
            )}
            <button
              onClick={() => setSheet('delete')}
              className="w-full flex items-center gap-3 py-4 text-left transition-opacity duration-fast hover:opacity-80"
              style={{ minHeight: 44 }}
            >
              <span className="text-avoid-700"><Icon name="trash-2" size={20} aria-hidden="true" /></span>
              <span className="flex-1 text-sm font-medium font-sans text-avoid-700">{user ? 'Delete account & data' : 'Delete my data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-edit sheets (BottomSheet) ─────────────────────────────────── */}
      {sheet === 'calorieTarget' && (
        <EditCalorieTarget
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
      {sheet === 'delete' && <DeleteAccountSheet user={user} onClose={() => setSheet(null)} />}
      {sheet === 'backup' && <BackupSheet onClose={() => setSheet(null)} />}
      {sheet === 'whatsNew' && (
        <WhatsNewSheet
          messages={messages}
          onDismiss={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
