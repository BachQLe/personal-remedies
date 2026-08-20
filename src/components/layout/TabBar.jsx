import { NavLink } from 'react-router-dom';
import Icon from '../shared/Icon.jsx';

const TABS = [
  { to: '/app/plan', label: 'Plan', icon: 'clipboard-list' },
  { to: '/app/search', label: 'Search', icon: 'search' },
  { to: '/app/home', label: 'Home', icon: 'home' },
  { to: '/app/suggestions', label: 'Choices', icon: 'list' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
];

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none safe-area-bottom">
      <div className="max-w-[430px] mx-auto px-5 pb-4">
        <div className="pointer-events-auto flex items-center justify-around px-2 h-16
          bg-white/90 backdrop-blur-md rounded-pill border border-sand-200 shadow-lg">
        {TABS.map((tab) => {
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[44px] min-h-[44px] justify-center"
            >
              {({ isActive }) => (
                <>
                  <span className={`transition-colors duration-fast ${isActive ? 'text-blue-950' : 'text-char-400'}`}>
                    <Icon name={tab.icon} size={24} aria-hidden="true" />
                  </span>
                  <span
                    className={`text-[10px] font-semibold font-sans transition-colors duration-fast ${
                      isActive ? 'text-blue-950' : 'text-char-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
