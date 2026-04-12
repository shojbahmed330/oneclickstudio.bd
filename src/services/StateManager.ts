import { GenerationMode, GenerationResult, DependencyNode } from "../types";
import { LRUCache } from "../utils/LRUCache";

export class StateManager {
  public lastPromptHash: string = "";
  public fileHashes: Map<string, string> = new Map();
  public dependencyGraphSnapshot: DependencyNode[] = [];
  public lastMode: GenerationMode | null = null;
  public phaseCache: LRUCache<string, any> = new LRUCache<string, any>(50);
  public lastResult: GenerationResult | null = null;
  
  private checkpoints: Record<string, string>[] = [];

  public saveCheckpoint(files: Record<string, string>) {
    this.checkpoints.push({ ...files });
    // Keep only last 10 checkpoints to save memory
    if (this.checkpoints.length > 10) {
      this.checkpoints.shift();
    }
  }

  public rollback(): Record<string, string> | null {
    return this.checkpoints.pop() || null;
  }

  public getLatestCheckpoint(): Record<string, string> | null {
    return this.checkpoints[this.checkpoints.length - 1] || null;
  }

  public clearCheckpoints() {
    this.checkpoints = [];
  }

  public clearCache() {
    this.phaseCache.clear();
    this.lastPromptHash = "";
    this.lastResult = null;
    this.clearCheckpoints();
  }
}
