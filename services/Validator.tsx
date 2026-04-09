
import * as ts from "typescript";
import { createSystem, createVirtualCompilerHost } from '@typescript/vfs';
import { DependencyNode } from "../types";

export class Validator {
  private resolveCache = new Map<string, string | null>();

  public validateOutput(filesToValidate: Record<string, string>, allFiles: Record<string, string>, dependencyGraph: DependencyNode[], prompt: string = ""): string[] {
    const errors: string[] = [];
    errors.push(...this.validateFileSizeAndConflicts(filesToValidate));
    // Pass both the files to validate AND the full project context
    errors.push(...this.validateImports(filesToValidate, allFiles));
    errors.push(...this.validateDefaultImportCompatibility(filesToValidate, allFiles));
    errors.push(...this.validateTypeScriptSyntax(filesToValidate));
    errors.push(...this.validateTypeScriptTypes(filesToValidate, allFiles));
    errors.push(...this.detectCircularDependencies(dependencyGraph));
    errors.push(...this.validateReactKeys(filesToValidate));
    errors.push(...this.validateForbiddenPatterns(filesToValidate));
    errors.push(...this.validateZustandImports(filesToValidate));
    errors.push(...this.validateDependencies(filesToValidate, allFiles));
    errors.push(...this.validatePathAliases(filesToValidate, allFiles));
    errors.push(...this.validateUseEffect(filesToValidate));
    errors.push(...this.validateRouterWrapping(filesToValidate, allFiles));
    errors.push(...this.validateMockDataEnforcement(filesToValidate, prompt));
    errors.push(...this.validateExportConsistency(filesToValidate, allFiles));
    errors.push(...this.validateDirectoryStructure(filesToValidate));
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
      
      const imports = this.extractImports(content);
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
          errors.push(`🚨 CRITICAL ERROR: You imported "${packageName}" in "${path}", but it is NOT listed in package.json. You MUST add "${packageName}" to the dependencies in package.json to prevent "Module not found" errors.`);
        }
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

  public validateRouterWrapping(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    let usesRouter = false;

    // Check if react-router-dom is used in any of the files being validated
    for (const content of Object.values(filesToValidate)) {
      if (content.includes('react-router-dom')) {
        usesRouter = true;
        break;
      }
    }

    // Also check if react-router-dom is in package.json
    if (!usesRouter && allFiles['package.json']) {
      try {
        const pkg = JSON.parse(allFiles['package.json']);
        if (pkg.dependencies && pkg.dependencies['react-router-dom']) {
          usesRouter = true;
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    if (usesRouter) {
      const mainFiles = ['src/main.tsx', 'src/main.jsx', 'src/App.tsx', 'src/App.jsx'];
      let hasRouterWrapper = false;

      for (const fileName of mainFiles) {
        const content = allFiles[fileName] || filesToValidate[fileName];
        if (!content) continue;

        try {
          const sourceFile = ts.createSourceFile(
            fileName,
            content,
            ts.ScriptTarget.ESNext,
            true,
            fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
          );

          const routerAliases = new Set<string>();

          // Find imports from react-router-dom
          const findImports = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
              if (node.moduleSpecifier.text === 'react-router-dom') {
                const importClause = node.importClause;
                if (importClause && importClause.namedBindings) {
                  if (ts.isNamedImports(importClause.namedBindings)) {
                    importClause.namedBindings.elements.forEach(element => {
                      const name = element.propertyName ? element.propertyName.text : element.name.text;
                      if (['BrowserRouter', 'HashRouter', 'MemoryRouter', 'RouterProvider'].includes(name)) {
                        routerAliases.add(element.name.text);
                      }
                    });
                  } else if (ts.isNamespaceImport(importClause.namedBindings)) {
                    routerAliases.add(importClause.namedBindings.name.text);
                  }
                }
              }
            }
            ts.forEachChild(node, findImports);
          };
          findImports(sourceFile);

          // If we found router imports, check if they are used as JSX tags
          if (routerAliases.size > 0) {
            const findJsxTags = (node: ts.Node) => {
              if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tagName = node.tagName;
                if (ts.isIdentifier(tagName) && routerAliases.has(tagName.text)) {
                  hasRouterWrapper = true;
                } else if (ts.isPropertyAccessExpression(tagName)) {
                  if (ts.isIdentifier(tagName.expression) && routerAliases.has(tagName.expression.text)) {
                    if (['BrowserRouter', 'HashRouter', 'MemoryRouter', 'RouterProvider'].includes(tagName.name.text)) {
                      hasRouterWrapper = true;
                    }
                  }
                }
              }
              if (!hasRouterWrapper) {
                ts.forEachChild(node, findJsxTags);
              }
            };
            findJsxTags(sourceFile);
          }
        } catch (e) {
          // Ignore parser crash
        }

        if (hasRouterWrapper) break;
      }

      if (!hasRouterWrapper) {
        errors.push(`🚨 CRITICAL ERROR: You are using "react-router-dom" (e.g., useNavigate, <Link>), but your app is NOT wrapped in a <BrowserRouter>. You MUST wrap your <App /> component inside a <BrowserRouter> in "src/main.tsx" or "src/App.tsx" to prevent routing crashes.`);
      }
    }

    return errors;
  }

  public validateUseEffect(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx') && !fileName.endsWith('.js') && !fileName.endsWith('.jsx')) continue;
      if (!content.includes('useEffect')) continue;

      try {
        const sourceFile = ts.createSourceFile(
          fileName,
          content,
          ts.ScriptTarget.ESNext,
          true,
          fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );

        const checkNode = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            const expr = node.expression;
            let isUseEffectCall = false;
            
            if (ts.isIdentifier(expr) && expr.text === 'useEffect') {
              isUseEffectCall = true;
            } else if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'useEffect') {
              isUseEffectCall = true;
            }

            if (isUseEffectCall && node.arguments.length === 1) {
              errors.push(`🚨 CRITICAL ERROR: \`useEffect\` in "${fileName}" is missing a dependency array. This causes infinite loops and crashes the browser. You MUST add a dependency array (e.g., \`[]\` for mount only, or \`[deps]\`).`);
            }
          }
          ts.forEachChild(node, checkNode);
        };

        checkNode(sourceFile);
      } catch (e) {
        // Ignore parser crash
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

  public validateImports(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    this.resolveCache.clear();

    for (const [path, content] of Object.entries(filesToValidate)) {
      const imports = this.extractImports(content);
      for (const imp of imports) {
        if (imp.startsWith('.') || imp.startsWith('@/')) {
          // Resolve against ALL files in the project, not just the new ones
          const resolved = this.resolveImportPath(path, imp, allFiles);
          if (!resolved) {
            const caseInsensitiveMatch = this.resolveImportPathCaseInsensitive(path, imp, allFiles);
            if (caseInsensitiveMatch) {
              errors.push(`🚨 CRITICAL ERROR: Case sensitivity mismatch in import "${imp}" in file "${path}". You imported it with wrong casing. The actual file is "${caseInsensitiveMatch}". Linux/Vercel deployments will fail. Please fix the import casing to match the exact file name.`);
            } else {
              errors.push(`🚨 CRITICAL ERROR: Missing import target "${imp}" in file "${path}". You referenced this file but it does not exist in the project. You MUST create this missing file.`);
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
      const defaultImports = this.extractDefaultImports(content);

      for (const imp of defaultImports) {
        if (!imp.specifier.startsWith('.') && !imp.specifier.startsWith('@/')) continue;

        const resolved = this.resolveImportPath(path, imp.specifier, allFiles);
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

  public extractDefaultImports(content: string): { localName: string; specifier: string }[] {
    const matches: { localName: string; specifier: string }[] = [];
    const regex = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\}\s*)?from\s+['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      matches.push({ localName: match[1], specifier: match[2] });
    }

    return matches;
  }

  public validateExportConsistency(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [path, content] of Object.entries(filesToValidate)) {
      const imports = this.extractNamedImports(content);
      for (const imp of imports) {
        if (!imp.specifier.startsWith('.') && !imp.specifier.startsWith('@/')) continue;
        
        const resolved = this.resolveImportPath(path, imp.specifier, allFiles);
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

  public validateDirectoryStructure(files: Record<string, string>): string[] {
    const errors: string[] = [];
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css'];
    
    for (const fileName of Object.keys(files)) {
      const isSourceFile = sourceExtensions.some(ext => fileName.endsWith(ext));
      const isConfigFile = ['vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.json', 'package.json', 'metadata.json', 'firebase-applet-config.json', 'firebase-blueprint.json', 'firestore.rules', 'database.sql'].includes(fileName);
      const isRootEntry = ['index.html', 'main.tsx', 'App.tsx', 'index.css', 'index.tsx'].includes(fileName);

      if (isSourceFile && !isConfigFile && !isRootEntry && !fileName.includes('/')) {
        errors.push(`🚨 CRITICAL ERROR: File "${fileName}" is in the root directory. For a SaaS platform, you MUST organize source files into subdirectories (e.g., "src/components/", "src/services/", "src/hooks/"). Root-level clutter causes path confusion.`);
      }
    }
    return errors;
  }

  public extractNamedImports(content: string): { names: string[]; specifier: string }[] {
    const matches: { names: string[]; specifier: string }[] = [];
    const regex = /import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[0].trim();
      }).filter(n => n && n !== '*');
      matches.push({ names, specifier: match[2] });
    }

    return matches;
  }

  public validateTypeScriptSyntax(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      // Check for 'require' usage in all JS/TS files, excluding config files like tailwind.config.js
      if (!fileName.includes('tailwind.config.js') && (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.jsx')) && content.match(/require\s*\(/) && !content.includes('createRequire')) {
        errors.push(`TS Syntax Error in ${fileName}: "require()" is not supported in Vite. Use ES6 "import" syntax instead.`);
      }

      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx')) continue;
      try {
        const sourceFile = ts.createSourceFile(
          fileName,
          content,
          ts.ScriptTarget.ESNext,
          true,
          fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );
        const diagnostics = (sourceFile as any).parseDiagnostics || [];
        for (const d of diagnostics) {
          let msg = d.messageText;
          if (fileName.endsWith('.tsx') && (msg.includes("Expression expected") || msg.includes("'>' expected"))) {
            msg += ` (HINT: In .tsx files, you CANNOT use '<Type>value' for type assertions, you MUST use 'value as Type'. Also, generic arrow functions MUST be written as '<T,>(arg: T) => ...' to avoid confusing the JSX parser.)`;
          }
          errors.push(`TS Syntax Error in ${fileName}: ${msg}`);
        }
      } catch (e) {
        // Ignore parser crash
      }
    }
    return errors;
  }

  public validateTypeScriptTypes(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    
    // Performance: Only validate files that are in filesToValidate
    const tsFiles = Object.keys(filesToValidate).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFiles.length === 0) return errors;

    const compilerOptions: ts.CompilerOptions = {
      noEmit: true,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false
    };

    // 1. Create a Virtual System
    const fsMap = new Map<string, string>();
    // Pre-populate with default lib files if needed by TS
    // (TypeScript often needs lib.d.ts to function correctly)
    
    for (const [path, content] of Object.entries(allFiles)) {
      if (typeof content === 'string' && content.length > 0) {
        fsMap.set('/' + path, content);
      }
    }
    for (const [path, content] of Object.entries(filesToValidate)) {
      if (typeof content === 'string' && content.length > 0) {
        fsMap.set('/' + path, content);
      }
    }

    const system = createSystem(fsMap);

    // 2. Create Virtual Compiler Host
    const host = createVirtualCompilerHost(system, compilerOptions, ts);
    
    // Fully overwrite getSourceFile to ensure we control SourceFile creation
    host.compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const content = system.readFile(fileName);
      if (content === undefined) {
        return undefined;
      }
      return ts.createSourceFile(fileName, content, languageVersion, true);
    };

    // 3. Create Program and Validate
    const program = ts.createProgram({
      rootNames: tsFiles.map(f => '/' + f),
      options: compilerOptions,
      host: host.compilerHost
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    diagnostics.forEach(d => {
      // Accuracy: Ignore "Cannot find module" (2307), "Cannot find name" (2304, 2584)
      if (d.code === 2307 || d.code === 2304 || d.code === 2584) return;
      
      if (d.file) {
        const fileName = d.file.fileName.replace(/^\//, '');
        
        // Only report errors for files we are currently validating
        if (filesToValidate[fileName]) {
          const { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start!);
          const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
          errors.push(`TS Type Error in ${fileName} (${line + 1},${character + 1}): ${message}`);
        }
      }
    });

    return errors;
  }

  public validateMockDataEnforcement(filesToValidate: Record<string, string>, prompt: string): string[] {
    const errors: string[] = [];
    if (!prompt) return errors;
    
    // Extract allowed URLs from prompt
    const promptUrls = new Set<string>();
    const urlRegex = /(https?:\/\/[^\s"'`]+)/g;
    let match;
    while ((match = urlRegex.exec(prompt)) !== null) {
      promptUrls.add(match[1]);
    }

    for (const [fileName, content] of Object.entries(filesToValidate)) {
      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx') && !fileName.endsWith('.js') && !fileName.endsWith('.jsx')) continue;
      
      try {
        const sourceFile = ts.createSourceFile(
          fileName,
          content,
          ts.ScriptTarget.ESNext,
          true,
          fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );

        const checkNode = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            const expr = node.expression;
            let isNetworkCall = false;
            
            if (ts.isIdentifier(expr) && expr.text === 'fetch') {
              isNetworkCall = true;
            } else if (ts.isPropertyAccessExpression(expr)) {
              if (ts.isIdentifier(expr.expression) && expr.expression.text === 'axios') {
                isNetworkCall = true;
              }
            } else if (ts.isIdentifier(expr) && expr.text === 'axios') {
              isNetworkCall = true;
            }

            if (isNetworkCall && node.arguments.length > 0) {
              const firstArg = node.arguments[0];
              let urlToCheck = "";

              if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                urlToCheck = firstArg.text;
              } else if (ts.isTemplateExpression(firstArg)) {
                urlToCheck = firstArg.head.text;
              }

              if (urlToCheck.startsWith('http://') || urlToCheck.startsWith('https://')) {
                // Check if this URL is in the prompt
                let isAllowed = false;
                for (const allowedUrl of promptUrls) {
                  if (urlToCheck.startsWith(allowedUrl) || allowedUrl.startsWith(urlToCheck)) {
                    isAllowed = true;
                    break;
                  }
                }
                
                if (!isAllowed) {
                  errors.push(`🚨 CRITICAL ERROR: You used a real API URL ("${urlToCheck}...") in "${fileName}". You MUST use hardcoded Mock Data (arrays/objects) to build the UI first. DO NOT use real APIs unless the user explicitly provided the URL in their prompt.`);
                }
              }
            }
          }
          ts.forEachChild(node, checkNode);
        };

        checkNode(sourceFile);
      } catch (e) {
        // Ignore parser crash
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

  public extractImports(content: string): string[] {
    const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
    const matches: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectRegex.exec(content)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    
    return matches;
  }

  public resolveImportPath(importerFile: string, importPath: string, allFiles: Record<string, string>): string | null {
    const cacheKey = `${importerFile}|${importPath}`;
    if (this.resolveCache.has(cacheKey)) return this.resolveCache.get(cacheKey)!;

    let resolved = importPath;

    if (importPath.startsWith('@/')) {
      resolved = importPath.replace('@/', 'src/');
      if (!Object.keys(allFiles).some(f => f.startsWith(resolved))) {
        resolved = importPath.replace('@/', 'app/');
      }
    } else if (importPath.startsWith('.')) {
      resolved = this.resolveRelativePath(importerFile, importPath);
    }

    resolved = this.normalizePath(resolved);

    const candidates = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
    ];

    let finalMatch: string | null = null;
    for (const c of candidates) {
      if (allFiles[c] !== undefined) {
        finalMatch = c;
        break;
      }
    }

    this.resolveCache.set(cacheKey, finalMatch);
    return finalMatch;
  }

  public resolveImportPathCaseInsensitive(importerFile: string, importPath: string, allFiles: Record<string, string>): string | null {
    let resolved = importPath;

    if (importPath.startsWith('@/')) {
      resolved = importPath.replace('@/', 'src/');
      if (!Object.keys(allFiles).some(f => f.toLowerCase().startsWith(resolved.toLowerCase()))) {
        resolved = importPath.replace('@/', 'app/');
      }
    } else if (importPath.startsWith('.')) {
      resolved = this.resolveRelativePath(importerFile, importPath);
    }

    resolved = this.normalizePath(resolved);

    const candidates = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
    ].map(c => c.toLowerCase());

    const allFilesLowerToOriginal = new Map<string, string>();
    for (const file of Object.keys(allFiles)) {
      allFilesLowerToOriginal.set(file.toLowerCase(), file);
    }

    for (const c of candidates) {
      if (allFilesLowerToOriginal.has(c)) {
        return allFilesLowerToOriginal.get(c)!;
      }
    }

    return null;
  }

  public resolveRelativePath(basePath: string, relativePath: string): string {
    const baseParts = basePath.split('/').slice(0, -1);
    const relativeParts = relativePath.split('/');
    for (const part of relativeParts) {
      if (part === '.') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    return baseParts.join('/');
  }

  public normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\/\//g, '/');
  }

  public validateReactKeys(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.tsx') && !fileName.endsWith('.jsx')) continue;

      // Simple regex to detect map functions without a key prop
      const regex = /\.map\(\s*\(([^)]*?)\)\s*=>\s*<([a-zA-Z0-9]+)(?!\s+key)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        errors.push(`React Key Error in ${fileName}: List rendered without a unique 'key' prop. Ensure all mapped elements have a 'key'.`);
      }
    }
    return errors;
  }

  public validateForbiddenPatterns(files: Record<string, string>): string[] {
    const errors: string[] = [];
    const safeBuiltins = new Set(['Date', 'String', 'Number', 'Boolean', 'Array', 'Object', 'RegExp', 'Error', 'Promise', 'Symbol', 'Map', 'Set', 'URL', 'FormData', 'Intl', 'Math', 'JSON', 'Console', 'Blob', 'File', 'Headers', 'Request', 'Response', 'URLSearchParams', 'WebSocket', 'Worker', 'Image', 'Audio', 'Video', 'CanvasGradient', 'CanvasPattern', 'CanvasRenderingContext2D', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'Performance', 'Notification', 'Storage', 'IDBKeyRange', 'IDBRequest', 'IDBTransaction', 'IDBDatabase', 'IDBObjectStore', 'IDBIndex', 'IDBCursor', 'IDBCursorWithValue', 'IDBFactory', 'Event', 'CustomEvent', 'MessageEvent', 'CloseEvent', 'ErrorEvent', 'ProgressEvent', 'UIEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'WheelEvent', 'PointerEvent', 'TouchEvent', 'CompositionEvent', 'InputEvent', 'AnimationEvent', 'TransitionEvent', 'ClipboardEvent', 'DragEvent', 'HashChangeEvent', 'PageTransitionEvent', 'PopStateEvent', 'StorageEvent', 'DeviceOrientationEvent', 'DeviceMotionEvent', 'GamepadEvent', 'BeforeUnloadEvent', 'SecurityPolicyViolationEvent', 'PromiseRejectionEvent', 'MediaQueryListEvent', 'OfflineAudioCompletionEvent', 'AudioProcessingEvent', 'RTCPeerConnectionIceEvent', 'RTCTrackEvent', 'RTCDataChannelEvent', 'RTCPeerConnectionIceErrorEvent', 'RTCCertificate', 'RTCSessionDescription', 'RTCIceCandidate', 'RTCIceServer', 'RTCIceTransport', 'RTCDtlsTransport', 'RTCSctpTransport', 'RTCRtpSender', 'RTCRtpReceiver', 'RTCRtpTransceiver', 'RTCRtpContributionSource', 'RTCRtpReceiveParameters', 'RTCRtpSendParameters', 'RTCRtpCodecParameters', 'RTCRtpHeaderExtensionParameters', 'RTCRtpCodecCapability', 'RTCRtpHeaderExtensionCapability', 'RTCRtpCapabilities', 'RTCIceParameters', 'RTCIceCandidatePair', 'RTCIceCandidateStats', 'RTCIceCandidatePairStats', 'RTCIceTransportStats', 'RTCOutboundRtpStreamStats', 'RTCInboundRtpStreamStats', 'RTCRemoteOutboundRtpStreamStats', 'RTCRemoteInboundRtpStreamStats', 'RTCAudioSourceStats', 'RTCVideoSourceStats', 'RTCTransportStats', 'RTCPeerConnectionStats', 'RTCCodecStats', 'RTCMediaStreamStats', 'RTCMediaStreamTrackStats', 'RTCDataChannelStats', 'RTCCertificateStats', 'RTCIceServerStats', 'RTCIceCandidateStats', 'RTCIceCandidatePairStats', 'RTCIceTransportStats', 'RTCOutboundRtpStreamStats', 'RTCInboundRtpStreamStats', 'RTCRemoteOutboundRtpStreamStats', 'RTCRemoteInboundRtpStreamStats', 'RTCAudioSourceStats', 'RTCVideoSourceStats', 'RTCTransportStats', 'RTCPeerConnectionStats', 'RTCCodecStats', 'RTCMediaStreamStats', 'RTCMediaStreamTrackStats', 'RTCDataChannelStats', 'RTCCertificateStats', 'RTCIceServerStats', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'DataView', 'ArrayBuffer', 'SharedArrayBuffer', 'BigInt', 'UTC', 'DateTimeFormat', 'NumberFormat']);

    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.tsx') && !fileName.endsWith('.jsx') && !fileName.endsWith('.ts') && !fileName.endsWith('.js')) continue;

      // 1. Detect component calls as functions: ComponentName() or {ComponentName()}
      if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
        try {
          const sourceFile = ts.createSourceFile(
            fileName,
            content,
            ts.ScriptTarget.ESNext,
            true,
            fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
          );

          const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
              let isComponentCall = false;
              let name = "Component";

              if (ts.isIdentifier(node.expression)) {
                name = node.expression.text;
                const startsUppercase = /^[A-Z]/.test(name);
                if (startsUppercase && !safeBuiltins.has(name)) {
                  isComponentCall = true;
                }
              } else if (ts.isPropertyAccessExpression(node.expression)) {
                name = node.expression.name.text;
                const startsUppercase = /^[A-Z]/.test(name);
                if (startsUppercase && !safeBuiltins.has(name)) {
                  isComponentCall = true;
                }
              } else if (ts.isElementAccessExpression(node.expression)) {
                // e.g., LucideIcons[name]()
                const expText = node.expression.expression.getText(sourceFile);
                if (expText.toLowerCase().includes('icon') || expText === 'LucideIcons') {
                  isComponentCall = true;
                  name = `${expText}[...]`;
                }
              }

              if (isComponentCall) {
                errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are calling React component "${name}" as a function: ${name}(). ALWAYS use JSX syntax: <${name} /> (or if dynamic: const Comp = ${name}; <Comp />). Calling components as functions causes "Cannot read properties of null (reading 'useContext')" errors.`);
              }
            }

            ts.forEachChild(node, visit);
          };

          visit(sourceFile);
        } catch (_e) {
          // If parser fails, skip this specific heuristic to avoid noisy false positives.
        }
      }

      // 2. Detect dynamic require
      if (!fileName.includes('tailwind.config.js') && content.match(/\brequire\s*\(/) && !content.includes('createRequire')) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: Dynamic "require()" is not supported in Vite. You MUST use ESM "import" syntax. Example: import { something } from 'package';`);
      }

      // 3. Detect process.env usage (must use import.meta.env in Vite client code)
      if (content.includes('process.env.') && !content.includes('process.env.GEMINI_API_KEY') && !content.includes('process.env.API_KEY') && !fileName.includes('vite.config.ts') && !fileName.includes('server.ts')) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: "process.env" is not allowed in Vite client code. Use "import.meta.env.VITE_VARIABLE_NAME" with null-safe fallback/checks to prevent runtime crashes.`);
      }

      // 4. Detect unhandled Supabase environment variables
      if (content.includes('createClient') && (content.includes('supabase') || content.includes('VITE_SUPABASE_URL'))) {
        // Enforce Singleton Pattern
        if (fileName.includes('/components/') || fileName.endsWith('App.tsx') || fileName.endsWith('main.tsx')) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: Do NOT initialize Supabase (createClient) inside React components or main entry files. You MUST create a single client instance in a dedicated file (e.g., src/services/supabaseClient.ts) and import it here.`);
        }

        const isConditional = content.includes('? createClient') || content.includes('if (') || content.includes('if(');
        const hasMetaCheck = content.includes('typeof import.meta') || content.includes('import.meta.env ?');
        
        if (!isConditional || !hasMetaCheck) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are accessing "VITE_SUPABASE_URL" unsafely. You MUST check if import.meta.env exists AND make createClient conditional. Example: const url = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : ''; export const supabase = url ? createClient(...) : null;`);
        }
        
        if (content.match(/\|\|\s*['"]\/[^'"]*['"]/)) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: Do NOT use a relative path (like '/', '/home', etc.) as a fallback for Supabase URL. It will cause a "URL constructor" runtime error. Use an empty string '' and make createClient conditional.`);
        }
      }

      // 5. Detect react-native imports
      if (content.match(/import\s+.*\s+from\s+['"]react-native['"]/)) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: "react-native" is not supported in this web environment. You MUST use React DOM elements (div, span, etc.) instead of React Native components (View, Text, etc.).`);
      }

      // 6. Detect broken main.tsx
      if (fileName.endsWith('main.tsx') || fileName.endsWith('index.tsx')) {
        if (!content.includes('createRoot') || !content.includes('render(')) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: The entry file MUST contain "createRoot" and "render" to mount the React app. Otherwise, the app will show a black screen.`);
        }
      }

      // 7. Ban default exports to prevent import mismatch errors
      if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        if (!fileName.includes('vite.config.ts') && !fileName.includes('tailwind.config.js') && !fileName.includes('postcss.config.js')) {
          if (content.match(/export\s+default\s+/)) {
            errors.push(`🚨 CRITICAL ERROR in ${fileName}: "export default" is STRICTLY FORBIDDEN. You MUST use Named Exports for all components and functions (e.g., "export const MyComponent = () => {}"). This prevents import mismatch errors.`);
          }
        }
      }

      // 8. Detect JSX in .ts files
      if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts') && !fileName.includes('Validator.ts')) {
        // Look for common JSX patterns: <div, <span, <Component />
        // Refined to avoid matching generics like useState<T>
        const hasJsxTags = content.match(/<(div|span|p|a|button|input|form|ul|li)[^>]*>/) || 
                          content.match(/<[A-Z][a-zA-Z0-9]*\s+[^>]*>/) || 
                          content.match(/<[A-Z][a-zA-Z0-9]*\s*\/>/);
        const hasJsxProps = content.match(/className=/) || content.match(/onClick=/) || content.match(/style=\{\{/);
        
        if (hasJsxTags || hasJsxProps) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are using JSX syntax (e.g., <Component /> or <div>) inside a ".ts" file. This causes fatal syntax errors (e.g., "'>' expected"). You MUST rename this file to end with ".tsx".`);
        }
      }

      // 9. Detect .svg imports
      if (content.match(/import\s+.*\s+from\s+['"].*\.svg['"]/)) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are importing a ".svg" file. This is NOT ALLOWED. You MUST use icons from "lucide-react" instead. Example: import { Home } from "lucide-react";`);
      }

      // 10. Detect invalid lucide-react imports
      const lucideMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
      if (lucideMatch) {
        const importedIcons = lucideMatch[1].split(',').map(i => i.trim().split(/\s+as\s+/)[0]);
        const commonInvalidIcons = ['Sad', 'Happy', 'Angry', 'Like', 'Dislike', 'Comment', 'Share', 'Retweet', 'ThumbUp', 'ThumbDown', 'DotsVertical', 'DotsHorizontal'];
        
        for (const icon of importedIcons) {
          if (commonInvalidIcons.includes(icon)) {
            errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are importing an invalid icon "${icon}" from "lucide-react". This icon does not exist and will cause a runtime crash. Please use valid lucide-react icon names (e.g., Frown instead of Sad, Smile instead of Happy, MessageCircle instead of Comment, MoreVertical instead of DotsVertical).`);
          }
        }
      }
    }
    return errors;
  }

  public validatePlan(plan: any[], currentFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const step of plan) {
      const stepText = typeof step === 'object' && step !== null ? JSON.stringify(step) : String(step);
      
      const createMatch = stepText.match(/CREATE\s+FILE\s+([\\w\\/\\.-\\s]+?\.[tj]sx?)/i);
      if (createMatch) {
        const filePath = this.normalizePath(createMatch[1]);
        if (currentFiles[filePath] !== undefined) {
          errors.push(`Plan Error: File to be created '${filePath}' already exists.`);
        }
      }

      const updateMatch = stepText.match(/UPDATE\s+FILE\s+([\\w\\/\\.-\\s]+?\.[tj]sx?)/i);
      if (updateMatch) {
        const filePath = this.normalizePath(updateMatch[1]);
        if (currentFiles[filePath] === undefined) {
          errors.push(`Plan Error: File to be updated '${filePath}' does not exist.`);
        }
      }
    }
    return errors;
  }
}
