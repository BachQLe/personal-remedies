import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import Icon from '../shared/Icon.jsx';
import { ease, dur, spring, sliderSpring } from '../../lib/motion.js';

const TABS = [
  // `alsoActive`: a sibling route that belongs to this tab's flow (My Favorites and Choose recipes are part of Plan).
  { to: '/app/plan', label: 'Plan', icon: 'clipboard-list', alsoActive: ['/app/favorites', '/app/recipes'] },
  { to: '/app/search', label: 'Search', icon: 'search' },
  { to: '/app/home', label: 'Home', icon: 'home' },
  { to: '/app/suggestions', label: 'Choices', icon: 'list' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
];

export default function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none safe-area-bottom">
      <div className="tabbar flex justify-center px-3 pb-4">
        <LayoutGroup id="tabbar">
          <div className="tabbar-bar pointer-events-auto inline-flex items-center justify-center
            bg-[#1A1F2B]/95 backdrop-blur-md rounded-md border border-[#363C4A] shadow-lg">
          {TABS.map((tab) => {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-label={tab.label}
                className="tabbar-link relative flex items-center justify-center rounded-md"
              >
                {({ isActive: routeActive }) => {
                  const isActive = routeActive || tab.alsoActive?.includes(pathname);
                  return (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="tabbar-pill"
                        transition={sliderSpring}
                        className="absolute inset-0"
                        aria-hidden="true"
                      >
                        <span className="squash-stretch block w-full h-full rounded-md bg-white" />
                      </motion.span>
                    )}
                    <motion.span
                      whileTap={{ scale: 0.92 }}
                      transition={{ duration: dur.press, ease: ease.out }}
                      className={`relative flex items-center gap-1.5 transition-colors duration-fast ${
                        isActive ? 'text-[#1A1F2B]' : 'text-[#A3ABBD]'
                      }`}
                    >
                      <Icon name={tab.icon} size={21} className="tabbar-icon" aria-hidden="true" />
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0, transition: { duration: dur.exit, ease: ease.in } }}
                            transition={{ duration: dur.base, ease: ease.out }}
                            className="tabbar-label overflow-hidden whitespace-nowrap text-[0.875rem] font-semibold font-sans"
                          >
                            {tab.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.span>
                  </>
                  );
                }}
              </NavLink>
            );
          })}
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
