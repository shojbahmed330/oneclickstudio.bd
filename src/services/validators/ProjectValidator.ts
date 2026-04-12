import * as ts from "typescript";
import { ValidatorUtils } from "./ValidatorUtils";

export class ProjectValidator {
  private utils: ValidatorUtils;

  constructor(utils: ValidatorUtils) {
    this.utils = utils;
  }

  public validateFileSizeAndConflicts(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [path, content] of Object.entries(files)) {
      const lines = content.split('\n').length;
      if (lines > 2000) { // Increased limit
        errors.push(`File "${path}" is too large (${lines} lines). Please split it.`);
      }
      if (content.includes('<<<<' + '<<<') || content.includes('====' + '===')) {
        errors.push(`File "${path}" has merge conflict markers.`);
      }
    }
    return errors;
  }

  public validateDirectoryStructure(files: Record<string, string>): string[] {
    const errors: string[] = [];
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.less', '.html'];
    
    for (const fileName of Object.keys(files)) {
      const isSourceFile = sourceExtensions.some(ext => fileName.endsWith(ext));
      const isConfigFile = ['vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'package.json', 'metadata.json', 'firebase-applet-config.json', 'firebase-blueprint.json', 'firestore.rules', 'database.sql', '.eslintrc.cjs', '.eslintrc.js', '.gitignore', 'README.md'].includes(fileName);
      const isRootEntry = ['index.html', 'src/main.tsx', 'src/App.tsx', 'src/index.css', 'src/index.tsx'].includes(fileName);

      if (isSourceFile && !isConfigFile && !isRootEntry) {
        const allowedDirectories = ['src/', 'app/', 'admin/', 'tests/', 'public/'];
        const isInsideAllowedDir = allowedDirectories.some(dir => fileName.startsWith(dir));
        
        if (!isInsideAllowedDir) {
          errors.push(`🚨 CRITICAL ERROR: File "${fileName}" must be placed inside a valid source directory (src/, app/, admin/, tests/, or public/). Root-level clutter causes path confusion.`);
        }
      }
    }
    return errors;
  }

  public validateJSXExtension(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('.ts')) {
        try {
          const sourceFile = ts.createSourceFile(
            path,
            content,
            ts.ScriptTarget.ESNext,
            true,
            ts.ScriptKind.TSX
          );
          let hasJSX = false;
          const checkNode = (node: ts.Node) => {
            if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
              hasJSX = true;
            }
            if (!hasJSX) ts.forEachChild(node, checkNode);
          };
          checkNode(sourceFile);
          if (hasJSX) {
            errors.push(`🚨 CRITICAL ERROR: File "${path}" contains JSX/HTML tags but has a .ts extension. You MUST rename it to .tsx.`);
          }
        } catch (e) {
          if (/(<\w+[^>]*>|<\/\w+>|<\w+\s*\/>|<\s*>|<\/\s*>)/.test(content)) {
            errors.push(`🚨 CRITICAL ERROR: File "${path}" contains JSX/HTML tags but has a .ts extension. You MUST rename it to .tsx.`);
          }
        }
      }
    }
    return errors;
  }

  public validateNoJSFiles(files: Record<string, string>): string[] {
    const errors: string[] = [];
    const allowedJSFiles = [
      'tailwind.config.js',
      'postcss.config.js',
      'vite.config.js',
      'next.config.js',
      'eslint.config.js',
      '.eslintrc.js'
    ];

    for (const fileName of Object.keys(files)) {
      if (fileName.endsWith('.js')) {
        const isAllowedConfig = allowedJSFiles.includes(fileName) || 
                               (fileName.includes('/') === false && fileName.includes('config.js'));
        
        if (!isAllowedConfig) {
          errors.push(`🚨 CRITICAL ERROR: JavaScript file "${fileName}" is not allowed. You MUST use TypeScript (.ts or .tsx). Only common configuration files (like tailwind.config.js) are allowed as .js.`);
        }
      }
      if (fileName.endsWith('.jsx')) {
        errors.push(`🚨 CRITICAL ERROR: JSX file "${fileName}" is not allowed. You MUST use TypeScript (.tsx).`);
      }
    }
    return errors;
  }

  public validateDependencies(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    
    let packageJson: any = null;
    if (allFiles['package.json']) {
      try {
        packageJson = JSON.parse(allFiles['package.json']);
      } catch (e) {
        errors.push(`🚨 CRITICAL ERROR: package.json is invalid JSON.`);
        return errors;
      }
    }

    if (!packageJson) return errors;

    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };

    const builtIns = new Set(['path', 'fs', 'os', 'crypto', 'stream', 'util', 'events', 'buffer', 'process', 'child_process', 'http', 'https', 'url']);

    for (const [path, content] of Object.entries(filesToValidate)) {
      if (!path.endsWith('.ts') && !path.endsWith('.tsx') && !path.endsWith('.js') && !path.endsWith('.jsx')) continue;
      
      const imports = this.utils.extractImports(content);
      for (const imp of imports) {
        if (imp.startsWith('.') || imp.startsWith('@/') || imp.startsWith('/')) continue;
        if (imp.startsWith('http://') || imp.startsWith('https://')) continue;
        
        let packageName = imp;
        if (imp.startsWith('@')) {
          const parts = imp.split('/');
          packageName = parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
        } else {
          packageName = imp.split('/')[0];
        }

        if (builtIns.has(packageName)) continue;
        if (packageName === 'react' || packageName === 'react-dom') continue;

        if (!allDeps[packageName]) {
          errors.push(`🚨 CRITICAL ERROR: You imported "${packageName}" in "${path}", but it is NOT listed in package.json. You MUST add "${packageName}" to the dependencies in package.json to prevent "Module not found" errors. Example: "dependencies": { "${packageName}": "latest", ... }`);
        }
      }
    }
    return errors;
  }

  public validatePlan(plan: any[], currentFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    const createdFiles = new Set<string>();
    
    const getPriority = (text: string): number => {
      const lower = text.toLowerCase();
      if (lower.includes('types.ts') || lower.includes('.types.')) return 1;
      if (lower.includes('utils/') || lower.includes('helpers/') || lower.includes('util') || lower.includes('helper')) return 2;
      if (lower.includes('services/') || lower.includes('api/') || lower.includes('service') || lower.includes('api')) return 3;
      if (lower.includes('components/') || lower.includes('component')) return 4;
      if (lower.includes('pages/') || lower.includes('screens/') || lower.includes('page') || lower.includes('screen')) return 5;
      if (lower.includes('app.tsx') || lower.includes('main.tsx') || lower.includes('routes.') || lower.includes('router')) return 6;
      if (lower.includes('schema.sql') || lower.includes('database.sql')) return 7;
      return 10;
    };

    let lastPriority = 0;

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const title = typeof step === 'object' && step !== null ? (step.title || '') : String(step);
      const subPlans = typeof step === 'object' && step !== null && Array.isArray(step.subPlans) ? step.subPlans : [];
      
      const stepText = title + ' ' + subPlans.join(' ');
      const currentPriority = getPriority(stepText);

      if (currentPriority < lastPriority && currentPriority !== 10) {
        errors.push(`Plan Error: Step ${i + 1} ("${title.substring(0, 50)}...") violates dependency order. It should come before previous steps.`);
      }
      if (currentPriority !== 10) {
        lastPriority = currentPriority;
      }
      
      // Check for file creation/update patterns in title and sub-plans
      const allTexts = [title, ...subPlans];
      for (const text of allTexts) {
        const createMatch = text.match(/CREATE\s+FILE\s+([\w\/\.-\s]+?\.[tj]sx?)/i);
        if (createMatch) {
          const filePath = this.utils.normalizePath(createMatch[1]);
          if (currentFiles[filePath] !== undefined) {
            errors.push(`Plan Error: File to be created '${filePath}' already exists. Use UPDATE instead.`);
          }
          createdFiles.add(filePath);
        }

        const updateMatch = text.match(/UPDATE\s+FILE\s+([\w\/\.-\s]+?\.[tj]sx?)/i);
        if (updateMatch) {
          const filePath = this.utils.normalizePath(updateMatch[1]);
          if (currentFiles[filePath] === undefined && !createdFiles.has(filePath)) {
            errors.push(`Plan Error: File to be updated '${filePath}' does not exist and is not created in a previous step.`);
          }
        }
      }
    }
    return errors;
  }
}
