import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // We don't log the full errorInfo to console in production
    if (import.meta.env.DEV) {
      console.error('Uncaught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900/50 border border-red-500/20 rounded-xl p-8 backdrop-blur-xl text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-8">
              The application encountered an unexpected error. This has been logged for our team.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('threat_vision_results');
                sessionStorage.removeItem('threat_vision_transactions');
                sessionStorage.removeItem('threat_vision_graph');
                window.location.reload();
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium py-3 rounded-lg transition-colors border border-red-500/30"
            >
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
