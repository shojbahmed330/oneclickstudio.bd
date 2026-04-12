const PREVIEW_ORIGIN = 'https://preview.local';
const CACHE_NAME = 'preview-cache-v1';
let lastActiveClientId = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FILES_UPDATED') {
    lastActiveClientId = event.source.id;
    console.log('Service Worker: Files updated, tracking client:', lastActiveClientId);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. Intercept requests for our virtual preview domain
  if (url.origin === PREVIEW_ORIGIN || url.pathname.startsWith('/__preview/')) {
    event.respondWith(handlePreviewRequest(event.request));
    return;
  }

  // 2. Inject COOP/COEP headers for ALL other requests (to enable WebContainers)
  if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 0 || !response.ok) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      })
      .catch(e => {
        // Fallback for failed fetches
        return fetch(event.request);
      })
  );
});

async function handlePreviewRequest(request) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // Remove the prefix if present
  if (path.startsWith('/__preview/')) {
    path = path.replace('/__preview/', '/');
  }
  
  if (path === '/' || path === '') {
    path = '/index.html';
  }
 
  // Communicate with the main thread to get the file content
  let client = null;
  if (lastActiveClientId) {
    client = await clients.get(lastActiveClientId);
  }
  
  if (!client) {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    client = clientList[0];
  }
  
  return new Promise((resolve) => {
    if (!client) {
      resolve(new Response('Preview environment not found. Please ensure the main editor tab is open.', { status: 503 }));
      return;
    }

    // We'll use the selected client to fetch the file from memory
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data && event.data.content !== undefined) {
        const contentType = getContentType(path);
        resolve(new Response(event.data.content, {
          headers: { 
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }));
      } else {
        resolve(new Response('File not found: ' + path, { status: 404 }));
      }
    };

    client.postMessage({
      type: 'GET_FILE',
      path: path.startsWith('/') ? path.slice(1) : path
    }, [channel.port2]);
  });
}

function getContentType(path) {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
}
