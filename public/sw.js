const CACHE_VERSION = 'hf-chat-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const HTML_CACHE = `${CACHE_VERSION}-html`;

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
];

// Cache-first: static assets (CSS, JS, fonts, images)
const STATIC_EXTENSIONS = [
  '.css', '.js', '.woff', '.woff2', '.ttf', '.otf',
  '.eot', '.svg', '.png', '.jpg', '.jpeg', '.gif',
  '.ico', '.webp', '.avif',
];

// Network-first: API paths
const API_PATHS = [
  '/api/',
];

// Install: precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches and claim clients
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, HTML_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper: check if URL is a static asset
function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

// Helper: check if URL is an API call
function isApiCall(url) {
  return API_PATHS.some((path) => url.pathname.startsWith(path));
}

// Helper: check if request is a navigation (HTML) request
function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('Accept') || '').includes('text/html');
}

// Strategy: Cache-first for static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return a basic offline response for failed static assets
    return new Response('', {
      status: 408,
      statusText: 'Request timeout',
    });
  }
}

// Strategy: Network-first for API calls
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'أنت غير متصل بالإنترنت' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}

// Strategy: Stale-while-revalidate for HTML pages
async function staleWhileRevalidate(request) {
  const cache = await caches.open(HTML_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    // If network fails and we have no cache, return a minimal offline page
    if (!cached) {
      return new Response(
        `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HF Space Chat - غير متصل</title>
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
.box{padding:2rem}h1{color:#f97316;margin-bottom:0.5rem}p{opacity:0.7}</style></head>
<body><div class="box"><h1>غير متصل بالإنترنت</h1><p>تحقق من اتصالك وحاول مرة أخرى</p></div></body>
</html>`,
        {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }
    return cached;
  });

  // Return cached version immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// Fetch handler: route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  let strategy;

  if (isApiCall(url)) {
    strategy = networkFirst(request);
  } else if (isHtmlRequest(request)) {
    strategy = staleWhileRevalidate(request);
  } else if (isStaticAsset(url)) {
    strategy = cacheFirst(request);
  } else {
    // Default: network-first for anything else
    strategy = networkFirst(request);
  }

  event.respondWith(strategy);
});
