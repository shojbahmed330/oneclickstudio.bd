export class PreviewService {
  private static swRegistration: ServiceWorkerRegistration | null = null;
  private static files: Record<string, string> = {};

  public static async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/preview-sw.js', {
          scope: '/'
        });
        console.log('Preview Service Worker registered');

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
  }

  public static getPreviewUrl(path: string = 'index.html'): string {
    // We use a path-based approach that the SW intercepts
    return `${window.location.origin}/__preview/${path}`;
  }
}
