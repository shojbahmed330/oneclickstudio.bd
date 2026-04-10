
import { GeminiService } from "./geminiService";
import { GenerationMode, GenerationResult, WorkspaceType, DependencyNode, AIProvider } from "../types";
import { DiffEngine } from "./DiffEngine";

import { Logger } from "./Logger";
import { LRUCache } from "../utils/LRUCache";
import { ProjectMapGenerator } from "../utils/projectMap";

export class Orchestrator {
  private ai: AIProvider;
  private diffEngine: DiffEngine;
  private projectMapGenerator: ProjectMapGenerator;

  constructor(diffEngine: DiffEngine, ai?: AIProvider) {
    this.ai = ai || new GeminiService();
    this.diffEngine = diffEngine;
    this.projectMapGenerator = new ProjectMapGenerator();
  }

  public async executePhaseWithCache(
    phase: 'planning' | 'coding' | 'review' | 'security' | 'performance' | 'uiux',
    input: string,
    modelName: string,
    phaseCache: LRUCache<string, any>,
    skipCache: boolean = false,
    projectConfig?: any
  ): Promise<any> {
    const inputHash = this.diffEngine.hashContent(input);
    const phaseKey = `${phase}-${inputHash}`;
    if (!skipCache && phaseCache.has(phaseKey)) {
      Logger.info(`Cache hit for phase: ${phase}`, { component: 'Orchestrator', phase });
      return phaseCache.get(phaseKey);
    }
    
    let result = await this.ai.callPhase(phase, input, modelName, 3, projectConfig);
    
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch (parseError) {
        Logger.warn(`Failed to parse JSON from phase ${phase}. Attempting repair...`, { component: 'Orchestrator', phase }, parseError);
        try {
          let repaired = result.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
          result = JSON.parse(repaired);
        } catch (repairError) {
          Logger.error(`JSON repair failed for phase ${phase}. Returning raw result.`, repairError, { component: 'Orchestrator', phase });
          throw new Error(`Invalid JSON returned by AI in phase ${phase}: ${repairError}`);
        }
      }
    }
    
    phaseCache.set(phaseKey, result);
    return result;
  }

  public decidePhases(mode: GenerationMode, changedFiles: string[]): string[] {
    let phases: string[] = [];

    if (mode === GenerationMode.SCAFFOLD) {
      phases = ["planning", "coding", "review"];
    } else if (mode === GenerationMode.EDIT) {
      // For EDIT mode, we include planning to allow the AI to be proactive with new features
      phases = ["planning", "coding", "review"];
    } else if (mode === GenerationMode.FIX) {
      phases = ["review", "coding"];
    } else if (mode === GenerationMode.OPTIMIZE) {
      phases = ["performance", "uiux"];
    }

    return [...new Set(phases)];
  }

  public buildPhaseInput(
    phase: 'planning' | 'coding' | 'review' | 'security' | 'performance' | 'uiux',
    prompt: string,
    files: Record<string, string>,
    dependencyGraph: DependencyNode[],
    activeWorkspace?: any,
    projectConfig?: any
  ): string {
    return `PHASE: ${phase.toUpperCase()}\nUSER REQUEST: ${prompt}\n\nCONTEXT:\n${this.buildContext(files, dependencyGraph, prompt, projectConfig)}`;
  }

  public buildContext(files: Record<string, string>, dependencyGraph: DependencyNode[], prompt?: string, projectConfig?: any): string {
    let impactWarning = "";
    const contextSet = new Set<string>();

    if (prompt) {
      const impacted = this.analyzeImpact(prompt, dependencyGraph);
      const mentioned = this.detectMentionedFiles(prompt, files);
      
      impacted.forEach(f => contextSet.add(f));
      mentioned.forEach(f => contextSet.add(f));

      if (impacted.length > 0) {
        impactWarning = `\n\n⚠️ ACTIVE IMPACT ANALYSIS:\nBased on your request, the following files are structurally dependent and MUST be reviewed/updated to prevent breaking changes:\n${impacted.map(f => `- ${f}`).join('\n')}`;
      }
    }

    for (const node of dependencyGraph) {
      if (contextSet.has(node.file)) {
        node.imports.forEach(imp => {
          if (files[imp]) contextSet.add(imp);
        });
      }
    }

    const allFilePaths = Object.keys(files);
    const directoryTree = this.projectMapGenerator.generateDirectoryTree(allFilePaths);

    const filesToInclude = contextSet.size > 0 ? Array.from(contextSet) : allFilePaths;
    const MAX_FILES = 20;
    const selectedFiles = filesToInclude.slice(0, MAX_FILES);

    let contextText = "";
    for (const path of selectedFiles) {
      const content = files[path];
      if (!content) continue;

      if (content.length > 5000) {
        const signature = this.projectMapGenerator.generateFileSignature(path, content);
        contextText += `\nFILE: ${path}\nSIGNATURE (Large File):\n${JSON.stringify(signature, null, 2)}\n`;
      } else {
        contextText += `\nFILE: ${path}\n${content}\n`;
      }
    }
    
    const graphContext = this.projectMapGenerator.generateDependencyMap(dependencyGraph);
    const configContext = projectConfig ? `\n\nPROJECT CONFIGURATION:\n${JSON.stringify(projectConfig, null, 2)}` : '';
    
    return `<project_map>\nDIRECTORY TREE:\n${directoryTree}\n\n${graphContext}\n</project_map>${impactWarning}\n\nRELEVANT FILES ONLY:\n${contextText}${configContext}`;
  }

  public analyzeImpact(prompt: string, dependencyGraph: DependencyNode[]): string[] {
    const impactedFiles = new Set<string>();
    const lowerPrompt = prompt.toLowerCase();

    // Semantic Mapping for better impact detection
    const semanticMap: Record<string, string[]> = {
      'auth': ['users', 'profiles', 'auth', 'login', 'signup'],
      'login': ['users', 'auth'],
      'signup': ['users', 'profiles', 'auth'],
      'user': ['users', 'profiles', 'settings'],
      'payment': ['orders', 'transactions', 'payments', 'subscriptions'],
      'order': ['orders', 'products', 'cart'],
      'product': ['products', 'inventory', 'categories'],
      'chat': ['messages', 'conversations', 'notifications'],
      'notification': ['notifications', 'users']
    };

    const mentionedTables = new Set<string>();
    const mentionedServices = new Set<string>();

    // Check for direct table mentions
    for (const node of dependencyGraph) {
      for (const table of node.tablesUsed) {
        if (lowerPrompt.includes(table.toLowerCase())) mentionedTables.add(table);
      }
      for (const service of node.servicesUsed) {
        if (lowerPrompt.includes(service.toLowerCase())) mentionedServices.add(service);
      }
    }

    // Check for semantic keywords
    for (const [keyword, relatedTables] of Object.entries(semanticMap)) {
      if (lowerPrompt.includes(keyword)) {
        relatedTables.forEach(t => mentionedTables.add(t));
      }
    }

    const directImpactFiles = new Set<string>();
    for (const node of dependencyGraph) {
      const usesMentionedTable = node.tablesUsed.some(t => mentionedTables.has(t) || mentionedTables.has(t.toLowerCase()));
      const usesMentionedService = node.servicesUsed.some(s => mentionedServices.has(s) || mentionedServices.has(s.toLowerCase()));
      
      if (usesMentionedTable || usesMentionedService) {
        directImpactFiles.add(node.file);
        impactedFiles.add(node.file);
      }
    }

    // Recursive reverse dependency check (up to 3 levels deep)
    let currentLevelImpact = new Set(directImpactFiles);
    
    for (let i = 0; i < 3; i++) {
      const nextLevelImpact = new Set<string>();
      for (const node of dependencyGraph) {
        // If this file imports something that is already impacted
        const importsImpactedFile = node.imports.some(imp => currentLevelImpact.has(imp));
        if (importsImpactedFile) {
          nextLevelImpact.add(node.file);
          impactedFiles.add(node.file);
        }
      }
      
      // If no new files found, stop early
      if (nextLevelImpact.size === 0) break;
      
      // Add new findings to current level for next iteration
      nextLevelImpact.forEach(f => currentLevelImpact.add(f));
    }

    return Array.from(impactedFiles);
  }

  public detectMentionedFiles(prompt: string, files: Record<string, string>): string[] {
    const lowerPrompt = prompt.toLowerCase();
    return Object.keys(files).filter(f => {
      const fileName = f.split('/').pop()?.toLowerCase() || "";
      return lowerPrompt.includes(f.toLowerCase()) || (fileName && lowerPrompt.includes(fileName));
    });
  }
}
