
import { AIController } from './controller';
import { ChatMessage } from '../types';

export class SelfHealingService {
  private controller: AIController;

  constructor(controller: AIController) {
    this.controller = controller;
  }

  attemptHeal(files: Record<string, string>, errors: string[]): { healedFiles: Record<string, string>, remainingErrors: string[] } {
    let healedFiles = { ...files };
    let remainingErrors = [...errors];
    let madeChanges = false;

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

    return { healedFiles, remainingErrors };
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
}
