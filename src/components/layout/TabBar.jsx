import { NavLink } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import Icon from '../shared/Icon.jsx';

const TABS = [
  { to: '/app/plan', label: 'Plan', icon: 'clipboard-list' },
  { to: '/app/search', label: 'Search', icon: 'search' },
  { to: '/app/home', label: 'Home', icon: 'home' },
  { to: '/app/suggestions', label: 'Choices', icon: 'list' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
];

const PILL_SPRING = { type: 'spring', stiffness: 420, damping: 34 };

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none safe-area-bottom">
      <div className="flex justify-center px-3 pb-4">
        <LayoutGroup id="tabbar">
          <div className="pointer-events-auto inline-flex items-center justify-center gap-2 px-2 h-14
            bg-char-900/95 backdrop-blur-md rounded-md border border-char-700 shadow-lg">
          {TABS.map((tab) => {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-label={tab.label}
                className="relative flex items-center justify-center h-11 min-w-[44px] px-2.5 rounded-md"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="tabbar-pill"
                        transition={PILL_SPRING}
                        className="absolute inset-0 rounded-md bg-white"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`relative flex items-center gap-1.5 transition-colors duration-fast ${
                        isActive ? 'text-char-900' : 'text-char-300'
                      }`}
                    >
                      <Icon name={tab.icon} size={21} aria-hidden="true" />
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="overflow-hidden whitespace-nowrap text-[11px] font-semibold font-sans"
                          >
                            {tab.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
