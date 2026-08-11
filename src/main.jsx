import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.jsx'
import PhoneFrame from './components/layout/PhoneFrame.jsx'

// `reducedMotion="user"` makes every `motion.*` component in the app (21
// files import framer-motion directly, no shared wrapper) automatically
// defer to the OS "Reduce motion" setting — transforms/scale/slide
// animations collapse to instant, opacity-only crossfades stay (framer-
// motion's own behavior for "user"), with zero per-file changes. This is
// framer-motion's *own* reduced-motion handling; it does not affect
// `useReducedMotion()` call sites (e.g. RemediWelcome.jsx), which read the
// OS media query directly and are unaffected by this context.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <PhoneFrame>
        <App />
      </PhoneFrame>
    </MotionConfig>
  </StrictMode>,
)
