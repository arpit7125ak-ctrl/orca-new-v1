// frontend/public/sw.js
// ---------------------------------------------------------------------------
// Service Worker for ORCA Web Push & Offline App Shell
// STRICT RULE: NEVER cache /api/ or /internal/ responses!
// ---------------------------------------------------------------------------

const CACHE_NAME = 'orca-app-shell-v1';
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// Install: cache static app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_FILES).catch((err) => {
        console.warn('[SW] App shell caching warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for dynamic navigation, cache-first for static assets.
// NEVER CACHE API CALLS
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude API and health checks
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/internal') || url.pathname.startsWith('/health')) {
    return;
  }

  // Network first for page requests, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache valid static responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification event listener
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'ORCA Maritime Alert Bulletin';
  const options = {
    body: data.body || data.message || 'Metocean boundary or severe weather warning issued.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'orca-alert',
    data: data,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
