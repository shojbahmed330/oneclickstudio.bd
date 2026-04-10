
import { AIController } from './controller';
import { ChatMessage } from '../types';
import { ErrorParser, ParsedError } from './ErrorParser';
import { GeminiService } from './geminiService';
import { LanguageService } from './LanguageService';
import { Validator } from './Validator';

export class SelfHealingService {
  private controller: AIController;
  private geminiService: GeminiService;
  private validator: Validator;

  constructor(controller: AIController, validator: Validator) {
    this.controller = controller;
    this.geminiService = new GeminiService();
    this.validator = validator;
  }

  attemptHeal(files: Record<string, string>, errors: string[]): { healedFiles: Record<string, string>, remainingErrors: string[], detectedMissingTypes: { name: string, context: string }[] } {
    let healedFiles = { ...files };
    let remainingErrors = [...errors];
    let detectedMissingTypes: { name: string, context: string }[] = [];
    let madeChanges = false;

    // 0. Parse Errors to identify missing types/entities
    const parsedErrors = ErrorParser.analyzeBatch(remainingErrors);
    
    for (const p of parsedErrors) {
      if ((p.code === 'TS2304' || p.code === 'TS2552') && p.missingEntity) {
        if (!detectedMissingTypes.find(m => m.name === p.missingEntity)) {
          let context = "";
          if (p.file && p.line && healedFiles[p.file]) {
            const lines = healedFiles[p.file].split('\n');
            const start = Math.max(0, p.line - 5);
            const end = Math.min(lines.length, p.line + 5);
            context = lines.slice(start, end).join('\n');
          }
          detectedMissingTypes.push({ name: p.missingEntity, context });
        }
      }
    }

    if (detectedMissingTypes.length > 0) {
      console.log(` [Self-Healing] Detected missing types: ${detectedMissingTypes.map(m => m.name).join(', ')}`);
    }

    // 1. Fix JSX Extension Issues
    const jsxExtensionErrors = remainingErrors.filter(e => e.includes('contains JSX/HTML tags but has a .ts extension'));
    for (const error of jsxExtensionErrors) {
      const match = error.match(/File "([^"]+)"/);
      if (match && match[1]) {
        const oldPath = match[1];
        if (healedFiles[oldPath]) {
          const newPath = oldPath.replace(/\.ts$/, '.tsx');
          healedFiles[newPath] = healedFiles[oldPath];
          delete healedFiles[oldPath];
          madeChanges = true;
          remainingErrors = remainingErrors.filter(e => e !== error);
          console.log(`[Self-Healing] Renamed ${oldPath} to ${newPath}`);
        }
      }
    }

    // 2. Fix Root Level Clutter (Move to src/)
    const rootLevelErrors = remainingErrors.filter(e => e.includes('must be placed inside the "src/" directory'));
    for (const error of rootLevelErrors) {
      const match = error.match(/File "([^"]+)"/);
      if (match && match[1]) {
        const oldPath = match[1];
        if (healedFiles[oldPath] && !oldPath.startsWith('src/')) {
          const newPath = `src/${oldPath}`;
          healedFiles[newPath] = healedFiles[oldPath];
          delete healedFiles[oldPath];
          madeChanges = true;
          remainingErrors = remainingErrors.filter(e => e !== error);
          console.log(`[Self-Healing] Moved ${oldPath} to ${newPath}`);
        }
      }
    }

    // 3. Fix Missing React Imports in JSX (if any)
    for (const [path, content] of Object.entries(healedFiles)) {
      if ((path.endsWith('.tsx') || path.endsWith('.jsx')) && /(<\w+[^>]*>|<\/\w+>|<\w+\s*\/>)/.test(content)) {
        if (!content.includes("import React") && !content.includes("import * as React")) {
          // healedFiles[path] = `import React from 'react';\n${content}`;
          // madeChanges = true;
          // console.log(`[Self-Healing] Added React import to ${path}`);
        }
      }
    }

    // 4. Fix Default Export Mismatches (basic healing)
    const defaultExportErrors = remainingErrors.filter(e => e.includes('Default import mismatch'));
    for (const error of defaultExportErrors) {
       const match = error.match(/You imported "([^"]+)" as default from "([^"]+)"/);
       if (match && match[1] && match[2]) {
         const localName = match[1];
         const specifier = match[2];
         // Try to find the file that imports this and change it to a named import
         for (const [path, content] of Object.entries(healedFiles)) {
            const regex = new RegExp(`import\\s+${localName}\\s+from\\s+['"]${specifier}['"]`);
            if (regex.test(content)) {
              healedFiles[path] = content.replace(regex, `import { ${localName} } from '${specifier}'`);
              madeChanges = true;
              remainingErrors = remainingErrors.filter(e => e !== error);
              console.log(`[Self-Healing] Fixed default import of ${localName} in ${path}`);
            }
         }
       }
    }

    // 5. Detect Missing Critical Files (App.tsx, index.css)
    const missingFileErrors = remainingErrors.filter(e => e.includes('Missing import target'));
    for (const error of missingFileErrors) {
      if (error.includes('"./App"') || error.includes('"./index.css"')) {
        console.log(`[Self-Healing] Critical missing file detected: ${error}`);
        // We can't easily "create" the file here without knowing the content, 
        // but we can ensure it stays in remainingErrors to force AI to fix it.
      }
    }

    return { healedFiles, remainingErrors, detectedMissingTypes };
  }

  public async runTypeHealingLoop(
    files: Record<string, string>, 
    initialErrors: string[]
  ): Promise<{ healedFiles: Record<string, string>, remainingErrors: string[] }> {
    let currentFiles = { ...files };
    let currentErrors = [...initialErrors];
    let previousGeneratedTypes = "";
    const maxRetries = 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const parsedErrors = ErrorParser.analyzeBatch(currentErrors);
      let detectedMissingTypes: { name: string, context: string }[] = [];

      for (const p of parsedErrors) {
        if ((p.code === 'TS2304' || p.code === 'TS2552') && p.missingEntity) {
          if (!detectedMissingTypes.find(m => m.name === p.missingEntity)) {
            let context = "";
            if (p.file && p.line && currentFiles[p.file]) {
              const lines = currentFiles[p.file].split('\n');
              const start = Math.max(0, p.line - 5);
              const end = Math.min(lines.length, p.line + 5);
              context = lines.slice(start, end).join('\n');
            }
            detectedMissingTypes.push({ name: p.missingEntity, context });
          }
        }
      }

      if (detectedMissingTypes.length === 0) {
        break; // No missing types to heal
      }

      console.log(` [Self-Healing] Loop Attempt ${attempt + 1}: Generating definitions for ${detectedMissingTypes.map(m => m.name).join(', ')}`);
      
      try {
        const definitions = await this.geminiService.generateTypeDefinitions(
          detectedMissingTypes, 
          'gemini-3-pro-preview', 
          previousGeneratedTypes
        );

        if (definitions) {
          const typeFilePath = 'src/types/auto-generated.d.ts';
          const existing = currentFiles[typeFilePath] || '// Auto-generated types\n';
          const proposedFiles = { ...currentFiles, [typeFilePath]: existing + '\n' + definitions };
          
          // Re-validate to see if errors are fixed and no conflicts introduced
          console.log(` [Self-Healing] Re-compiling to verify fixes and check for conflicts...`);
          const proposedErrors = this.validator.validateTypeScriptSyntax(proposedFiles);
          
          // Check if the specific errors are gone
          const newParsedErrors = ErrorParser.analyzeBatch(proposedErrors);
          const stillMissing = newParsedErrors.some(p => (p.code === 'TS2304' || p.code === 'TS2552') && p.missingEntity);
          
          // Type Conflict Management: Check if new types broke the system (e.g., Duplicate identifiers)
          const conflictCodes = ['TS2300', 'TS2451', 'TS2717', 'TS2374', 'TS2375'];
          const hasConflicts = newParsedErrors.some(p => p.code && conflictCodes.includes(p.code));
          
          if (!stillMissing && !hasConflicts) {
            console.log(` [Self-Healing] Type errors successfully resolved without conflicts!`);
            currentFiles = proposedFiles;
            currentErrors = proposedErrors;
            break;
          } else {
            if (hasConflicts) {
              console.log(` [Self-Healing] Generated types caused conflicts. Discarding and retrying...`);
              previousGeneratedTypes = definitions + "\n// ⚠️ NOTE: This previous generation caused duplicate identifier conflicts (TS2300/TS2451/TS2717). Please use different names, use 'declare global', or merge interfaces properly.";
            } else {
              console.log(` [Self-Healing] Type errors persist. Retrying...`);
              previousGeneratedTypes = definitions;
            }
            // currentFiles remains unchanged, safely discarding the conflicting types
          }
        }
      } catch (e) {
        console.error(" [Self-Healing] Failed to generate types in loop:", e);
        break;
      }
    }

    return { healedFiles: currentFiles, remainingErrors: currentErrors };
  }

  async fixErrors(
    errors: string[],
    projectFiles: Record<string, string>,
    history: ChatMessage[] = [],
    modelName: string = 'gemini-3-pro-preview',
    projectConfig?: any
  ) {
    const repairPrompt = `
      🚨 CRITICAL SYSTEM ERRORS DETECTED IN WORKSPACE:
      ${errors.map((err, i) => `${i + 1}. ${err}`).join('\n')}

      INSTRUCTION:
      Analyze the errors above and the current project state. 
      Identify the root causes and FIX all of them.
      
      You MUST:
      1. Rename files if they contain JSX but have .ts extension.
      2. Fix missing or mismatched exports/imports.
      3. Ensure all source files are organized in subdirectories (e.g., src/components).
      4. Fix any syntax or type errors.

      Return the updated files in the standard JSON format. ONLY return the fixed files.
      In the "answer" field, provide a summary of the fixes.
    `;

    return await this.controller.processRequest(
      repairPrompt,
      projectFiles,
      history,
      false,
      modelName,
      projectConfig
    );
  }

  async fixError(
    error: { message: string; line: number; source: string; stack?: string },
    projectFiles: Record<string, string>,
    history: ChatMessage[] = [],
    modelName: string = 'gemini-3-pro-preview',
    projectConfig?: any
  ) {
    // Attempt to find the specific file content based on source name
    const sourceFile = Object.keys(projectFiles).find(f => f.endsWith(error.source)) || 'app/index.html';
    const fileContent = projectFiles[sourceFile];

    if (!fileContent) {
      throw new Error(`Source file not found: ${sourceFile}`);
    }

    const repairPrompt = `
      CRITICAL SYSTEM ERROR DETECTED IN WORKSPACE:
      - Error: "${error.message}"
      - File: "${sourceFile}"
      - Line: ${error.line}
      - Stack Trace: ${error.stack || 'No stack provided'}

      INSTRUCTION:
      Analyzing the current code of "${sourceFile}":
      --- START CODE ---
      ${fileContent}
      --- END CODE ---

      Identify the cause of the error (e.g., missing variable, syntax error, or bad reference) and FIX it.
      Return the updated files in the standard JSON format. ONLY return the fixed files. 
      In the "answer" field, explain what you fixed in 1 short sentence.
    `;

    return await this.controller.processRequest(
      repairPrompt,
      projectFiles,
      history,
      false,
      modelName,
      projectConfig
    );
  }

  public async learnFromFix(
    originalErrors: string[],
    fixedFiles: Record<string, string>,
    previousFiles: Record<string, string>,
    knowledgeBase: any[]
  ): Promise<any | null> {
    const unknownErrors = originalErrors.filter(error => {
      const found = knowledgeBase.some(k => {
        if (typeof k.pattern === 'string') return error.includes(k.pattern);
        return k.pattern.test(error);
      });
      return !found;
    });

    if (unknownErrors.length === 0) return null;

    // Analyze the fix to understand how it was solved
    const diffs: string[] = [];
    for (const [path, content] of Object.entries(fixedFiles)) {
      if (previousFiles[path] && previousFiles[path] !== content) {
        diffs.push(`FILE: ${path}\nFIXED CODE:\n${content}`);
      }
    }

    if (diffs.length === 0) return null;

    const learningPrompt = `
      You are a Senior System Architect. An unknown error occurred and was successfully fixed by an AI agent.
      Your task is to analyze the error and the fix to create a new entry for our Error Knowledge Base.

      UNKNOWN ERRORS:
      ${unknownErrors.join('\n')}

      FIX APPLIED:
      ${diffs.join('\n\n')}

      INSTRUCTION:
      Create a new ErrorKnowledgeEntry in JSON format:
      {
        "id": "unique_id",
        "pattern": "regex_pattern_to_match_this_error",
        "category": "syntax|type|import|runtime|config",
        "rootCause": "Bengali explanation of why this happened",
        "solutionInstruction": "Bengali instruction on how to fix it"
      }
    `;

    try {
      const generator = this.controller.processRequest(
        learningPrompt,
        {},
        [],
        false,
        'gemini-3-pro-preview'
      );
      
      let finalAnswer = "";
      for await (const chunk of generator) {
        if (chunk && typeof chunk === 'object' && chunk.type === 'result' && chunk.answer) {
          finalAnswer = chunk.answer;
        }
      }
      
      if (finalAnswer) {
        // In a real system, we would append this to the file or a database.
        // For now, we log it as a "Learned Lesson".
        console.log(" [Learning Loop] New Error Pattern Learned:", finalAnswer);
        return finalAnswer;
      }
    } catch (e) {
      console.error("Learning loop failed:", e);
    }
    return null;
  }
}
