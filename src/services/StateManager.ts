import { GenerationMode, GenerationResult, DependencyNode } from "../types";
import { LRUCache } from "../utils/LRUCache";

export class StateManager {
  public lastPromptHash: string = "";
  public fileHashes: Map<string, string> = new Map();
  public dependencyGraphSnapshot: DependencyNode[] = [];
  public lastMode: GenerationMode | null = null;
  public phaseCache: LRUCache<string, any> = new LRUCache<string, any>(50);
  public lastResult: GenerationResult | null = null;

  public clearCache() {
    this.phaseCache.clear();
    this.lastPromptHash = "";
    this.lastResult = null;
  }
}
