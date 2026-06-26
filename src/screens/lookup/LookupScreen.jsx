import { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import SearchInput from '../../components/shared/SearchInput.jsx';
import Card from '../../components/shared/Card.jsx';
import SignalChip from '../../components/shared/SignalChip.jsx';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import StudyReferences from '../../components/shared/StudyReferences.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import Icon from '../../components/shared/Icon.jsx';

const DEMO_PROFILE = {
  conditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'],
  medications: [],
  allergies: [],
  dietary: [],
  tasteLikes: [],
  tasteDislikes: [],
};

function VerdictHeader({ signal }) {
  const config = {
    beneficial: {
      label: 'Beneficial for you',
      bg: 'bg-benefit-100',
      text: 'text-benefit-600',
      iconName: 'check',
    },
    avoid: {
      label: 'Avoid for now',
      bg: 'bg-avoid-100',
      text: 'text-avoid-600',
      iconName: 'x',
    },
    limit: {
      label: 'Limit intake',
      bg: 'bg-caution-100',
      text: 'text-caution-600',
      iconName: 'alert-triangle',
    },
    neutral: {
      label: 'Neutral',
      bg: 'bg-sand-100',
      text: 'text-char-700',
      iconName: 'info',
    },
  };
  const { label, bg, text, iconName } = config[signal] ?? config.neutral;
  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl ${bg}`}>
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          signal === 'beneficial' ? 'bg-benefit-600'
          : signal === 'avoid' ? 'bg-avoid-600'
          : signal === 'limit' ? 'bg-caution-600'
          : 'bg-char-500'
        } text-white`}
      >
        <Icon name={iconName} size={22} />
      </span>
      <p className={`font-display font-semibold text-xl ${text}`}>{label}</p>
    </div>
  );
}

function PerConditionRow({ condition, signal }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-sand-200 last:border-b-0">
      <ConditionTag condition={condition} />
      <SignalChip signal={signal} />
    </div>
  );
}

function FoodDetailBottomSheet({ food, perCondition, profile, onClose }) {
  const [refsByCondition, setRefsByCondition] = useState({});
  const [loadingRefs, setLoadingRefs] = useState({});

  const conditions = profile?.conditions ?? [];
  const relevantPerCondition = perCondition.filter((pc) =>
    conditions.includes(pc.condition),
  );
  const displayPerCondition = relevantPerCondition.length ? relevantPerCondition : perCondition;

  async function loadRefs(condition) {
    if (refsByCondition[condition] !== undefined || loadingRefs[condition]) return;
    setLoadingRefs((p) => ({ ...p, [condition]: true }));
    const refs = await api.getReferences(food.id, condition);
    setRefsByCondition((p) => ({ ...p, [condition]: refs }));
    setLoadingRefs((p) => ({ ...p, [condition]: false }));
  }

  useEffect(() => {
    displayPerCondition.forEach((pc) => loadRefs(pc.condition));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.id]);

  return (
    <BottomSheet open onClose={onClose} title={food.name}>
      {/* Food identity row */}
      <div className="flex gap-4 items-center mb-5">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-sand-100">
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="font-display font-semibold text-blue-950 text-lg leading-tight tracking-tightish">{food.name}</p>
          <p className="text-xs text-char-500 font-sans">{food.category}</p>
          <p className="text-xs text-char-400 font-sans">
            <span className="font-mono">{food.referenceCount}</span>{' '}
            {food.referenceCount === 1 ? 'study' : 'studies'} behind this
          </p>
        </div>
      </div>

      {/* Signal chip */}
      <div className="mb-5">
        <SignalChip signal={food.signal} />
      </div>

      {/* Clinical note */}
      {food.note && (
        <p className="text-sm text-char-500 font-sans leading-relaxed mb-5">{food.note}</p>
      )}

      {/* Nutritional data */}
      {food.nutrients && food.nutrients.length > 0 && (
        <div className="mb-5">
          <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500 mb-3">Per serving</p>
          <div className="grid grid-cols-2 gap-2">
            {food.nutrients.map((n) => (
              <div key={n.label} className="flex items-center justify-between px-3.5 py-2.5 bg-sand-100 rounded-md border border-sand-200">
                <span className="text-xs text-char-500 font-sans">{n.label}</span>
                <span className="font-mono text-sm font-semibold text-char-900">{n.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-condition breakdown */}
      {displayPerCondition.length > 0 && (
        <div>
          <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500 mb-3">
            For your conditions
          </p>
          <div className="flex flex-col gap-3">
            {displayPerCondition.map((pc) => (
              <div key={pc.condition} className="bg-lavender-100 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <ConditionTag condition={pc.condition} />
                  <SignalChip signal={pc.signal} compact />
                </div>
                {pc.reason && (
                  <p className="text-xs text-char-500 font-sans leading-normal mb-2">{pc.reason}</p>
                )}
                <StudyReferences
                  references={refsByCondition[pc.condition]}
                  loading={loadingRefs[pc.condition]}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function KnownResult({ result, profile, onOpenDetail }) {
  const { food, perCondition } = result;
  const conditions = profile?.conditions ?? [];

  const relevantPerCondition = perCondition.filter((pc) =>
    conditions.includes(pc.condition),
  );
  const displayPerCondition = relevantPerCondition.length ? relevantPerCondition : perCondition;

  return (
    <div className="flex flex-col gap-4">
      {/* Food identity card */}
      <Card
        onClick={() => onOpenDetail(food, perCondition)}
        className="flex gap-4 items-center cursor-pointer"
      >
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-sand-100">
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <p className="font-display font-semibold text-blue-950 text-lg leading-tight tracking-tightish">{food.name}</p>
          <p className="text-xs text-char-500 font-sans">{food.category}</p>
          <p className="text-xs text-char-400 font-sans">
            <span className="font-mono">{food.referenceCount}</span>{' '}
            {food.referenceCount === 1 ? 'study' : 'studies'} behind this
          </p>
        </div>
        <span className="flex-shrink-0 text-char-400">
          <Icon name="chevron-right" size={18} />
        </span>
      </Card>

      {/* Verdict */}
      <VerdictHeader signal={food.signal} />

      {/* Per-condition breakdown */}
      {displayPerCondition.length > 0 && (
        <Card>
          <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500 mb-3">
            For your conditions
          </p>
          <div>
            {displayPerCondition.map((pc) => (
              <PerConditionRow key={pc.condition} condition={pc.condition} signal={pc.signal} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function LookupScreen() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [searched, setSearched] = useState(false);
  const [detailFood, setDetailFood] = useState(null);
  const [detailPerCondition, setDetailPerCondition] = useState(null);

  useEffect(() => {
    api.getProfile().then((p) => setProfile(p ?? DEMO_PROFILE));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    try {
      const r = await api.lookupFood(q, profile ?? DEMO_PROFILE);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(val) {
    setQuery(val);
    if (!val.trim()) {
      setResult(null);
      setSearched(false);
    }
  }

  function handleOpenDetail(food, perCondition) {
    setDetailFood(food);
    setDetailPerCondition(perCondition);
  }

  return (
    <div className="flex flex-col min-h-full px-5 pt-6 pb-6 gap-5 bg-paper-200">
      {/* Header */}
      <div>
        <p className="text-[12px] text-char-500 font-label tracking-[0.14em] uppercase">Food lookup</p>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">Check a food</h1>
        <p className="text-sm text-char-500 mt-1 font-sans">
          Is it beneficial or to avoid for your conditions?
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={handleChange}
            placeholder="e.g. salmon, spinach, white bread"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-4 py-3 rounded-xs bg-forest-700 text-white text-sm font-semibold font-sans
            disabled:opacity-40
            transition-all duration-fast ease-ds-out
            hover:bg-forest-800 active:scale-[0.97]"
        >
          {loading ? (
            <span className="animate-spin inline-flex"><Icon name="refresh-cw" size={18} /></span>
          ) : 'Check'}
        </button>
      </form>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-forest-700 border-t-transparent animate-spin" />
            <span className="text-char-500 text-sm font-sans">Looking it up</span>
          </div>
        </div>
      )}

      {!loading && result && result.known && (
        <KnownResult result={result} profile={profile} onOpenDetail={handleOpenDetail} />
      )}

      {!loading && result && !result.known && (
        <EmptyState
          icon="search_off"
          title="We don't have data on this one yet"
          body={`We couldn't find "${result.query}" in our knowledgebase. Try a simpler ingredient name, or check back as we expand our database.`}
        />
      )}

      {!loading && !searched && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500">Try searching</p>
          <div className="flex flex-wrap gap-2">
            {['Salmon', 'Spinach', 'Blueberries', 'Lentils', 'Pork rinds'].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); }}
                className="px-3 py-1.5 rounded-pill border border-sand-200 bg-white text-sm text-char-900 font-sans
                  transition-all duration-fast ease-ds-out
                  hover:border-forest-300 hover:bg-forest-50
                  active:bg-sand-100"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Food detail bottom sheet */}
      {detailFood && (
        <FoodDetailBottomSheet
          food={detailFood}
          perCondition={detailPerCondition}
          profile={profile}
          onClose={() => { setDetailFood(null); setDetailPerCondition(null); }}
        />
      )}
    </div>
  );
}
