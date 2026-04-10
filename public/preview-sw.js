const PREVIEW_ORIGIN = 'https://preview.local';
const CACHE_NAME = 'preview-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only intercept requests for our virtual domain
  if (url.origin === PREVIEW_ORIGIN || url.pathname.startsWith('/__preview/')) {
    event.respondWith(handlePreviewRequest(event.request));
  }
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
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  return new Promise((resolve) => {
    if (clientList.length === 0) {
      resolve(new Response('Preview environment not found', { status: 503 }));
      return;
    }

    // We'll use the first available client to fetch the file from memory
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data && event.data.content !== undefined) {
        const contentType = getContentType(path);
        resolve(new Response(event.data.content, {
          headers: { 'Content-Type': contentType }
        }));
      } else {
        resolve(new Response('File not found', { status: 404 }));
      }
    };

    clientList[0].postMessage({
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
