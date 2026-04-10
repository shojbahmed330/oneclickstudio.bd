import { DependencyNode } from "../types";
import { DiffEngine } from "./DiffEngine";
import { Validator } from "./Validator";

export class DependencyManager {
  private dependencyGraph: DependencyNode[] = [];
  private dependencyNodeCache = new Map<string, { hash: string, node: DependencyNode }>();
  private diffEngine: DiffEngine;
  private validator: Validator;

  constructor(diffEngine: DiffEngine, validator: Validator) {
    this.diffEngine = diffEngine;
    this.validator = validator;
  }

  public getGraph(): DependencyNode[] {
    return this.dependencyGraph;
  }

  public updateDependencyGraph(files: Record<string, string>) {
    const currentFilePaths = new Set(Object.keys(files));

    // Remove deleted files from cache
    for (const path of this.dependencyNodeCache.keys()) {
      if (!currentFilePaths.has(path)) {
        this.dependencyNodeCache.delete(path);
      }
    }

    // Update changed/new files
    for (const [filePath, content] of Object.entries(files)) {
      const hash = this.diffEngine.hashContent(content);
      const cached = this.dependencyNodeCache.get(filePath);

      if (!cached || cached.hash !== hash) {
        const rawImports = this.validator.extractImports(content);
        const resolvedImports: string[] = [];

        for (const imp of rawImports) {
          const resolved = this.validator.resolveImportPath(filePath, imp, files);
          if (resolved) resolvedImports.push(resolved);
        }

        const node: DependencyNode = { 
          file: this.validator.normalizePath(filePath), 
          imports: resolvedImports,
          tablesUsed: this.extractTables(content),
          apisUsed: this.extractAPIs(content),
          servicesUsed: this.extractServices(content)
        };

        this.dependencyNodeCache.set(filePath, { hash, node });
      }
    }

    this.dependencyGraph = Array.from(this.dependencyNodeCache.values()).map(x => x.node);
  }

  private extractTables(content: string): string[] {
    const tables = new Set<string>();
    const sqlRegex = /(?:from|update|into)\s+([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = sqlRegex.exec(content)) !== null) {
      const table = match[1].toLowerCase();
      if (!['select', 'where', 'set', 'values'].includes(table)) {
        tables.add(table);
      }
    }
    const supabaseRegex = /\.from(?:<[^>]+>)?\(['"]([a-zA-Z0-9_]+)['"]\)/g;
    while ((match = supabaseRegex.exec(content)) !== null) {
      tables.add(match[1]);
    }
    return Array.from(tables);
  }

  private extractAPIs(content: string): string[] {
    const apis = new Set<string>();
    const apiRegex = /(?:fetch|axios\.(?:get|post|put|delete|patch))\(['"]([^'"]+)['"]/g;
    let match;
    while ((match = apiRegex.exec(content)) !== null) {
      apis.add(match[1]);
    }
    return Array.from(apis);
  }

  private extractServices(content: string): string[] {
    const services = new Set<string>();
    const serviceRegex = /\b(use[A-Z]\w+Service|get[A-Z]\w+|[a-zA-Z0-9_]+Service)\b/g;
    let match;
    while ((match = serviceRegex.exec(content)) !== null) {
      services.add(match[1]);
    }
    return Array.from(services);
  }
}
