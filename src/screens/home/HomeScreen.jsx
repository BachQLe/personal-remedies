import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronRight, HelpCircle, Info, ListChecks, Search } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader.jsx';
import HomeMail from './HomeMail.jsx';
import { storage } from '../../api/storage.js';
import { PLAN_SLOTS } from '../../api/config.js';
import { ensurePlanForWeek } from '../../api/planBuilder.js';
import { getPlan, subscribePlan } from '../../state/dailyPlan.js';
import { todayKey } from '../plan/planDates.js';
import './HomeScreen.css';

// The two half-width tiles carry their own line break (rendered via pre-line) so they balance;
// the full-width Meal planner stays on one line.
const SHORTCUTS = [
  {
    to: '/app/plan',
    label: 'Meal planner',
    icon: CalendarDays,
    tile: 'bg-forest-100',
  },
  {
    to: '/app/suggestions',
    label: 'Top\nChoices',
    icon: ListChecks,
    tile: 'bg-lavender-100',
  },
  {
    to: '/app/search',
    label: 'Food\nlookup',
    icon: Search,
    tile: 'bg-yellow-200',
  },
];

const CARD = 'flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xs text-blue-950 transition duration-fast hover:bg-sand-100 active:scale-[0.99]';
// Same small secondary pill as the plan's Save day / Load day, on white because Home's body is paper.
const PILL = 'tap-target inline-flex min-h-[36px] items-center gap-1.5 rounded-pill bg-white px-3 font-sans text-xs ' +
  'font-semibold text-blue-950 shadow-xs transition duration-fast hover:bg-sand-100 active:scale-95';

/**
 * Home's piece of the meal plan (Prompt B 1.1): today's meals, read from the
 * plan already on this device. No API call and no spinner, so Home stays fast.
 * No health profile, or nothing planned today, shows a one-line next step.
 */
function TodayMeals({ profile }) {
  const [plan, setPlanState] = useState(getPlan);
  useEffect(() => subscribePlan(setPlanState), []);
  const hasProfile = profile?.conditions?.length > 0;
  // Network-free: fills today in if the plan's 7-day window has rolled past it.
  useEffect(() => { if (hasProfile) ensurePlanForWeek(profile); }, [profile, hasProfile]);

  const day = todayKey();
  const slots = plan?.days?.[day]?.slots;
  const rows = PLAN_SLOTS.map((slot) => ({ slot, first: slots?.[slot.key]?.[0] })).filter((row) => row.first);

  if (!hasProfile || !rows.length) {
    // ProfileBuilder only runs inside onboarding; an onboarded user's health profile is edited on Profile.
    const [to, text] = hasProfile
      ? ['/app/favorites', 'Pick your favorites to build your week']
      : ['/app/profile', 'Create your health profile to get meal suggestions'];
    return (
      <Link to={to} className={CARD}>
        <span className="min-w-0 flex-1 font-sans text-sm font-semibold">{text}</span>
        <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link to={`/app/plan?day=${day}`} className={CARD}>
      <div className="min-w-0 flex-1">
        <p className="font-label text-xs uppercase tracking-widest text-blue-950/70">Today’s meals</p>
        <dl className="mt-2 flex flex-col gap-1.5 font-sans text-sm">
          {rows.map(({ slot, first }) => (
            <div key={slot.key} className="flex flex-wrap gap-x-3">
              <dt className="text-blue-950/70">{slot.label}</dt>
              <dd className="min-w-0 break-words font-semibold">{first.name}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ChevronRight size={18} className="shrink-0 text-blue-950/50" aria-hidden="true" />
    </Link>
  );
}

export default function HomeScreen() {
  const [profile, setProfile] = useState(() => storage.get('profile', null));
  const firstName = typeof profile?.firstName === 'string' ? profile.firstName.trim() : '';

  // A signed-in profile can hydrate after this screen has already mounted.
  useEffect(() => storage.onWrite((key) => {
    if (key === 'profile') setProfile(storage.get('profile', null));
  }), []);

  return (
    <div className="home-screen bg-forest-300">
      <PageHeader
        label="Home"
        title={firstName ? `Hey, ${firstName}` : 'Hey there'}
        className="home-screen__header pb-7"
        right={<HomeMail />}
      />

      <div className="home-screen__body">
        <nav className="home-shortcuts" aria-label="Explore Personal Remedies">
          {SHORTCUTS.map(({ to, label, icon: Icon, tile }) => (
            <Link key={to} to={to} className={`home-shortcut shadow-xs ${tile}`}>
              <Icon className="home-shortcut__icon text-blue-950" size={40} strokeWidth={1.75} aria-hidden="true" />
              <span className="home-shortcut__label font-display font-semibold text-blue-950 leading-tight tracking-tight">
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <TodayMeals profile={profile} />

        <nav className="flex flex-wrap justify-center gap-2" aria-label="About the app">
          <Link to="/app/how-to-use" className={PILL}>
            <HelpCircle size={14} aria-hidden="true" />
            How to use
          </Link>
          <Link to="/app/profile/important-notes" className={PILL}>
            <Info size={14} aria-hidden="true" />
            Important Notes
          </Link>
        </nav>
      </div>
    </div>
  );
}
