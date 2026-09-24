/**
 * ============================================================================
 * Application Entry Point (main.jsx)
 * ============================================================================
 * This is the bootstrap file for the ORCA React frontend application.
 * 
 * Responsibilities:
 * 1. Initialize CSS global design system styles (index.css).
 * 2. Initialize i18next multilingual translation engine (i18n.js).
 * 3. Mount the root React virtual DOM tree inside index.html's #root container.
 * 4. Wrap App in React.StrictMode and the root ErrorBoundary to catch top-level render crashes.
 * 5. Register the Progressive Web App (PWA) Service Worker (/sw.js) for offline caching
 *    and resilience in coastal/maritime low-connectivity environments.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/i18n.js'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Mount React Root onto the DOM element '#root'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Global error boundary catching any uncaught exceptions during render */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register Service Worker for offline capability & asset caching in marine environments
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Graceful notice if service worker is unavailable or blocked by browser permissions
      console.warn('[SW] Registration notice:', err);
    });
  });
}

