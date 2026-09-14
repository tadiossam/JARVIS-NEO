// Service Worker Disabled for Preview Stability
// This file is kept as a placeholder to prevent 404s if the browser attempts to fetch it from a previous registration.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
