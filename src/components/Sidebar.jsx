import { NavLink, useNavigate } from 'react-router-dom';
import remedyMark from '../assets/remedy-mark.svg';

const NAV_ITEMS = [
  { to: '/app/home', label: 'Home', icon: 'home' },
  { to: '/app/plan', label: 'Plan', icon: 'calendar_today' },
  { to: '/app/recipes', label: 'Recipes', icon: 'restaurant' },
  { to: '/app/profile', label: 'Profile', icon: 'person' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-forest-900 flex-shrink-0 fixed top-0 left-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-white/10">
        <img src={remedyMark} alt="Remedy" className="w-[34px] h-[34px]" />
        <span className="font-display text-[23px] font-semibold" style={{ color: '#F3EFE6' }}>
          Remedy
        </span>
      </div>

      {/* Check a food CTA */}
      <div className="px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/app/lookup')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm font-sans active:scale-95 transition-all duration-fast"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
            search
          </span>
          Check a food
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3 flex-1 pt-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-fast"
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 w-[3px] h-6 rounded-r-full bg-honey-600" />
                )}
                <span
                  className={`material-symbols-rounded${isActive ? ' fill' : ''}`}
                  style={{
                    fontSize: 21,
                    color: isActive ? '#F3EFE6' : '#BFC9BD',
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="text-sm font-sans"
                  style={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#F3EFE6' : '#BFC9BD',
                  }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="ml-auto w-[6px] h-[6px] rounded-full bg-honey-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-white/10">
        <p className="text-xs font-sans" style={{ color: '#BFC9BD' }}>v0.1</p>
      </div>
    </aside>
  );
}
