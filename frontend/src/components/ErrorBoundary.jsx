/**
 * ============================================================================
 * ORCA Root Error Boundary (src/components/ErrorBoundary.jsx)
 * ============================================================================
 * Standard React Class Error Boundary for top-level runtime exception capture.
 * 
 * Safety Role:
 * - Prevents entire app crashes/blank white screens when malformed network telemetry,
 *   unexpected map rendering states, or Leaflet DOM issues arise.
 * - Displays a localized, high-contrast crash screen with technical error diagnostics
 *   and an instantaneous "Reload Application" action button.
 */

import React from 'react';
import i18next from 'i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Top-Level Error Boundary Component.
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  /**
   * Updates state so the next render will show the fallback UI.
   * @param {Error} error - Caught runtime exception.
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Lifecycle invoked after an error has been thrown by a descendant component.
   * @param {Error} error - Thrown error.
   * @param {React.ErrorInfo} errorInfo - Component stack trace information.
   */
  componentDidCatch(error, errorInfo) {
    console.error('ORCA Frontend caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  /** Reloads the browser window to recover clean state */
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
