import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import SwipeDeck from './SwipeDeck.jsx';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import Icon from '../../components/shared/Icon.jsx';
import { conditions as allConditions } from '../../data/conditions.js';
import { popularConditions } from '../../api/mockData.js';

const DEMO_PROFILE = {
  conditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'],
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
  { value: 'halal', label: 'Halal', icon: 'shield' },
  { value: 'kosher', label: 'Kosher', icon: 'shield' },
  { value: 'gluten-free', label: 'Gluten-Free', icon: 'zap' },
  { value: 'dairy-free', label: 'Dairy-Free', icon: 'cloud' },
  { value: 'low-sodium', label: 'Low Sodium', icon: 'activity' },
];

function SettingsRow({ icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-4 text-left border-b border-sand-200 last:border-b-0 hover:bg-paper-100 transition-colors duration-fast"
      style={{ minHeight: 56 }}
    >
      <span className="text-char-500">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-sans font-medium text-char-900">{label}</span>
        {value && (
          <span className="block text-xs font-sans text-char-400 truncate mt-0.5">{value}</span>
        )}
      </div>
      <span className="text-char-400">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  );
}

function SectionCard({ title, onEdit, children }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold font-sans text-char-900">{title}</span>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-semibold font-sans text-forest-700 hover:text-forest-800 transition-colors duration-fast"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <Icon name="edit" size={16} />
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return <p className="text-sm text-char-400 font-sans italic">{text}</p>;
}

function TagList({ items, bgColor = '#1E4736' }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="px-3 py-1 rounded-pill text-xs font-medium font-sans text-white"
          style={{ backgroundColor: bgColor }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── edit sheets ─────────────────────────────────────────────────────────────

function EditConditions({ value, onChange, onClose }) {
  const [selected, setSelected] = useState([...value]);
  const [query, setQuery] = useState('');
  const MAX = 3;

  const filtered = useMemo(() => {
    if (!query.trim()) return popularConditions;
    const q = query.toLowerCase();
    return allConditions.filter((c) => c.toLowerCase().includes(q)).slice(0, 20);
  }, [query]);

  const toggle = (c) => {
    if (selected.includes(c)) setSelected(selected.filter((x) => x !== c));
    else if (selected.length < MAX) setSelected([...selected, c]);
  };

  const atMax = selected.length >= MAX;

  return (
    <BottomSheet open onClose={onClose} title="Edit conditions">
      <div className="flex flex-col gap-3" style={{ minHeight: 420 }}>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((c) => (
              <button
                key={c}
                onClick={() => toggle(c)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-medium font-sans text-white bg-forest-700 hover:bg-forest-800 transition-colors duration-fast"
              >
                {c}
                <span className="opacity-70">
                  <Icon name="x" size={14} />
                </span>
              </button>
            ))}
          </div>
        )}
        {atMax && (
          <p className="text-xs font-medium font-sans text-signal-limit">
            Max {MAX} -- remove one to add another.
          </p>
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conditions..."
          className="w-full bg-paper-100 border border-sand-200 rounded-lg px-4 py-3 text-sm font-sans outline-none focus:border-forest-700 transition-colors duration-base"
        />
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 220 }}>
          {!query && (
            <p className="font-label text-xs uppercase tracking-[0.14em] text-char-400">
              Common
            </p>
          )}
          {filtered.map((c) => {
            const isSel = selected.includes(c);
            const isDisabled = atMax && !isSel;
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium font-sans border transition-all duration-fast
                  ${isSel
                    ? 'bg-forest-700 text-white border-forest-700'
                    : isDisabled
                    ? 'bg-white text-char-400 border-sand-200 opacity-50 cursor-not-allowed'
                    : 'bg-white text-char-900 border-sand-200 hover:border-forest-500'
                  }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { onChange(selected); onClose(); }}
          className="w-full py-4 rounded-xs text-white font-semibold font-sans text-base mt-auto bg-forest-700 hover:bg-forest-800 transition-colors duration-fast"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

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
                className="text-xs font-semibold font-sans text-char-500 hover:text-signal-avoid transition-colors duration-fast"
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
                  ${isSel
                    ? 'border-forest-700 bg-forest-50'
                    : 'border-sand-200 bg-white hover:border-forest-300'
                  }`}
              >
                <span style={{ color: isSel ? '#1E4736' : '#8A8377' }}>
                  <Icon name={icon} size={22} />
                </span>
                <span
                  className={`text-sm font-semibold font-sans ${isSel ? 'text-forest-700' : 'text-char-900'}`}
                >
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

function TasteSwipeSheet({ onClose, onDone }) {
  const [foods, setFoods] = useState(null);

  useEffect(() => {
    api.getSwipeDeck().then(setFoods);
  }, []);

  return (
    <BottomSheet open onClose={onClose} title="Taste calibration">
      <div className="pb-4">
        <p className="text-sm text-char-500 font-sans mb-5">Swipe right to like, left to skip. Updates your food recommendations.</p>
        {!foods ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-sand-200 animate-spin" style={{ borderTopColor: '#1E4736' }} />
          </div>
        ) : (
          <SwipeDeck
            foods={foods}
            onComplete={(likes, dislikes) => { onDone(likes, dislikes); onClose(); }}
            onSkip={onClose}
          />
        )}
      </div>
    </BottomSheet>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p ?? DEMO_PROFILE);
      setLoading(false);
    });
  }, []);

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
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-sand-200 animate-spin" style={{ borderTopColor: '#1E4736' }} />
      </div>
    );
  }

  const initials = user?.email ? user.email[0].toUpperCase() : 'P';
  const memberSince = new Date().getFullYear();

  const dietaryLabels = (profile.dietary ?? []).map(
    (v) => DIETARY_OPTIONS.find((o) => o.value === v)?.label ?? v,
  );

  return (
    <div className="min-h-screen bg-paper-200 px-5 pt-6 pb-24">
      {/* Avatar + heading */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold font-sans flex-shrink-0 bg-forest-700">
          {initials}
        </div>
        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold text-blue-950">Profile</h1>
          {user?.email && <p className="text-sm text-char-500 font-sans">{user.email}</p>}
          <p className="font-mono text-xs text-char-400 mt-0.5">Member since {memberSince}</p>
        </div>
        {saving && (
          <span className="text-xs text-char-400 font-sans flex items-center gap-1.5">
            <span className="animate-spin inline-flex"><Icon name="refresh-cw" size={14} /></span>
            Saving
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Conditions */}
        <SectionCard title="Your conditions" onEdit={() => setSheet('conditions')}>
          {profile.conditions?.length ? (
            <div className="flex flex-wrap gap-2">
              {profile.conditions.map((c) => (
                <ConditionTag key={c} condition={c} solid />
              ))}
            </div>
          ) : (
            <EmptyNote text="No conditions added" />
          )}
        </SectionCard>

        {/* Medications */}
        <SectionCard title="Medications" onEdit={() => setSheet('medications')}>
          {profile.medications?.length ? (
            <div className="flex flex-col gap-1.5">
              {profile.medications.map((m) => (
                <div key={m} className="flex items-center gap-3">
                  <span className="text-forest-700">
                    <Icon name="pill" size={18} />
                  </span>
                  <span className="text-sm text-char-900 font-sans">{m}</span>
                  <span className="font-mono text-xs text-char-400 ml-auto">daily</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote text="No medications listed" />
          )}
        </SectionCard>

        {/* Allergies */}
        <SectionCard title="Allergies & intolerances" onEdit={() => setSheet('allergies')}>
          {profile.allergies?.length ? (
            <TagList items={profile.allergies} bgColor="#C04A2F" />
          ) : (
            <EmptyNote text="None listed" />
          )}
        </SectionCard>

        {/* Dietary */}
        <SectionCard title="Dietary preferences" onEdit={() => setSheet('dietary')}>
          {dietaryLabels.length ? (
            <TagList items={dietaryLabels} bgColor="#3F6E86" />
          ) : (
            <EmptyNote text="No preferences set" />
          )}
        </SectionCard>

        {/* Settings */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <p className="font-label text-xs uppercase tracking-[0.14em] text-char-400 px-5 pt-4 pb-2">
            Settings
          </p>
          <SettingsRow
            icon="bell"
            label="Notifications"
            value="Daily reminders on"
          />
          <SettingsRow
            icon="refresh-cw"
            label="Health sync"
            value="Connected to Apple Health"
          />
          <SettingsRow
            icon="mail"
            label="Weekly digest"
            value="Every Monday"
          />
        </div>

        {/* Account */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <p className="font-label text-xs uppercase tracking-[0.14em] text-char-400 px-5 pt-4 pb-2">
            Account
          </p>
          {/* Upgrade placeholder */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-sand-200 opacity-50">
            <div className="flex items-center gap-3">
              <span className="text-yellow-400">
                <Icon name="award" size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold font-sans text-char-900">Upgrade to Pro</p>
                <p className="text-xs text-char-400 font-sans">Unlock full meal plans</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-pill text-xs font-semibold font-sans text-white bg-yellow-400">
              Soon
            </span>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-5 text-left hover:bg-paper-100 transition-colors duration-fast"
            style={{ minHeight: 56 }}
          >
            <span className="text-avoid-600">
              <Icon name="external-link" size={22} />
            </span>
            <span className="text-sm font-medium font-sans text-avoid-600">Sign out</span>
          </button>
        </div>

        <p className="text-center text-xs text-char-400 font-sans pb-2">
          Personal Remedies <span className="font-mono">v0.1</span>
        </p>
      </div>

      {/* Edit sheets */}
      {sheet === 'conditions' && (
        <EditConditions
          value={profile.conditions ?? []}
          onChange={(v) => save({ conditions: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'medications' && (
        <EditList
          title="Edit medications"
          value={profile.medications ?? []}
          placeholder="e.g. Metformin 500mg"
          onChange={(v) => save({ medications: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'allergies' && (
        <EditList
          title="Edit allergies & intolerances"
          value={profile.allergies ?? []}
          placeholder="e.g. Shellfish, Peanuts"
          onChange={(v) => save({ allergies: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'dietary' && (
        <EditDietary
          value={profile.dietary ?? []}
          onChange={(v) => save({ dietary: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'taste' && (
        <TasteSwipeSheet
          onClose={() => setSheet(null)}
          onDone={(likes, dislikes) => save({ tasteLikes: likes, tasteDislikes: dislikes })}
        />
      )}
    </div>
  );
}
