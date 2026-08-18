import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Check if the error is a dynamic import failure (common with Vite cache issues/deployments)
    const isChunkLoadFailed = /Failed to fetch dynamically imported module/i.test(error?.message);
    
    if (isChunkLoadFailed) {
      const lastReload = parseInt(sessionStorage.getItem('dynamic_import_reload_time') || '0', 10);
      const now = Date.now();
      // If we haven't reloaded for this error in the last 5 seconds, auto-reload to clear cache
      if (now - lastReload > 5000) {
        sessionStorage.setItem('dynamic_import_reload_time', now.toString());
        window.location.reload();
        return;
      }
    }

    // You can also log the error to an error reporting service here
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a] p-4 font-sans">
          <div className="max-w-md w-full glass p-glass rounded-3xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden flex flex-col items-center text-center p-8 border border-slate-200 dark:border-slate-700">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Oops! Something went wrong.</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              We're sorry, but the application encountered an unexpected error. Our team has been notified.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="w-full text-left bg-slate-100 dark:bg-slate-900 p-4 rounded-xl mb-6 overflow-x-auto text-xs text-slate-600 dark:text-slate-400 font-mono">
                <p className="font-bold text-red-500 mb-2">{this.state.error.toString()}</p>
                <p>{this.state.errorInfo?.componentStack}</p>
              </div>
            )}

            <button 
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <RefreshCcw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
