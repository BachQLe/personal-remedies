import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { conditions as allConditions } from '../../data/conditions';
import { conditionSynonyms } from '../../data/conditionSynonyms';
import { popularConditions, commonAllergies } from '../../api/mockData';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

const MAX_ITEMS = 6;

const ALLERGY_ICONS = {
  'Tree Nuts': 'forest',
  Peanuts: 'spa',
  Shellfish: 'set_meal',
  Fish: 'phishing',
  Dairy: 'water_drop',
  Eggs: 'egg_alt',
  'Wheat / Gluten': 'grain',
  Soy: 'grass',
  Sesame: 'filter_vintage',
  Corn: 'energy_savings_leaf',
  Mustard: 'local_florist',
  Celery: 'park',
  Lupin: 'yard',
  Mollusks: 'pool',
  Sulfites: 'science',
  Nightshades: 'nightlight',
  'Latex (cross-reactive foods)': 'warning',
  Coconut: 'beach_access',
  Fructose: 'nutrition',
};

const ALL_ALLERGIES = [
  ...commonAllergies,
  'Corn',
  'Mustard',
  'Celery',
  'Lupin',
  'Mollusks',
  'Sulfites',
  'Nightshades',
  'Latex (cross-reactive foods)',
  'Coconut',
  'Fructose',
];

const CONDITION_ICONS = {
  'Type 2 Diabetes': 'bloodtype',
  'Hypertension (high blood pressure)': 'cardiology',
  'High cholesterol': 'monitor_heart',
  'Hypothyroidism': 'endocrinology',
  'Chronic kidney disease (CKD)': 'nephrology',
  'Asthma': 'pulmonology',
  'Depression': 'psychology',
  'Osteoarthritis': 'rheumatology',
  'Heart failure': 'ecg_heart',
  'Irritable bowel syndrome (IBS)': 'gastroenterology',
};

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', icon: 'restaurant' },
  { value: 'pescatarian', label: 'Pescatarian', icon: 'set_meal' },
  { value: 'vegetarian', label: 'Vegetarian', icon: 'nutrition' },
  { value: 'vegan', label: 'Vegan', icon: 'eco' },
  { value: 'halal', label: 'Halal', icon: 'mosque' },
  { value: 'kosher', label: 'Kosher', icon: 'synagogue' },
];

function resolveQuery(query) {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const synonym = Object.keys(conditionSynonyms).find(
    (key) => q === key || q.startsWith(key) || key.startsWith(q),
  );
  return synonym ? conditionSynonyms[synonym] : null;
}

function Eyebrow({ children }) {
  return (
    <p className="text-[12px] uppercase tracking-eyebrow font-sans" style={{ color: '#6B645A' }}>
      {children}
    </p>
  );
}

function SectionHeader({ icon, title, subtitle, accent }) {
  if (accent) {
    return (
      <div className="pt-2 pb-4 px-px mb-1 mt-24">
        <div className="relative flex flex-col items-center text-center gap-2">
          <h3 className="font-semibold tracking-normal leading-tight text-[32px] max-w-[10em] text-blue-950" style={{ fontFamily: 'Chillax, sans-serif' }}>
            {title}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="material-symbols-rounded text-[24px] mt-0.5" style={{ color: '#8A8377' }}>
        {icon}
      </span>
      <div>
        <h3 className="font-semibold tracking-tightish leading-tight text-lg" style={{ color: '#211E1B', fontFamily: 'Chillax, sans-serif' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[13px] mt-1 font-sans leading-relaxed" style={{ color: '#6B645A' }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SelectedChip({ label, icon, onRemove }) {
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) setIsOverflowing(el.scrollWidth > el.clientWidth);
  }, [label]);

  return (
    <motion.button
      layout
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={chipSpring}
      onClick={onRemove}
      className="flex items-center gap-1.5 px-2.5 py-[7px] rounded-pill text-[15px] font-semibold tracking-wide text-white min-h-[32px] font-sans shadow-md max-w-full overflow-hidden"
      style={{ backgroundColor: '#6B4C9A' }}
    >
      {icon && (
        <span className="material-symbols-rounded text-[16px] text-white/80 flex-shrink-0">{icon}</span>
      )}
      <span
        ref={textRef}
        className="whitespace-nowrap overflow-hidden min-w-0"
        style={isOverflowing ? { maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent)' } : undefined}
      >
        {label}
      </span>
      <span className="material-symbols-rounded text-[16px] text-white/70 flex-shrink-0">close</span>
    </motion.button>
  );
}

function StepBar({ current, total }) {
  return (
    <div className="flex items-center gap-2 w-full max-w-[280px]">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[18px] rounded-full border-4 border-sand-400 bg-transparent overflow-hidden">
          <motion.div
            className="h-full bg-forest-700 rounded-full origin-left"
            initial={false}
            animate={{ scaleX: i <= current ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      ))}
    </div>
  );
}

const COLLAPSED_COUNT = 4;
const TOTAL_STEPS = 4;
const STEP_BAR_COUNT = 3;
const SWIPE_THRESHOLD = 50;


export default function ProfileBuilder({ profile, onChange, onSubmit, saving, onBack }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [conditionQuery, setConditionQuery] = useState('');
  const [allergyQuery, setAllergyQuery] = useState('');
  const [showAllConditions, setShowAllConditions] = useState(false);
  const [showAllAllergies, setShowAllAllergies] = useState(false);

  const {
    conditions,
    allergies,
    dietaryPattern,
    religiousRestriction,
  } = profile;

  const usedCount =
    conditions.length +
    allergies.length +
    (religiousRestriction !== 'none' ? 1 : 0);


  const update = (key, val) => onChange({ ...profile, [key]: val });

  const toggleInList = (key, value) => {
    const list = profile[key];
    const isSelected = list.includes(value);
    if (isSelected) {
      update(key, list.filter((v) => v !== value));
    } else {
      update(key, [...list, value]);
    }
  };

  const setReligious = (value) => {
    if (value === 'none') {
      update('religiousRestriction', 'none');
      return;
    }
    if (value === religiousRestriction) {
      update('religiousRestriction', 'none');
      return;
    }
    update('religiousRestriction', value);
  };

  const { conditionResults, synonymMatch } = useMemo(() => {
    if (!conditionQuery.trim())
      return { conditionResults: popularConditions, synonymMatch: null };

    const q = conditionQuery.toLowerCase().trim();
    const resolved = resolveQuery(conditionQuery);
    const direct = allConditions.filter((c) => c.toLowerCase().includes(q));
    if (resolved && !direct.some((m) => m === resolved)) direct.unshift(resolved);

    return { conditionResults: direct.slice(0, 20), synonymMatch: resolved };
  }, [conditionQuery]);

  const allergyResults = allergyQuery.trim()
    ? ALL_ALLERGIES.filter((a) =>
      a.toLowerCase().includes(allergyQuery.toLowerCase().trim()),
    )
    : [];

  const addCustomAllergy = () => {
    const val = allergyQuery.trim();
    if (val && !allergies.includes(val)) {
      update('allergies', [...allergies, val]);
    }
    setAllergyQuery('');
  };

  const customAllergies = allergies.filter((a) => !commonAllergies.includes(a));

  const slideVariants = {
    enter: { y: -30, opacity: 0, filter: 'blur(8px)' },
    center: { y: 0, opacity: 1, filter: 'blur(0px)' },
    exit: { y: 10, opacity: 0, filter: 'blur(4px)' },
  };

  const navigate = (step) => {
    setCurrentStep(step);
  };

  const handleSwipeDragEnd = (_, info) => {
    if (info.offset.y < -SWIPE_THRESHOLD && currentStep < TOTAL_STEPS - 1) {
      navigate(currentStep + 1);
    } else if (info.offset.y > SWIPE_THRESHOLD && currentStep > 0) {
      navigate(currentStep - 1);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* ── Sticky header: title + counter + dots ──────────────────────────── */}
      {/* Slides down from the top edge as the welcome purple "opens up". */}
      <motion.div
        initial={{ y: '-100%', filter: 'blur(6px) drop-shadow(0 8px 10px rgba(0,0,0,0.15))' }}
        animate={{ y: 0, filter: 'blur(0px) drop-shadow(0 8px 10px rgba(0,0,0,0.15))' }}
        transition={{
          duration: 0.9,
          ease: [0.22, 1, 0.36, 1],
          filter: { duration: 0.3, ease: 'easeOut' },
        }}
        className="flex-none px-6 pt-14 pb-4 relative z-10 bg-paper-200 overflow-visible"
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={() => currentStep > 0 ? navigate(currentStep - 1) : onBack?.()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-sand-200 text-char-900 shadow-xs transition-colors duration-fast hover:bg-sand-100 flex-shrink-0"
              aria-label="Go back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
                <path d="M11 8.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
                <path d="M11 15.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
              </svg>
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold tracking-tight text-[16px] text-char-900 leading-tight" style={{ fontFamily: 'Quantico, sans-serif' }}>
                Build your profile
              </h2>
              <motion.span
                key={usedCount}
                initial={{ scale: 1 }}
                animate={{
                  y: [0, -8, 0, -3, 0],
                  scale: [1, 1.15, 1, 1.05, 1],
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-pill border shadow-sm bg-white text-char-700 border-sand-200"
                style={{ fontFamily: 'Quantico, sans-serif' }}
                aria-live="polite"
              >
                {usedCount > 0 && (
                  <span className="material-symbols-rounded text-[14px]">
                    {usedCount > MAX_ITEMS ? 'error' : 'check_circle'}
                  </span>
                )}
                {usedCount} of {MAX_ITEMS} traits
              </motion.span>
            </div>
            <div className="mt-3">
              <StepBar current={currentStep} total={STEP_BAR_COUNT} />
            </div>
          </div>
        </div>
        <div
          className="absolute -bottom-[40px] right-0 w-[40px] h-[40px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at bottom left, transparent 40px, #F5F5F0 40px)' }}
        />
      </motion.div>

      {/* ── Swipeable form area ────────────────────────────────────────────── */}
      <div
        className="flex-1 relative overflow-hidden hide-scrollbar"
        style={{ backgroundColor: '#C8A8E8' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleSwipeDragEnd}
            className="absolute inset-0 overflow-y-auto px-8 pt-1 pb-6 hide-scrollbar"
          >
            {currentStep === 0 && (
              <ConditionsPanel
                conditions={conditions}
                conditionQuery={conditionQuery}
                setConditionQuery={setConditionQuery}
                conditionResults={conditionResults}
                synonymMatch={synonymMatch}
                showAllConditions={showAllConditions}
                setShowAllConditions={setShowAllConditions}
                toggleInList={toggleInList}
              />
            )}
            {currentStep === 1 && (
              <AllergiesPanel
                allergies={allergies}
                allergyQuery={allergyQuery}
                setAllergyQuery={setAllergyQuery}
                allergyResults={allergyResults}
                showAllAllergies={showAllAllergies}
                setShowAllAllergies={setShowAllAllergies}
                toggleInList={toggleInList}
                addCustomAllergy={addCustomAllergy}
                customAllergies={customAllergies}
              />
            )}
            {currentStep === 2 && (
              <DietaryPanel
                dietaryPattern={dietaryPattern}
                religiousRestriction={religiousRestriction}
                update={update}
                setReligious={setReligious}
              />
            )}
            {currentStep === 3 && (
              <OverviewPanel
                conditions={conditions}
                allergies={allergies}
                religiousRestriction={religiousRestriction}
                dietaryPattern={dietaryPattern}
                usedCount={usedCount}
                toggleInList={toggleInList}
                setReligious={setReligious}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      {/* Slides up from the bottom edge as the welcome purple "opens up". */}
      <motion.div
        initial={{ y: '100%', filter: 'blur(6px)' }}
        animate={{ y: 0, filter: 'blur(0px)' }}
        transition={{
          duration: 0.9,
          ease: [0.22, 1, 0.36, 1],
          filter: { duration: 0.3, ease: 'easeOut' },
        }}
        className="flex-none px-6 pt-3 pb-6 bg-paper-200 rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => currentStep > 0 ? navigate(currentStep - 1) : onBack?.()}
            className="flex-1 text-sm font-medium text-char-500 hover:text-char-700 transition-colors duration-fast font-sans bg-transparent border-none cursor-pointer py-4 min-h-[48px] flex items-center justify-center gap-1"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
              <path d="M11 8.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
              <path d="M11 15.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
            </svg>
            Back
          </button>
          {currentStep < TOTAL_STEPS - 1 ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={chipSpring}
              onClick={() => navigate(currentStep + 1)}
              className="relative flex-[2] py-4 rounded-sm text-white font-semibold text-base bg-forest-600 hover:bg-forest-700 transition-all duration-fast min-h-[52px] font-sans flex items-center justify-center gap-2 overflow-hidden shadow-lg hover:shadow-xl"
            >
              <span className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white" />
              {currentStep === TOTAL_STEPS - 2 ? 'Overview' : 'Next'}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={chipSpring}
              onClick={onSubmit}
              disabled={conditions.length === 0 || saving || usedCount > MAX_ITEMS}
              className="relative flex-[2] py-4 rounded-sm text-white font-semibold text-base bg-forest-600 hover:bg-forest-700 transition-all duration-fast disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px] font-sans flex items-center justify-center gap-2 overflow-hidden shadow-lg hover:shadow-xl"
            >
              <span className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white" />
              {saving ? (
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                'Show my top foods!'
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}


function ConditionChip({ label, icon, disabled, onClick }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={chipSpring}
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.25 rounded-pill text-[14px] font-semibold tracking-wide border transition-colors duration-fast min-h-[30px] font-sans flex items-center gap-1.5 ${disabled
        ? 'bg-white text-char-300 border-sand-200 opacity-50 cursor-not-allowed'
        : 'bg-white text-char-900 border-sand-200 hover:border-[#9B7DC8] shadow-sm hover:shadow-md'
        }`}
    >
      {icon && (
        <span className="material-symbols-rounded text-[16px] text-char-400">{icon}</span>
      )}
      {label}
    </motion.button>
  );
}

function ConditionsPanel({
  conditions,
  conditionQuery,
  setConditionQuery,
  conditionResults,
  synonymMatch,
  showAllConditions,
  setShowAllConditions,
  toggleInList,
}) {
  const availableResults = conditionResults.filter((c) => !conditions.includes(c));
  const collapsedItems = conditionQuery ? availableResults : availableResults.slice(0, COLLAPSED_COUNT);
  const expandedItems = conditionQuery ? [] : availableResults.slice(COLLAPSED_COUNT);

  const scrollRef = useRef(null);
  const [scrollState, setScrollState] = useState({ atTop: true, atBottom: true });

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      atTop: el.scrollTop <= 4,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
    });
  };

  useEffect(() => { handleScroll(); }, [conditions, conditionQuery, showAllConditions]);

  return (
    <section className="flex flex-col h-full overflow-hidden items-center">
      <div className="flex-none w-[85%]">
        <SectionHeader
          icon="ecg_heart"
          title="What condition matters most to you?"
          accent
        />

        <div className="relative mb-4">
          <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-char-400 text-[20px]">
            search
          </span>
          <input
            type="text"
            value={conditionQuery}
            onChange={(e) => setConditionQuery(e.target.value)}
            placeholder='Search conditions'
            className="w-full bg-white border-2 border-sand-200 rounded-md pl-11 pr-4 py-5 text-[17px] font-medium tracking-wide text-char-900 placeholder:text-char-400 placeholder:font-medium outline-none focus:border-[#7C5CAD] transition-all duration-fast font-sans min-h-[44px] shadow-sm"
          />
        </div>

      </div>

      <div className="relative flex-1 min-h-0 w-[85%]">
        <AnimatePresence>
          {!scrollState.atTop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -top-2 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, rgba(200,168,232,0.5), transparent)' }}
            />
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto py-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.15) transparent', marginRight: '-10px' }}
        >
          <LayoutGroup>
            <AnimatePresence>
              {conditions.length > 0 && (
                <motion.div
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="flex flex-wrap gap-2 mb-4 mr-1 overflow-hidden"
                >
                  {conditions.map((c) => (
                    <SelectedChip
                      key={c}
                      label={c}
                      icon={CONDITION_ICONS[c]}
                      onRemove={() => toggleInList('conditions', c)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>

          {synonymMatch && conditionQuery.trim() && (
            <p className="text-[13px] mb-2 font-sans font-semibold tracking-wide mr-1" style={{ color: '#6B4C9A' }}>
              Showing results for "{synonymMatch}"
            </p>
          )}

          {!conditionQuery && (
            <div>
              <Eyebrow>Common conditions</Eyebrow>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-3 mr-1">
            {collapsedItems.map((c) => (
              <ConditionChip
                key={c}
                label={c}
                icon={CONDITION_ICONS[c]}
                disabled={false}
                onClick={() => toggleInList('conditions', c)}
              />
            ))}
            {!conditionQuery && !showAllConditions && expandedItems.length > 0 && (
              <button
                onClick={() => setShowAllConditions(true)}
                className="px-2.5 py-1.25 rounded-pill text-[14px] font-semibold tracking-wide border border-dashed border-sand-300 hover:border-[#9B7DC8] hover:text-[#7C5CAD] transition-colors duration-fast min-h-[30px] font-sans flex items-center gap-1.5"
                style={{ color: '#6B645A' }}
              >
                +{expandedItems.length} more
                <span className="material-symbols-rounded text-[16px]">expand_more</span>
              </button>
            )}
          </div>

          <AnimatePresence>
            {!conditionQuery && showAllConditions && expandedItems.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2.5 mt-2.5 mr-1">
                  {expandedItems.map((c, i) => (
                    <motion.div
                      key={c}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
                    >
                      <ConditionChip
                        label={c}
                        icon={CONDITION_ICONS[c]}
                        disabled={false}
                        onClick={() => toggleInList('conditions', c)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {conditionQuery && conditionResults.length === 0 && (
            <p className="text-[15px] text-center py-8 font-sans font-medium tracking-wide w-full" style={{ color: '#6B645A' }}>
              No conditions found for "{conditionQuery}"
            </p>
          )}
        </div>

        <AnimatePresence>
          {!scrollState.atBottom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -bottom-2 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(200,168,232,0.5), transparent)' }}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}


function AllergyChip({ label, icon, disabled, onClick }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={chipSpring}
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.25 rounded-pill text-[14px] font-semibold tracking-wide border transition-colors duration-fast min-h-[30px] font-sans flex items-center gap-1.5 ${disabled
        ? 'bg-white text-char-300 border-sand-200 opacity-50 cursor-not-allowed'
        : 'bg-white text-char-900 border-sand-200 hover:border-[#9B7DC8] shadow-sm hover:shadow-md'
        }`}
    >
      {icon && (
        <span className="material-symbols-rounded text-[16px] text-char-400">{icon}</span>
      )}
      {label}
    </motion.button>
  );
}

function AllergiesPanel({
  allergies,
  allergyQuery,
  setAllergyQuery,
  allergyResults,
  showAllAllergies,
  setShowAllAllergies,
  toggleInList,
  addCustomAllergy,
  customAllergies,
}) {
  const availableAllergies = commonAllergies.filter((a) => !allergies.includes(a));
  const collapsedItems = availableAllergies.slice(0, COLLAPSED_COUNT);
  const expandedItems = availableAllergies.slice(COLLAPSED_COUNT);

  const scrollRef = useRef(null);
  const [scrollState, setScrollState] = useState({ atTop: true, atBottom: true });

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      atTop: el.scrollTop <= 4,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
    });
  };

  useEffect(() => { handleScroll(); }, [allergies, allergyQuery, showAllAllergies, customAllergies.length]);

  return (
    <section className="flex flex-col h-full overflow-hidden items-center">
      <div className="flex-none w-[85%]">
        <SectionHeader
          icon="warning"
          title="Allergies & intolerances"
          accent
        />

        <div className="relative mb-4">
          <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-char-400 text-[20px]">
            search
          </span>
          <input
            type="text"
            value={allergyQuery}
            onChange={(e) => setAllergyQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (allergyResults.length > 0) {
                  toggleInList('allergies', allergyResults[0]);
                  setAllergyQuery('');
                } else {
                  addCustomAllergy();
                }
              }
            }}
            placeholder="Search allergies..."
            className="w-full bg-white border-2 border-sand-200 rounded-md pl-11 pr-4 py-5 text-[17px] font-medium tracking-wide text-char-900 placeholder:text-char-400 placeholder:font-medium outline-none focus:border-[#7C5CAD] transition-all duration-fast font-sans min-h-[44px] shadow-sm"
          />
        </div>

      </div>

      <div className="relative flex-1 min-h-0 w-[85%]">
        <AnimatePresence>
          {!scrollState.atTop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -top-2 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, rgba(200,168,232,0.5), transparent)' }}
            />
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto py-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.15) transparent', marginRight: '-10px' }}
        >
          <LayoutGroup>
            <AnimatePresence>
              {allergies.length > 0 && (
                <motion.div
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="flex flex-wrap gap-2 mb-4 mr-1 overflow-hidden"
                >
                  {allergies.map((a) => (
                    <SelectedChip
                      key={a}
                      label={a}
                      icon={ALLERGY_ICONS[a]}
                      onRemove={() => toggleInList('allergies', a)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>

          {allergyQuery.trim() && (
            <div className="mb-4 space-y-2 mr-1">
              {allergyResults.map((a) => {
                const isSelected = allergies.includes(a);
                return (
                  <motion.button
                    key={a}
                    whileTap={{ scale: 0.98 }}
                    transition={chipSpring}
                    onClick={() => {
                      toggleInList('allergies', a);
                      if (!isSelected) setAllergyQuery('');
                    }}
                    className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-all duration-fast border min-h-[44px] font-sans flex items-center gap-2.5 ${isSelected
                      ? 'text-white border-transparent shadow-md'
                      : 'bg-white text-char-900 border-sand-200 hover:border-[#9B7DC8] shadow-sm hover:shadow-md'
                      }`}
                    style={isSelected ? { backgroundColor: '#6B4C9A' } : undefined}
                  >
                    {ALLERGY_ICONS[a] && (
                      <span
                        className={`material-symbols-rounded text-[18px] ${isSelected ? 'text-white/80' : 'text-char-400'
                          }`}
                      >
                        {ALLERGY_ICONS[a]}
                      </span>
                    )}
                    {a}
                  </motion.button>
                );
              })}
              {allergyResults.length === 0 && (
                <button
                  onClick={addCustomAllergy}
                  className="w-full text-left px-4 py-3 rounded-md text-sm font-medium border border-dashed border-[#9B7DC8] text-[#7C5CAD] hover:bg-[#F3ECF9] transition-colors duration-fast min-h-[44px] font-sans"
                >
                  Add "{allergyQuery.trim()}" as custom allergy
                </button>
              )}
            </div>
          )}

          <div>
            <Eyebrow>Common</Eyebrow>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-3 mr-1">
            {collapsedItems.map((a) => (
              <AllergyChip
                key={a}
                label={a}
                icon={ALLERGY_ICONS[a]}
                disabled={false}
                onClick={() => toggleInList('allergies', a)}
              />
            ))}
            {!showAllAllergies && expandedItems.length > 0 && (
              <button
                onClick={() => setShowAllAllergies(true)}
                className="px-2.5 py-1.25 rounded-pill text-[14px] font-semibold tracking-wide border border-dashed border-sand-300 hover:border-[#9B7DC8] hover:text-[#7C5CAD] transition-colors duration-fast min-h-[30px] font-sans flex items-center gap-1.5"
                style={{ color: '#6B645A' }}
              >
                +{expandedItems.length} more
                <span className="material-symbols-rounded text-[16px]">expand_more</span>
              </button>
            )}
          </div>

          <AnimatePresence>
            {showAllAllergies && expandedItems.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2.5 mt-2.5 mr-1">
                  {expandedItems.map((a, i) => (
                    <motion.div
                      key={a}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
                    >
                      <AllergyChip
                        label={a}
                        icon={ALLERGY_ICONS[a]}
                        disabled={false}
                        onClick={() => toggleInList('allergies', a)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {customAllergies.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden"
              >
                <Eyebrow>Custom</Eyebrow>
                <div className="flex flex-wrap gap-2 mt-2 mr-1">
                  {customAllergies.map((item) => (
                    <SelectedChip
                      key={item}
                      label={item}
                      onRemove={() => toggleInList('allergies', item)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {!scrollState.atBottom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -bottom-2 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(200,168,232,0.5), transparent)' }}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}


function OverviewChip({ label, icon, onRemove }) {
  return (
    <motion.div
      layout
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={chipSpring}
      className="w-full flex items-center gap-3 px-5 py-4 mr-1 rounded-xl text-[15px] font-semibold tracking-wide text-blue-950 bg-white min-h-[54px] font-sans shadow-md"
    >
      {icon && (
        <span className="material-symbols-rounded text-[20px] text-blue-950/60">{icon}</span>
      )}
      <span className="flex-1 text-left">{label}</span>
      <button
        onClick={onRemove}
        className="flex items-center justify-center rounded-full hover:bg-blue-950/10 transition-colors duration-fast p-1 -mr-1"
        aria-label={`Remove ${label}`}
      >
        <span className="material-symbols-rounded text-[26px] text-blue-950/50">close</span>
      </button>
    </motion.div>
  );
}

function OverviewPanel({
  conditions,
  allergies,
  religiousRestriction,
  usedCount,
  toggleInList,
  setReligious,
}) {
  const overLimit = usedCount > MAX_ITEMS;
  const scrollRef = useRef(null);
  const [scrollState, setScrollState] = useState({ atTop: true, atBottom: true });

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      atTop: el.scrollTop <= 4,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
    });
  };

  useEffect(() => {
    handleScroll();
  }, [conditions, allergies, religiousRestriction]);

  const allTraits = [
    ...conditions.map((c) => ({ key: `c-${c}`, label: c, icon: CONDITION_ICONS[c], remove: () => toggleInList('conditions', c) })),
    ...allergies.map((a) => ({ key: `a-${a}`, label: a, icon: ALLERGY_ICONS[a], remove: () => toggleInList('allergies', a) })),
    ...(religiousRestriction !== 'none'
      ? [{
        key: `r-${religiousRestriction}`,
        label: religiousRestriction.charAt(0).toUpperCase() + religiousRestriction.slice(1),
        icon: DIET_OPTIONS.find((d) => d.value === religiousRestriction)?.icon,
        remove: () => setReligious('none'),
      }]
      : []),
  ];

  return (
    <section className="flex flex-col h-full overflow-hidden items-center">
      <div className="flex-none w-[85%]">
        <SectionHeader
          icon="checklist"
          title="Your profile overview"
          accent
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[24px] font-sans text-center mb-2 font-semibold tracking-wide text-blue-950/70"
        >
          {overLimit
            ? `Too many traits — choose your best ${MAX_ITEMS}!`
            : 'Looking good!'}
        </motion.p>
      </div>

      <div className="relative flex-1 min-h-0 w-[85%]">
        <AnimatePresence>
          {!scrollState.atTop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -top-2 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, rgba(200,168,232,0.5), transparent)' }}
            />
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto py-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.15) transparent', paddingRight: 0, marginRight: '-0px' }}
        >
          <LayoutGroup>
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {allTraits.map((t) => (
                  <OverviewChip
                    key={t.key}
                    label={t.label}
                    icon={t.icon}
                    onRemove={t.remove}
                  />
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>

        <AnimatePresence>
          {!scrollState.atBottom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute -bottom-2 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(200,168,232,0.5), transparent)' }}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function DietaryPanel({
  dietaryPattern,
  religiousRestriction,
  update,
  setReligious,
}) {
  return (
    <section>
      <SectionHeader
        icon="restaurant_menu"
        title="How do you eat?"
        accent
      />

      <p className="text-[12px] uppercase tracking-eyebrow font-sans ml-10" style={{ color: '#6B645A' }}>Dietary preference</p>
      <div className="grid grid-cols-2 gap-3 mt-3 px-8">
        {DIET_OPTIONS.filter(({ value }) => ['omnivore', 'pescatarian', 'vegetarian', 'vegan'].includes(value)).map(({ value, label, icon }) => {
          const isSelected = dietaryPattern === value;
          return (
            <motion.button
              key={value}
              whileTap={{ scale: 0.96 }}
              transition={chipSpring}
              onClick={() => update('dietaryPattern', value)}
              className={`flex flex-col items-center justify-center gap-1.5 aspect-[4/3] rounded-xl text-[15px] font-semibold tracking-wide border transition-all duration-fast font-sans ${isSelected
                ? 'text-white border-transparent shadow-md'
                : 'bg-white text-char-900 border-sand-200 hover:border-[#9B7DC8] shadow-sm hover:shadow-md'
                }`}
              style={isSelected ? { backgroundColor: '#6B4C9A' } : undefined}
            >
              <span className={`material-symbols-rounded text-[24px] ${isSelected ? 'text-white/80' : 'text-char-400'}`}>
                {icon}
              </span>
              {label}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-8">
        <p className="text-[12px] uppercase tracking-eyebrow font-sans ml-10" style={{ color: '#6B645A' }}>Religious observance</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3 px-8">
        {DIET_OPTIONS.filter(({ value }) => ['halal', 'kosher'].includes(value)).map(({ value, label, icon }) => {
          const isSelected = religiousRestriction === value;
          return (
            <motion.button
              key={value}
              whileTap={{ scale: 0.96 }}
              transition={chipSpring}
              onClick={() => setReligious(isSelected ? 'none' : value)}
              className={`flex flex-col items-center justify-center gap-1.5 aspect-[4/3] rounded-xl text-[15px] font-semibold tracking-wide border transition-all duration-fast font-sans ${isSelected
                ? 'text-white border-transparent shadow-md'
                : 'bg-white text-char-900 border-sand-200 hover:border-[#9B7DC8] shadow-sm hover:shadow-md'
                }`}
              style={isSelected ? { backgroundColor: '#6B4C9A' } : undefined}
            >
              <span className={`material-symbols-rounded text-[24px] ${isSelected ? 'text-white/80' : 'text-char-400'}`}>
                {icon}
              </span>
              {label}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
