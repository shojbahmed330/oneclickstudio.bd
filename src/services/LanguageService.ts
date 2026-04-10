
import * as ts from "typescript";
import { createSystem, createVirtualLanguageServiceHost } from '@typescript/vfs';
import { defaultTypeStubs } from './stubs';

export class LanguageService {
  private static instance: LanguageService;
  private fsMap: Map<string, string> = new Map();
  private compilerOptions: ts.CompilerOptions = {
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    strict: false,
    allowJs: true,
    esModuleInterop: true,
    baseUrl: ".",
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
    paths: {
      "@/*": ["./src/*"]
    }
  };

  private constructor() {}

  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  /**
   * Step 7: Load Type Definitions (.d.ts)
   * Injects stub declarations for common libraries so the Language Service can validate hooks and imports.
   */
  private injectDefaultTypes() {
    this.fsMap.set('/node_modules/@types/stubs/index.d.ts', defaultTypeStubs);
    this.fsMap.set('/node_modules/react/jsx-runtime.d.ts', "export const jsx: any; export const jsxs: any;");
  }

  /**
   * Step 2: Virtual File System (VFS) Creation
   */
  public updateVFS(files: Record<string, string>) {
    this.fsMap.clear();
    for (const [path, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        const absolutePath = path.startsWith('/') ? path : '/' + path;
        this.fsMap.set(absolutePath, content);
      }
    }
    this.injectDefaultTypes(); // Step 7: Load Type Definitions
  }

  /**
   * Step 3: Language Service Host Setup
   * Step 4: Run Syntactic & Semantic Diagnostics
   */
  public validateFiles(filesToValidate: string[]): string[] {
    const errors: string[] = [];
    
    // 1. Create the system
    const system = createSystem(this.fsMap);

    // 2. Step 3: Create Language Service Host
    // This host tells TS about files, contents, and tsconfig settings.
    const { languageServiceHost } = createVirtualLanguageServiceHost(system, [...this.fsMap.keys()], this.compilerOptions, ts);

    // 3. Create the Language Service
    const langService = ts.createLanguageService(languageServiceHost);

    // 4. Step 4: Run Diagnostics
    for (const fileName of filesToValidate) {
      const absolutePath = fileName.startsWith('/') ? fileName : '/' + fileName;
      
      // Syntactic Diagnostics (Syntax errors like missing brackets)
      const syntactic = langService.getSyntacticDiagnostics(absolutePath);
      for (const diag of syntactic) {
        const msg = this.formatDiagnostic(diag, fileName);
        if (msg) errors.push(msg);
      }

      // Semantic Diagnostics (Logical errors like missing imports or type mismatches)
      const semantic = langService.getSemanticDiagnostics(absolutePath);
      for (const diag of semantic) {
        const msg = this.formatDiagnostic(diag, fileName);
        if (msg) errors.push(msg);
      }
    }

    return errors;
  }

  private formatDiagnostic(diagnostic: ts.Diagnostic, fileName: string): string | null {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      
      // Better feedback for AI
      if (diagnostic.code === 2307) {
        // Filter out third-party modules that we didn't stub
        const match = message.match(/Cannot find module '([^']+)'/);
        if (match && match[1]) {
          const moduleName = match[1];
          if (!moduleName.startsWith('.') && !moduleName.startsWith('@/')) {
            return null; // Ignore missing third-party modules
          }
        }
        return `🚨 CRITICAL ERROR: Missing import target in "${fileName}" at line ${line + 1}. You referenced a file that does not exist. You MUST create this missing file or fix the path.`;
      }

      if (diagnostic.code === 1005) { // Expected ';'
         return `🚨 SYNTAX ERROR in "${fileName}" at line ${line + 1}: ${message}. Check for missing semicolons or brackets.`;
      }

      return `TS Error in ${fileName} (Line ${line + 1}, Col ${character + 1}): ${message}`;
    }
    return `TS Error in ${fileName}: ${message}`;
  }
}
