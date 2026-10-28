import React from 'react';
import { AlertTriangle, RefreshCcw, Home, LogOut } from 'lucide-react';

/** Hard sign-out that works even while the React tree is broken. */
const forceSignOut = () => {
  try {
    localStorage.removeItem('bus_saarthi_user');
  } catch {
    /* storage unavailable — still navigate away */
  }
  window.location.href = '/login';
};

/** Chunk-load failure messages across browsers (Chrome / Firefox / Safari). */
const CHUNK_LOAD_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, chunkFailed: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI. Chunk-load
    // failures get a dedicated "updating" screen — the auto-reload below
    // heals them, and flashing the scary error page for a second first read
    // as "the app is broken" on every deploy.
    return { hasError: true, error, chunkFailed: CHUNK_LOAD_RE.test(error?.message || '') };
  }

  componentDidUpdate(prevProps) {
    // Reset when the route changes, so a single transient error does not
    // leave the whole app stuck on the error screen until a full reload.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorInfo: null, chunkFailed: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    // A stale tab after a deploy (or a flaky network) can request a chunk
    // hash that no longer exists. Reload once to pick up the fresh build —
    // cached assets make the reload invisible.
    if (CHUNK_LOAD_RE.test(error?.message || '')) {
      const lastReload = parseInt(
        sessionStorage.getItem('dynamic_import_reload_time') || '0',
        10,
      );
      const now = Date.now();
      // If we haven't reloaded for this error in the last 5 seconds, auto-reload to clear cache
      if (now - lastReload > 5000) {
        sessionStorage.setItem('dynamic_import_reload_time', now.toString());
        window.location.reload();
        return;
      }
    }

    // The technical detail goes to the console only. It is never rendered
    // for the user — a raw stack trace is not something a passenger should
    // have to read.
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Chunk failures heal via the reload above — show a neutral updating
      // screen instead of the error UI while it happens.
      if (this.state.chunkFailed) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a] font-sans">
            <div className="flex flex-col items-center gap-4 text-slate-500 dark:text-slate-300">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="font-bold tracking-tight text-sm uppercase">Updating Bus Saarthi…</p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a] p-4 font-sans">
          <div className="max-w-md w-full glass p-glass rounded-3xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden flex flex-col items-center text-center p-8 border border-slate-200 dark:border-slate-700">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              This page ran into a problem
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              We could not load this screen. The issue has been recorded. You
              can try again, or go back to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="w-full text-left bg-slate-100 dark:bg-slate-900 p-4 rounded-xl mb-6 overflow-x-auto text-xs text-slate-600 dark:text-slate-400 font-mono">
                <p className="font-bold text-red-500 mb-2">
                  {this.state.error.toString()}
                </p>
                <p>{this.state.errorInfo?.componentStack}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null, chunkFailed: false });
                }}
                className="flex-1 flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <RefreshCcw size={18} />
                Try Again
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="flex-1 flex items-center justify-center gap-2 w-full py-3 px-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Home size={18} />
                Go Home
              </button>
            </div>
            <button
              onClick={forceSignOut}
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-transparent text-slate-500 dark:text-slate-400 border-none rounded-xl font-semibold text-sm transition-colors hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
