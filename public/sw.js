const CACHE_VERSION = 'oltrid-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const USER_CACHE = `${CACHE_VERSION}-user`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

const API_ENDPOINTS = [
  '/functions/v1/ai-assistant',
  '/rest/v1/notes',
  '/rest/v1/ai_conversations',
  '/rest/v1/ai_messages',
  '/rest/v1/groups',
  '/rest/v1/files'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(
          STATIC_ASSETS.map((url) => cache.add(url))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.startsWith(CACHE_VERSION)) {
              console.log('Service Worker: Clearing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  if (isApiCall(request.url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (isUserData(request.url)) {
    event.respondWith(staleWhileRevalidate(request, USER_CACHE));
    return;
  }

  if (isStaticAsset(request.url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, STATIC_CACHE));
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      if (cached) return cached;
      throw error;
    });

  return cached || fetchPromise;
}

function isStaticAsset(url) {
  return url.includes('/assets/') ||
         url.endsWith('.css') ||
         url.endsWith('.js') ||
         url.endsWith('.png') ||
         url.endsWith('.jpg') ||
         url.endsWith('.svg') ||
         url.endsWith('.ico');
}

function isApiCall(url) {
  return API_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

function isUserData(url) {
  return url.includes('/rest/v1/') && !isApiCall(url);
}

self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sync event triggered:', event.tag);

  if (event.tag === 'sync-offline-operations') {
    event.waitUntil(syncOfflineOperations());
  }
});

async function syncOfflineOperations() {
  try {
    const operations = await getQueuedOperations();

    for (const operation of operations) {
      try {
        await processOperation(operation);
        await removeQueuedOperation(operation.id);
      } catch (error) {
        console.error('Failed to process operation:', operation, error);
      }
    }

    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        timestamp: Date.now()
      });
    });

  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function getQueuedOperations() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('oltrid-offline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['operations'], 'readonly');
      const store = transaction.objectStore('operations');
      const getAll = store.getAll();

      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('operations')) {
        db.createObjectStore('operations', { keyPath: 'id' });
      }
    };
  });
}

async function removeQueuedOperation(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('oltrid-offline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const deleteOp = store.delete(id);

      deleteOp.onsuccess = () => resolve();
      deleteOp.onerror = () => reject(deleteOp.error);
    };
  });
}

async function processOperation(operation) {
  const { method, url, data, headers } = operation;

  const options = {
    method,
    headers: headers || {}
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
    options.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Operation failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received');

  const options = {
    body: event.data ? event.data.text() : 'New notification from Oltrid',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Oltrid', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
