import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { registerSW } from 'virtual:pwa-register'
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

/**
 * Service worker registration + update/offline-ready UX (T7A, master plan
 * §3.4/§8). Importing `virtual:pwa-register` here (rather than leaving it
 * unimported) does two things: it wires the callbacks below, AND it flips
 * vite-plugin-pwa's `injectRegister` resolution from its default injected
 * `<script src="/registerSW.js">` tag to `null` (see the plugin's
 * `useImportRegister` flag) — so this is the ONLY registration path, not an
 * addition on top of one that already existed silently.
 *
 * Architecture choice: the update/offline-ready signal is rendered as a
 * plain DOM node appended to `document.body`, not a React component or a
 * dispatch into `SnackbarContext`. Two options were on the table:
 *   (a) a tiny pub/sub module (e.g. `src/api/swUpdate.js`) that a future
 *       component subscribes to, or
 *   (b) a small, dependency-free DOM-level bar built and shown right here.
 * (a) is the architecturally "cleaner" shape long-term, but this task owns
 * no component file to wire it into — landing (a) alone would ship a module
 * with zero consumers and, concretely, zero user-facing update/offline
 * signal, which is the actual deliverable here. (b) is a real (small, one-
 * time) duplication of the app's toast visual language, but it *works*
 * today, needs no follow-up wave to become visible, and is isolated to this
 * file (already the app's sanctioned exception to the "no window/document
 * outside a thin adapter" rule, being the entry point). A future wave that
 * wants this folded into `SnackbarContext`/`Snackbar.jsx` can lift
 * `showServiceWorkerNotice` below almost directly — the seams (message,
 * optional action) already match `useSnackbar().show`'s shape.
 *
 * `registerType: 'autoUpdate'` (vite.config.js) means the generated service
 * worker calls `self.skipWaiting()`/`clients.claim()` on its own — by the
 * time `onNeedReload` fires the new SW is already installed and active, all
 * that's left is reloading the page so it picks up assets built against it.
 * (`onNeedRefresh` is the prompt-mode hook — see vite-plugin-pwa's
 * client/build/register.js — and is never invoked under `autoUpdate`, so
 * it's intentionally not wired below; a future switch to `registerType:
 * 'prompt'` would need it added alongside `onNeedReload`.)
 */
const updateSW = registerSW({
  onOfflineReady() {
    showServiceWorkerNotice('Remedi is ready to work offline.', { autoDismissMs: 6000 })
  },
  onNeedReload() {
    showServiceWorkerNotice('A new version of Remedi is available.', {
      actionLabel: 'Reload',
      onAction: () => {
        // `updateSW()` is a documented no-op under `autoUpdate` (the new SW
        // is already active by the time this callback fires — there's no
        // skip-waiting message left to send), so the reload is done
        // directly; the call is kept so behavior stays correct if
        // `registerType` ever changes to `'prompt'`, where it does matter.
        updateSW()
        window.location.reload()
      },
    })
  },
  onRegisterError(error) {
    console.error('[main] Service worker registration failed:', error)
  },
})

// ---- Minimal DOM-level notice bar --------------------------------------
//
// No React, no framer-motion, no new dependency — see the docblock above
// for why this lives here instead of a component. Styling is inlined (hex
// values lifted straight from tailwind.config.js's `char`/`forest`/`paper`
// tokens) since Tailwind's class scanner never sees raw `document.createElement`
// output. Only one notice is shown at a time.

let activeNotice = null

function dismissServiceWorkerNotice() {
  if (!activeNotice) return
  const { el, timer } = activeNotice
  activeNotice = null
  if (timer) clearTimeout(timer)
  el.remove()
}

/**
 * @param {string} message
 * @param {{ actionLabel?: string, onAction?: () => void, autoDismissMs?: number }} [opts]
 */
function showServiceWorkerNotice(message, opts = {}) {
  const { actionLabel, onAction, autoDismissMs } = opts
  dismissServiceWorkerNotice()

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.setAttribute('aria-label', message)
  el.style.cssText = [
    'position: fixed',
    'left: 16px',
    'right: 16px',
    'bottom: calc(96px + env(safe-area-inset-bottom, 0px))', // clears the bottom nav (matches Snackbar.jsx's 88px convention)
    'z-index: 9999',
    'max-width: 360px',
    'margin: 0 auto',
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'gap: 8px',
    'padding: 10px 6px 10px 16px',
    'border-radius: 14px', // tailwind.config.js borderRadius.lg
    'background: #211E1B', // tailwind.config.js colors.char.900
    'color: #FAFAF8', // tailwind.config.js colors.paper.100 ("cream")
    'box-shadow: 0 8px 24px rgba(45, 36, 24, 0.18)',
    'font-family: "Switzer", ui-sans-serif, system-ui, sans-serif',
    'font-size: 14px',
    'font-weight: 500',
    'line-height: 1.4',
    `opacity: ${prefersReducedMotion ? '1' : '0'}`,
    `transform: ${prefersReducedMotion ? 'none' : 'translateY(12px)'}`,
    `transition: ${prefersReducedMotion ? 'none' : 'opacity 200ms ease-out, transform 200ms ease-out'}`,
  ].join(';')

  const text = document.createElement('span')
  text.textContent = message
  text.style.cssText = 'flex: 1 1 auto;'
  el.appendChild(text)

  const actions = document.createElement('div')
  actions.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;'

  if (actionLabel && typeof onAction === 'function') {
    const actionBtn = document.createElement('button')
    actionBtn.type = 'button'
    actionBtn.textContent = actionLabel
    actionBtn.style.cssText = [
      'min-width: 44px', // real ≥44px touch target
      'min-height: 44px',
      'padding: 0 10px',
      'border: none',
      'background: transparent',
      'color: #B4D85C', // tailwind.config.js colors.forest.400
      'font: inherit',
      'font-weight: 600',
      'cursor: pointer',
    ].join(';')
    actionBtn.addEventListener('click', () => {
      dismissServiceWorkerNotice()
      onAction()
    })
    actions.appendChild(actionBtn)
  }

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', 'Dismiss notification')
  closeBtn.textContent = '×'
  closeBtn.style.cssText = [
    'min-width: 44px', // real ≥44px touch target
    'min-height: 44px',
    'border: none',
    'background: transparent',
    'color: #FAFAF8',
    'font-size: 20px',
    'line-height: 1',
    'cursor: pointer',
  ].join(';')
  closeBtn.addEventListener('click', dismissServiceWorkerNotice)
  actions.appendChild(closeBtn)

  el.appendChild(actions)
  document.body.appendChild(el)

  const timer = autoDismissMs ? setTimeout(dismissServiceWorkerNotice, autoDismissMs) : null
  activeNotice = { el, timer }

  if (!prefersReducedMotion) {
    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
  }
}
