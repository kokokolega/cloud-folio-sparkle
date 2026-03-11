const CACHE_NAME = 'oltrid-v1';
const STATIC_CACHE = 'oltrid-static-v1';
const API_CACHE = 'oltrid-api-v1';
const USER_CACHE = 'oltrid-user-v1';

// Cache static assets - cache first strategy
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/src/App.tsx',
  '/manifest.json'
];

// API endpoints to cache - network first with fallback
const API_ENDPOINTS = [
  '/functions/v1/ai-assistant',
  '/rest/v1/notes',
  '/rest/v1/ai_conversations',
  '/rest/v1/ai_messages',
  '/rest/v1/groups',
  '/rest/v1/files'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE && cacheName !== USER_CACHE) {
              console.log('Service Worker: Clearing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle different caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle static assets - cache first
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Handle API calls - network first with cache fallback
  if (isApiCall(request.url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Handle user data - stale while revalidate
  if (isUserData(request.url)) {
    event.respondWith(staleWhileRevalidate(request, USER_CACHE));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request, API_CACHE));
});

// Cache strategies
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Cache first failed:', error);
    throw error;
  }
}

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
  
  // Fetch in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  // Return cached version immediately, or wait for network
  return cached || fetchPromise;
}

// Helper functions
function isStaticAsset(url) {
  return url.includes('/src/') || 
         url.includes('/assets/') || 
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

// Background sync for queued operations
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sync event triggered:', event.tag);
  
  if (event.tag === 'sync-offline-operations') {
    event.waitUntil(syncOfflineOperations());
  }
});

async function syncOfflineOperations() {
  try {
    // Get queued operations from IndexedDB
    const operations = await getQueuedOperations();
    
    for (const operation of operations) {
      try {
        await processOperation(operation);
        await removeQueuedOperation(operation.id);
      } catch (error) {
        console.error('Failed to process operation:', operation, error);
      }
    }
    
    // Notify clients about sync completion
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

// IndexedDB helpers for offline queue
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

// Push notifications (optional - for future use)
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

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
