import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/shared/Icon.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import MealprepCarousel from './MealprepCarousel.jsx';
import { storage } from '../../api/storage.js';
import './HomeScreen.css';

const SHORTCUTS = [
  {
    to: '/app/plan',
    label: 'Meal planner',
    icon: 'calendar',
    tile: 'bg-forest-100',
    chip: 'bg-forest-500/20 text-forest-700',
  },
  {
    to: '/app/suggestions',
    label: 'Food guide',
    icon: 'leaf',
    tile: 'bg-lavender-100',
    chip: 'bg-lavender-500/20 text-lavender-700',
  },
  {
    to: '/app/search',
    label: 'Food lookup',
    icon: 'search',
    tile: 'bg-yellow-200',
    chip: 'bg-yellow-500/20 text-yellow-950',
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
      />

      <div className="home-screen__body">
        <nav className="home-shortcuts" aria-label="Explore Remedi">
          {SHORTCUTS.map(({ to, label, icon, tile, chip }) => (
            <Link key={to} to={to} className={`home-shortcut shadow-xs ${tile}`}>
              <span className={`home-shortcut__icon w-11 h-11 rounded-lg ${chip}`}>
                <Icon name={icon} size={23} aria-hidden="true" />
              </span>
              <span className="home-shortcut__label font-display font-semibold text-base text-blue-950 leading-tight tracking-tight">
                {label.replace(' ', '\n')}
              </span>
            </Link>
          ))}
        </nav>

        <MealprepCarousel />
      </div>
    </div>
  );
}
