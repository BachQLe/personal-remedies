import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, BookmarkPlus, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/shared/Icon.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getQueue, addToQueue, removeFromQueue, insertIntoQueue, subscribeQueue } from '../../state/queue.js';
import { getLibrary, subscribeLibrary } from '../../state/library.js';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

const BEVERAGE_KEYWORDS = ['tea', 'coffee', 'juice', 'milk', 'water', 'smoothie', 'kefir', 'kombucha', 'cocoa', 'latte', 'cider', 'wine'];

function isBeverage(item) {
  if (item.group === 'h') return true;
  const lower = (item.name || '').toLowerCase();
  return BEVERAGE_KEYWORDS.some((kw) => lower.includes(kw));
}

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group);
}

function cardSubtitle(item) {
  if (!item.tier) return undefined;
  return item.referenceTotal ? `${item.tier} · ${item.referenceTotal} studies` : item.tier;
}

// ── Snackbar ──────────────────────────────────────────────────────────────────

function Snackbar({ snackbar, onUndo, onDismiss }) {
  useEffect(() => {
    if (!snackbar) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [snackbar, onDismiss]);

  return (
    <AnimatePresence>
      {snackbar && (
        <motion.div
          key={snackbar.id}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={calmSpring}
          className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-50
            max-w-[360px] w-[calc(100%-40px)]
            flex items-center justify-between gap-3
            px-4 py-3 rounded-xl
            bg-char-900 text-white shadow-lg"
        >
          <span className="font-sans text-sm font-medium">{snackbar.message}</span>
          {snackbar.canUndo && (
            <button
              onClick={onUndo}
              className="font-sans text-sm font-semibold text-forest-300 hover:text-forest-200
                transition-colors duration-fast shrink-0"
            >
              Undo
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Card grids ────────────────────────────────────────────────────────────────

function CardGrid({ items, actionIcon, onAction, emptyMessage }) {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl border border-dashed border-blue-950/30">
        <BookmarkPlus size={18} className="text-blue-950 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-950 font-sans leading-snug">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={calmSpring}
          >
            <FoodImageCard
              id={item.id}
              image={cardImage(item)}
              badge={item.tier}
              title={item.name}
              subtitle={cardSubtitle(item)}
              aspectRatio="4/5"
              action={actionIcon}
              actionOnClick={() => onAction(item)}
              className="w-full"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 4;
const CHUNK = 16;

export default function MealQueueScreen() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState(getQueue);
  const [library, setLibrary] = useState(getLibrary);
  const [mode, setMode] = useState('foods'); // 'foods' | 'beverages'
  const [queueLimit, setQueueLimit] = useState(PAGE_SIZE);
  const [cookbookExpanded, setCookbookExpanded] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const snackbarRef = useRef(null);
  const queueLabelRef = useRef(null);
  const snackbarIdRef = useRef(0);

  useEffect(() => {
    const unsubQ = subscribeQueue(setQueue);
    const unsubL = subscribeLibrary(setLibrary);
    return () => { unsubQ(); unsubL(); };
  }, []);

  const showSnackbar = useCallback((message, canUndo = false, undoFn = null) => {
    snackbarIdRef.current += 1;
    const id = snackbarIdRef.current;
    snackbarRef.current = undoFn;
    setSnackbar({ id, message, canUndo });
  }, []);

  const dismissSnackbar = useCallback(() => setSnackbar(null), []);

  const handleUndo = useCallback(() => {
    if (snackbarRef.current) snackbarRef.current();
    snackbarRef.current = null;
    setSnackbar(null);
  }, []);

  const handleToggleMode = useCallback((newMode) => {
    setMode(newMode);
    setQueueLimit(PAGE_SIZE);
    setCookbookExpanded(false);
  }, []);

  // Filter by mode
  const filterFn = mode === 'beverages' ? isBeverage : (item) => !isBeverage(item);
  const filteredQueue = queue.filter(filterFn);
  const filteredLibrary = library.filter(filterFn);

  const visibleQueue = filteredQueue.slice(0, queueLimit);
  const visibleCookbook = cookbookExpanded ? filteredLibrary : filteredLibrary.slice(0, PAGE_SIZE);

  // Queue: complete (check)
  const handleComplete = useCallback((item) => {
    const idx = queue.findIndex((i) => i.id === item.id);
    removeFromQueue(item.id);
    showSnackbar('Removed · Undo', true, () => {
      insertIntoQueue(item, idx >= 0 ? idx : 0);
    });
  }, [queue, showSnackbar]);

  // Cookbook: add to queue (plus)
  const handleAddToQueue = useCallback((item) => {
    const added = addToQueue(item);
    if (added) {
      showSnackbar('Added to queue');
    } else {
      showSnackbar('Already in queue');
    }
  }, [showSnackbar]);

  const handleQueueSeeMore = () => setQueueLimit((l) => l + CHUNK);

  const handleQueueSeeLess = () => {
    setQueueLimit(PAGE_SIZE);
    queueLabelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const checkIcon = <Check size={16} className="text-forest-700" />;
  const plusIcon = <Plus size={16} className="text-forest-700" />;

  return (
    <div className="bg-forest-300 flex flex-col min-h-screen -mb-28">

      {/* ── Header zone ──────────────────────────────────────────────────── */}
      <div className="bg-forest-300 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/60">
            Plan
          </p>
          <button
            onClick={() => navigate('/app/profile')}
            aria-label="Profile"
            className="w-12 h-12 mt-2 ml-2 flex items-center justify-center rounded-full
              bg-white border border-sand-200 shadow-xs text-char-500
              transition-all duration-fast hover:border-forest-400 hover:text-forest-600 hover:shadow-sm
              active:scale-95"
          >
            <Icon name="user" size={18} />
          </button>
        </div>

        <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
          My Plan
        </h1>

        {/* Foods / Beverages toggle */}
        <div className="mt-4 flex gap-2">
          {['foods', 'beverages'].map((m) => (
            <button
              key={m}
              onClick={() => handleToggleMode(m)}
              className={`px-4 py-2 rounded-pill text-sm font-semibold font-sans
                transition-all duration-fast capitalize
                ${mode === m
                  ? 'bg-blue-950 text-white shadow-sm'
                  : 'bg-white/20 text-blue-950/70 hover:bg-white/30'
                }`}
            >
              {m === 'foods' ? 'Foods' : 'Beverages'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Glass panel ──────────────────────────────────────────────────── */}
      <div
        className="flex-1 px-4 pt-5 pb-28 flex flex-col gap-8"
        style={{
          backgroundColor: 'rgba(255,255,255,0.22)',
          borderTop: '1px solid rgba(255,255,255,0.45)',
          borderLeft: '1px solid rgba(255,255,255,0.45)',
          borderRight: '1px solid rgba(255,255,255,0.45)',
          borderRadius: '24px 24px 0 0',
        }}
      >

        {/* ── Meal Queue section ──────────────────────────────────────────── */}
        <section>
          <div ref={queueLabelRef} className="flex items-baseline justify-between mb-4">
            <div className="flex items-center gap-2">
              <p className="font-label text-xs tracking-widest uppercase text-blue-950/70">
                Meal Queue
              </p>
              {filteredQueue.length > 0 && (
                <span className="text-[11px] font-semibold font-sans text-blue-950/50
                  bg-white/40 rounded-full px-2 py-0.5">
                  {filteredQueue.length}
                </span>
              )}
            </div>
          </div>

          <CardGrid
            items={visibleQueue}
            actionIcon={checkIcon}
            onAction={handleComplete}
            emptyMessage="Your queue is empty — add items from your cookbook below."
          />

          {/* See more / see less */}
          {filteredQueue.length > PAGE_SIZE && (
            <div className="mt-3 flex justify-center gap-4">
              {queueLimit < filteredQueue.length && (
                <button
                  onClick={handleQueueSeeMore}
                  className="text-sm font-semibold font-sans text-blue-950/70
                    hover:text-blue-950 transition-colors duration-fast"
                >
                  See {Math.min(CHUNK, filteredQueue.length - queueLimit)} more
                </button>
              )}
              {queueLimit > PAGE_SIZE && (
                <button
                  onClick={handleQueueSeeLess}
                  className="text-sm font-semibold font-sans text-blue-950/50
                    hover:text-blue-950/70 transition-colors duration-fast"
                >
                  See less
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── Cookbook section ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <p className="font-label text-xs tracking-widest uppercase text-blue-950/70">
              Cookbook
            </p>
          </div>

          <CardGrid
            items={visibleCookbook}
            actionIcon={plusIcon}
            onAction={handleAddToQueue}
            emptyMessage="Save foods and recipes from Food Lookup or Suggestions to build your cookbook."
          />

          {/* See more / see less */}
          {filteredLibrary.length > PAGE_SIZE && (
            <div className="mt-3 flex justify-center">
              {!cookbookExpanded ? (
                <button
                  onClick={() => setCookbookExpanded(true)}
                  className="text-sm font-semibold font-sans text-blue-950/70
                    hover:text-blue-950 transition-colors duration-fast"
                >
                  See all {filteredLibrary.length}
                </button>
              ) : (
                <button
                  onClick={() => setCookbookExpanded(false)}
                  className="text-sm font-semibold font-sans text-blue-950/50
                    hover:text-blue-950/70 transition-colors duration-fast"
                >
                  See less
                </button>
              )}
            </div>
          )}

          {/* Hint when collapsed and there are more */}
          {!cookbookExpanded && filteredLibrary.length > PAGE_SIZE && (
            <p className="mt-2 text-center text-[11px] text-blue-950/40 font-sans">
              Scroll to see more
            </p>
          )}
        </section>
      </div>

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
      <Snackbar snackbar={snackbar} onUndo={handleUndo} onDismiss={dismissSnackbar} />
    </div>
  );
}
