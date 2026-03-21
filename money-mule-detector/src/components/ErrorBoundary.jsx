import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
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
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900/50 border border-red-500/20 rounded-xl p-8 backdrop-blur-xl text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-4">
              The application encountered an unexpected error.
            </p>
            {this.state.error && (
               <div className="bg-black/50 p-4 rounded-lg text-left overflow-auto max-h-64 mb-6 border border-red-500/30">
                 <p className="text-red-400 font-mono text-sm mb-2">{String(this.state.error)}</p>
                 <pre className="text-red-300/70 font-mono text-[10px] whitespace-pre-wrap">{this.state.error.stack}</pre>
               </div>
            )}
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
