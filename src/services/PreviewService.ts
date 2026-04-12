export class PreviewService {
  private static swRegistration: ServiceWorkerRegistration | null = null;
  private static files: Record<string, string> = {};

  public static async init() {
    if ('serviceWorker' in navigator) {
      try {
        // Check if we need to reload for COOP/COEP
        if (window.crossOriginIsolated === false && !sessionStorage.getItem('coi-reloaded')) {
          console.log('Enabling COOP/COEP headers via Service Worker...');
        }

        this.swRegistration = await navigator.serviceWorker.register('/preview-sw.js', {
          scope: '/'
        });
        console.log('Preview Service Worker registered');

        // Handle controller change for COOP/COEP reload
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (window.crossOriginIsolated === false && !sessionStorage.getItem('coi-reloaded')) {
            sessionStorage.setItem('coi-reloaded', 'true');
            window.location.reload();
          }
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'GET_FILE') {
            const path = event.data.path;
            const content = this.files[path] || this.files[`/${path}`];
            
            event.ports[0].postMessage({
              content: content
            });
          }
        });
      } catch (error) {
        console.error('Preview Service Worker registration failed:', error);
      }
    }
  }

  public static updateFiles(files: Record<string, string>) {
    this.files = files;
    // Notify Service Worker that files have been updated
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'FILES_UPDATED',
        count: Object.keys(files).length
      });
    }
  }

  public static getPreviewUrl(path: string = 'index.html'): string {
    // We use a path-based approach that the SW intercepts
    return `${window.location.origin}/__preview/${path}`;
  }
}
