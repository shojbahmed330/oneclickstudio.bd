
import { AIController } from './controller';
import { ChatMessage } from '../types';

export class SelfHealingService {
  private controller = new AIController();

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
