import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Service Worker Cleanup: Unregister any existing SWs to prevent origin mismatch errors
// Wrapped in try/catch to handle restricted environments (e.g. iframes) where access is denied
try {
  // Check specifically if the API exists and doesn't throw on access
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(err => console.debug('SW unregister failed:', err));
        }
      })
      .catch(err => console.debug('Service Worker cleanup skipped:', err));
  }
} catch (e) {
  // Silently ignore errors in environments where SW is restricted/invalid
  console.debug('Service Worker API unavailable or restricted:', e);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);