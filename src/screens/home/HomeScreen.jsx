import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import calendarIcon from '../../assets/home-calendar-natural.png';
import searchIcon from '../../assets/home-search-natural.png';
import dishIcon from '../../assets/home-guide-natural.png';
import PageHeader from '../../components/shared/PageHeader.jsx';
import MealprepCarousel from './MealprepCarousel.jsx';
import HomeMail from './HomeMail.jsx';
import { storage } from '../../api/storage.js';
import './HomeScreen.css';

// Labels carry their own line break (rendered via pre-line) so the three tiles balance.
const SHORTCUTS = [
  {
    to: '/app/plan',
    label: 'Meal\nplanner',
    icon: calendarIcon,
    tile: 'home-shortcut--sage',
  },
  {
    to: '/app/suggestions',
    label: "Top Do's\nand Don'ts",
    icon: dishIcon,
    tile: 'home-shortcut--clay',
  },
  {
    to: '/app/search',
    label: 'Food\nlookup',
    icon: searchIcon,
    tile: 'home-shortcut--oat',
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
    <div className="home-screen">
      <PageHeader
        label="Home"
        title={firstName ? `Hey, ${firstName}` : 'Hey there'}
        className="home-screen__header pb-7"
        right={<HomeMail />}
      />

      <div className="home-screen__body">
        <nav className="home-shortcuts" aria-label="Explore Personal Remedies">
          {SHORTCUTS.map(({ to, label, icon, tile }) => (
            <Link key={to} to={to} className={`home-shortcut shadow-xs ${tile}`}>
              <img className="home-shortcut__icon" src={icon} alt="" aria-hidden="true" width="72" height="72" />
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
