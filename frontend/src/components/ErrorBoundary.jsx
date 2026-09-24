import React from 'react';
import i18next from 'i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ORCA Frontend caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const t = i18next.t.bind(i18next);
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-rose-950 text-rose-400 border border-rose-700/60 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">{t('error.boundaryTitle', { ns: 'ui' })}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {t('error.boundarySubtitle', { ns: 'ui' })}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-left text-xs font-mono text-rose-300 overflow-x-auto max-h-40">
              {this.state.error?.toString() || t('error.unknownRuntime', { ns: 'ui' })}
            </div>

            <button
              onClick={this.handleReload}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t('error.reloadButton', { ns: 'ui' })}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
