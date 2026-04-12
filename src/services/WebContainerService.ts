import { WebContainer, FileSystemTree } from '@webcontainer/api';

export class WebContainerService {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;
  private static currentUrl: string | null = null;
  private static onUrlChangeCallback: ((url: string) => void) | null = null;

  public static async boot(): Promise<WebContainer> {
    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = WebContainer.boot().then((webcontainerInstance) => {
      this.instance = webcontainerInstance;
      
      this.instance.on('server-ready', (port, url) => {
        console.log(`WebContainer server ready on port ${port}, url: ${url}`);
        this.currentUrl = url;
        if (this.onUrlChangeCallback) {
          this.onUrlChangeCallback(url);
        }
      });

      return this.instance;
    });

    return this.bootPromise;
  }

  public static onUrlChange(callback: (url: string) => void) {
    this.onUrlChangeCallback = callback;
    if (this.currentUrl) {
      callback(this.currentUrl);
    }
  }

  public static async mountFiles(files: Record<string, string>) {
    const webcontainer = await this.boot();
    const fileSystemTree: FileSystemTree = {};

    for (const [path, content] of Object.entries(files)) {
      const parts = path.split('/').filter(Boolean);
      let currentLevel = fileSystemTree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          currentLevel[part] = {
            file: {
              contents: content,
            },
          };
        } else {
          if (!currentLevel[part]) {
            currentLevel[part] = {
              directory: {},
            };
          }
          currentLevel = (currentLevel[part] as any).directory;
        }
      }
    }

    await webcontainer.mount(fileSystemTree);
  }

  public static async updateFile(path: string, content: string) {
    const webcontainer = await this.boot();
    // Ensure path doesn't start with /
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    
    try {
      await webcontainer.fs.writeFile(normalizedPath, content);
    } catch (e) {
      // If directory doesn't exist, we might need to create it, 
      // but for simplicity we assume mountFiles created the structure
      // or we can just remount everything if it's complex
      console.error(`Failed to update file ${path}`, e);
    }
  }

  public static async runCommand(command: string, args: string[], onOutput?: (data: string) => void) {
    const webcontainer = await this.boot();
    const process = await webcontainer.spawn(command, args);

    if (onOutput) {
      process.output.pipeTo(
        new WritableStream({
          write(data) {
            onOutput(data);
          },
        })
      );
    }

    return process.exit;
  }
}
