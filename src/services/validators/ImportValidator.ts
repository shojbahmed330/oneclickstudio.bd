import { DependencyNode } from "../../types";
import { ValidatorUtils } from "./ValidatorUtils";

export class ImportValidator {
  private utils: ValidatorUtils;

  constructor(utils: ValidatorUtils) {
    this.utils = utils;
  }

  public validateImports(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];

    for (const [path, content] of Object.entries(filesToValidate)) {
      const imports = this.utils.extractImports(content);
      for (const imp of imports) {
        if (imp.startsWith('.') || imp.startsWith('@/')) {
          const resolved = this.utils.resolveImportPath(path, imp, allFiles);
          if (!resolved) {
            const caseInsensitiveMatch = this.utils.resolveImportPathCaseInsensitive(path, imp, allFiles);
            if (caseInsensitiveMatch) {
              errors.push(`🚨 CRITICAL ERROR: Case sensitivity mismatch in import "${imp}" in file "${path}". You imported it with wrong casing. The actual file is "${caseInsensitiveMatch}". Linux/Vercel deployments will fail. Please fix the import casing to match the exact file name.`);
            } else {
              errors.push(`🚨 CRITICAL ERROR: Missing import target "${imp}" in file "${path}". You referenced this file but it does not exist in the project. You MUST create this missing file or fix the import path. Check if you forgot to create the file or if you made a typo.`);
            }
          }
        }
      }
    }
    return errors;
  }

  public validateDefaultImportCompatibility(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];

    for (const [path, content] of Object.entries(filesToValidate)) {
      const defaultImports = this.utils.extractDefaultImports(content);

      for (const imp of defaultImports) {
        if (!imp.specifier.startsWith('.') && !imp.specifier.startsWith('@/')) continue;

        const resolved = this.utils.resolveImportPath(path, imp.specifier, allFiles);
        if (!resolved) continue;

        const target = allFiles[resolved];
        if (!target) continue;

        const hasDefaultExport =
          /export\s+default\s+/m.test(target) ||
          /export\s*\{[^}]*\bas\s+default\b[^}]*\}/m.test(target);

        if (!hasDefaultExport) {
          errors.push(
            `🚨 CRITICAL ERROR: Default import mismatch in "${path}". You imported "${imp.localName}" as default from "${imp.specifier}", but "${resolved}" has no default export. You MUST use a named import (e.g., import { ${imp.localName} } from "${imp.specifier}").`
          );
        }
      }
    }

    return errors;
  }

  public validateExportConsistency(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [path, content] of Object.entries(filesToValidate)) {
      const imports = this.utils.extractNamedImports(content);
      for (const imp of imports) {
        if (!imp.specifier.startsWith('.') && !imp.specifier.startsWith('@/')) continue;
        
        const resolved = this.utils.resolveImportPath(path, imp.specifier, allFiles);
        if (!resolved) continue;

        const targetContent = allFiles[resolved];
        if (!targetContent) continue;

        for (const name of imp.names) {
          const exportRegex = new RegExp(`export\\s+(?:const|let|var|function|class|type|interface|enum)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}|export\\s*\\*\\s*from`, 'm');
          if (!exportRegex.test(targetContent)) {
            errors.push(`🚨 CRITICAL ERROR: Named import mismatch in "${path}". You imported "${name}" from "${imp.specifier}", but "${resolved}" does not export it. You MUST ensure the target file has a named export for "${name}".`);
          }
        }
      }
    }
    return errors;
  }

  public detectCircularDependencies(dependencyGraph: DependencyNode[]): string[] {
    const errors: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeFile: string, path: string[]) => {
      visited.add(nodeFile);
      recursionStack.add(nodeFile);

      const node = dependencyGraph.find(n => n.file === nodeFile);
      if (node) {
        for (const imp of node.imports) {
          const targetNode = dependencyGraph.find(n => n.file === imp);
          
          if (targetNode) {
            if (!visited.has(targetNode.file)) {
              dfs(targetNode.file, [...path, targetNode.file]);
            } else if (recursionStack.has(targetNode.file)) {
              errors.push(`Circular dependency detected: ${path.join(' -> ')} -> ${targetNode.file}`);
            }
          }
        }
      }
      recursionStack.delete(nodeFile);
    };

    for (const node of dependencyGraph) {
      if (!visited.has(node.file)) {
        dfs(node.file, [node.file]);
      }
    }
    return errors;
  }

  public validateZustandImports(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [path, content] of Object.entries(files)) {
      // Detect default import from zustand: import create from 'zustand'
      if (content.match(/import\s+[A-Za-z_$][\w$]*\s+from\s+['"]zustand['"]/)) {
        errors.push(`🚨 CRITICAL ERROR: Default import from "zustand" in "${path}". Zustand 5+ does not have a default export. Use \`import { create } from 'zustand'\` instead.`);
      }
      // Detect absolute esm.sh imports with versions
      if (content.match(/import\s+.*\s+from\s+['"]https:\/\/esm\.sh\/zustand@5/)) {
        errors.push(`🚨 CRITICAL ERROR: Absolute versioned import from esm.sh in "${path}". Please use the package name "zustand" instead.`);
      }
    }
    return errors;
  }

  public validatePathAliases(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    let usesAlias = false;

    for (const [path, content] of Object.entries(filesToValidate)) {
      if (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.jsx')) {
        if (content.match(/import\s+.*\s+from\s+['"]@\//) || content.match(/import\s+['"]@\//)) {
          usesAlias = true;
          break;
        }
      }
    }

    if (usesAlias) {
      const viteConfig = allFiles['vite.config.ts'] || allFiles['vite.config.js'];
      if (!viteConfig || !viteConfig.includes('resolve') || !viteConfig.includes('alias')) {
        errors.push(`🚨 CRITICAL ERROR: You used the "@/" path alias in your imports, but it is NOT configured in "vite.config.ts". You MUST create or update "vite.config.ts" to include the alias configuration (e.g., resolve: { alias: { "@": path.resolve(__dirname, "./src") } }).`);
      }

      let tsConfig = allFiles['tsconfig.json'];
      let tsConfigApp = allFiles['tsconfig.app.json'];
      let hasValidConfig = false;
      let hasInvalidJson = false;

      const checkConfig = (configStr: string) => {
        try {
          const cleanConfig = configStr.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
          const parsed = JSON.parse(cleanConfig);
          const compilerOptions = parsed.compilerOptions || {};
          if (compilerOptions.baseUrl && compilerOptions.paths && compilerOptions.paths['@/*']) {
            return true;
          }
        } catch (e) {
          hasInvalidJson = true;
        }
        return false;
      };

      if (tsConfig && checkConfig(tsConfig)) hasValidConfig = true;
      if (tsConfigApp && checkConfig(tsConfigApp)) hasValidConfig = true;

      if (!hasValidConfig) {
        if (hasInvalidJson) {
           errors.push(`🚨 CRITICAL ERROR: "tsconfig.json" contains invalid JSON. Please fix it.`);
        } else {
           errors.push(`🚨 CRITICAL ERROR: You used the "@/" path alias in your imports, but it is NOT configured in "tsconfig.json" or "tsconfig.app.json". You MUST update it to include "baseUrl": "." and "paths": { "@/*": ["./src/*"] } in compilerOptions.`);
        }
      }
    }

    return errors;
  }
}
