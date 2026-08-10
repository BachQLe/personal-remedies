/* global process */
// This config file runs under Node (not the browser), so it needs the
// `process` global — eslint.config.js's `languageOptions.globals` is
// `globals.browser` (correct for app source), so this file declares its own
// Node global via the comment above rather than widening the shared config.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Node 22+ ships an experimental, non-functional-by-default global
 * `localStorage` (Web Storage API backed by a file — only real once you
 * pass `--localstorage-file`). When it's active it wins over jsdom's OWN
 * `window.localStorage` implementation (jsdom's environment setup exposes
 * `globalThis`, and Node's pre-existing global shadows it), leaving
 * `window.localStorage` a non-functional stub whose `setItem` throws —
 * which src/api/storage.js's `writeAll` silently swallows (by design, for
 * real quota/privacy-mode failures), so a seeded plan in a jsdom test would
 * appear to vanish with no error at all. Disabling the Node feature here
 * (before workers spawn, via NODE_OPTIONS so it reaches forked/threaded
 * test workers too) lets jsdom's real Storage implementation through.
 */
if (!/(^|\s)--no-experimental-webstorage(\s|$)/.test(process.env.NODE_OPTIONS || '')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-experimental-webstorage`.trim();
}

/**
 * vitest.config.js — test harness config (Task T1.1).
 *
 * Environment: defaults to 'node' (fast, no DOM) since most guard tests are
 * pure-function/fetch-mock tests with no localStorage/window dependency.
 * The one test that DOES need `window`/localStorage (the 3.4 conditions-purge
 * test, which exercises src/api/storage.js through src/state/dailyPlan.js)
 * opts into jsdom via a per-file `// @vitest-environment jsdom` docblock
 * comment instead of a global switch, so the rest of the suite stays on the
 * cheaper node environment.
 *
 * `test.env` pins the Nutridigm env vars the fetch-wrapper tests need
 * (src/api/config.js reads them via `import.meta.env`) to fixed test values,
 * independent of whatever is in the developer's local .env — otherwise the
 * 220/400 guard tests would silently pass locally (real .env has a key) but
 * fail in any environment without one (e.g. CI with no .env file).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: false,
    env: {
      VITE_NUTRIDIGM_SUBSCRIPTION_ID: 'test-subscription-id',
      VITE_NUTRIDIGM_BASE_URL: 'https://test.nutridigm.example/api/v2',
    },
    // jsdom's localStorage implementation needs a real http(s) origin to
    // work at all (otherwise window.localStorage.setItem throws, which
    // src/api/storage.js silently swallows — see its `writeAll` catch —
    // so a seeded plan would appear to vanish with no error). Only applies
    // to files that opt into jsdom via `// @vitest-environment jsdom`.
    environmentOptions: {
      jsdom: { url: 'http://localhost:3000' },
    },
  },
});
