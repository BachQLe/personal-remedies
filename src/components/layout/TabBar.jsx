import { NavLink } from 'react-router-dom';
import Icon from '../shared/Icon.jsx';

const TABS = [
  { to: '/app/home', label: 'Home', icon: 'home' },
  { to: '/app/week', label: 'Week', icon: 'calendar' },
  { to: '/app/plan', label: 'Plan', icon: 'calendar' },
  { to: '/app/recipes', label: 'Recipes', icon: 'utensils' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
];

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-t border-sand-200 safe-area-bottom">
      <div className="max-w-[430px] mx-auto flex items-center justify-around px-2 h-16">
        {TABS.map((tab) => {
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[44px] min-h-[44px] justify-center"
            >
              {({ isActive }) => (
                <>
                  <span className={`transition-colors duration-fast ${isActive ? 'text-forest-700' : 'text-char-400'}`}>
                    <Icon name={tab.icon} size={24} />
                  </span>
                  <span
                    className={`text-[10px] font-semibold font-sans transition-colors duration-fast ${
                      isActive ? 'text-forest-700' : 'text-char-400'
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
    </nav>
  );
}
