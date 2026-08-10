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
