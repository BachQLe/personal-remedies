import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ListChecks, Search } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader.jsx';
import MealprepCarousel from './MealprepCarousel.jsx';
import HomeMail from './HomeMail.jsx';
import { storage } from '../../api/storage.js';
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
    label: "Top Do's\nand Don'ts",
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

        <MealprepCarousel />
      </div>
    </div>
  );
}
