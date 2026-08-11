import { Component } from "react";

// Top-level render-time safety net. Without this, any uncaught synchronous
// exception during render (e.g. a null/undefined field before an async
// profile/plan load resolves) wipes the entire page to blank white with zero
// on-screen indication — see MealQueueScreen's calorieTarget bug for a real
// case. This is the last line of defense, not a substitute for fixing the
// underlying null/undefined handling at the source.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught a render error", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper-200 flex flex-col items-center justify-center px-6 text-center gap-3">
          <p className="font-display text-lg font-semibold text-blue-950 leading-snug">
            Something went wrong
          </p>
          <p className="text-sm font-sans text-blue-950/60 leading-relaxed max-w-xs">
            This screen ran into an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-2 rounded-full bg-blue-950 text-white text-sm font-semibold font-sans px-5 py-2.5"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Route-level safety net. Mounted around just the <Outlet/> inside AppLayout
// (App.jsx), keyed by the current pathname, so:
//   - a render throw on one screen shows an inline panel in place of that
//     screen only — TabBar/FAB (siblings in AppShell, outside this
//     boundary) stay mounted and usable, unlike the root ErrorBoundary which
//     blanks the entire app;
//   - navigating away (the key changing) remounts the boundary fresh, so a
//     broken screen doesn't stay broken forever — no need to reload the app;
//   - a "Try again" button also resets it in place, for a broken screen
//     whose underlying cause (e.g. a bad cached response) might clear on a
//     re-render without a navigation at all.
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("RouteErrorBoundary caught a render error", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-3">
          <p className="font-display text-base font-semibold text-blue-950 leading-snug">
            This screen hit a snag
          </p>
          <p className="text-sm font-sans text-blue-950/60 leading-relaxed max-w-xs">
            Something went wrong loading this. Try again, or come back to it later.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-2 rounded-full bg-blue-950 text-white text-sm font-semibold font-sans px-5 py-2.5"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
