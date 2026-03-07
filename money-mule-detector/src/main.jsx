import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] React render error:', error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0d1117', color: '#ff4d6d', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '40px', fontFamily: 'monospace'
        }}>
          <div style={{ background: '#161b27', border: '1px solid #ff4d6d', borderRadius: '14px', padding: '32px', maxWidth: '800px', width: '100%' }}>
            <h2 style={{ color: '#00e5ff', marginBottom: '12px', fontSize: '20px' }}>⚡ ThreatVision — Render Error</h2>
            <p style={{ color: '#ff4d6d', fontWeight: 'bold', marginBottom: '16px' }}>
              {this.state.error?.toString()}
            </p>
            <pre style={{ color: '#8892a4', fontSize: '12px', overflow: 'auto', whiteSpace: 'pre-wrap', maxHeight: '300px' }}>
              {this.state.info?.componentStack}
            </pre>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ marginTop: '24px', padding: '10px 20px', background: '#00e5ff', color: '#0d1117', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Clear Data &amp; Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
