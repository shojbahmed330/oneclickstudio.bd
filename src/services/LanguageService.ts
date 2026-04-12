
export class LanguageService {
  private static instance: LanguageService;
  private worker: Worker;
  private pendingRequests: Map<string, (res: any) => void> = new Map();
  private requestId = 0;

  private constructor() {
    this.worker = new Worker(new URL('./LanguageService.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      const { id, payload } = e.data;
      const resolve = this.pendingRequests.get(id);
      if (resolve) {
        resolve(payload);
        this.pendingRequests.delete(id);
      }
    };
  }

  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  private sendRequest(type: string, payload: any): Promise<any> {
    const id = (this.requestId++).toString();
    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve);
      this.worker.postMessage({ id, type, payload });
    });
  }

  public async updateVFS(files: Record<string, string>): Promise<void> {
    await this.sendRequest('updateVFS', files);
  }

  public async validateFiles(filesToValidate: string[]): Promise<string[]> {
    return await this.sendRequest('validateFiles', filesToValidate);
  }
}
