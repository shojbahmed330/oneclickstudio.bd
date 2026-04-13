
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, WorkspaceType, AIProvider, GenerationMode, GenerationResult } from "../types";
import { Logger } from "./Logger";
import { parseModelJson } from "../utils/jsonParser";
import {
  BASE_ROLE,
  DEEP_THINKING,
  FIRST_COMMAND_COMPLETION,
  STRICT_SCOPE_EDITING,
  UNIT_TESTING,
  DEPENDENCY_GRAPH,
  SURGICAL_EDITING,
  MANDATORY_RULES,
  DESIGN_SYSTEM,
  PATCH_MODE_RULE,
  RESPONSE_FORMAT,
  PLANNING_PROMPT,
  CODING_PROMPT,
  REVIEW_PROMPT,
  OPTIMIZATION_PROMPT,
  PERFORMANCE_PROMPT,
  UI_UX_PROMPT
} from "../constants/prompts";

export class GeminiService implements AIProvider {
  private isLocalModel(modelName: string): boolean {
    if (modelName.includes('/')) return false;
    const name = modelName.toLowerCase();
    return name.includes('local') || name.includes('llama') || name.includes('qwen') || name.includes('coder');
  }

  async callPhase(
    phase: 'planning' | 'coding' | 'review' | 'security' | 'performance' | 'uiux' | 'type_generation' | 'consistency',
    input: string,
    modelName: string = 'gemini-3-pro-preview',
    retries: number = 5,
    projectConfig?: any
  ): Promise<any> {
    // ... (systemInstruction setup remains same)
    let systemInstruction = '';
    switch (phase) {
      case 'type_generation':
        systemInstruction = `You are a TypeScript Type Definition Expert.
Your task is to generate valid TypeScript ambient declarations (declare ...) for missing entities.
The user will provide a list of missing names.
You MUST return a JSON object with a "types" field containing the string of declarations.
Example:
{ "types": "declare const MyVar: any;\\ndeclare function MyFunc(): void;" }`;
        break;
      case 'planning': 
        systemInstruction = `${BASE_ROLE}\n\n${DEEP_THINKING}\n\n${FIRST_COMMAND_COMPLETION}\n\n${STRICT_SCOPE_EDITING}\n\n${DEPENDENCY_GRAPH}\n\n${MANDATORY_RULES}\n\n${PLANNING_PROMPT}\n\n${RESPONSE_FORMAT}`; 
        break;
      case 'coding': 
        systemInstruction = `${BASE_ROLE}\n\n${DEEP_THINKING}\n\n${FIRST_COMMAND_COMPLETION}\n\n${STRICT_SCOPE_EDITING}\n\n${UNIT_TESTING}\n\n${DEPENDENCY_GRAPH}\n\n${SURGICAL_EDITING}\n\n${PATCH_MODE_RULE}\n\n${MANDATORY_RULES}\n\n${DESIGN_SYSTEM}\n\n${CODING_PROMPT}\n\n${RESPONSE_FORMAT}`; 
        break;
      case 'review': 
        systemInstruction = `${BASE_ROLE}\n\n${STRICT_SCOPE_EDITING}\n\n${SURGICAL_EDITING}\n\n${PATCH_MODE_RULE}\n\n${REVIEW_PROMPT}\n\n${RESPONSE_FORMAT}`; 
        break;
      case 'security': 
        systemInstruction = `${BASE_ROLE}\n\n${STRICT_SCOPE_EDITING}\n\n${SURGICAL_EDITING}\n\n${PATCH_MODE_RULE}\n\n${OPTIMIZATION_PROMPT}\n\n${RESPONSE_FORMAT}`; 
        break;
      case 'performance': 
        systemInstruction = `${BASE_ROLE}\n\n${STRICT_SCOPE_EDITING}\n\n${SURGICAL_EDITING}\n\n${PATCH_MODE_RULE}\n\n${PERFORMANCE_PROMPT}\n\n${RESPONSE_FORMAT}`; 
        break;
      case 'uiux': 
        systemInstruction = `${BASE_ROLE}\n\n${STRICT_SCOPE_EDITING}\n\n${DESIGN_SYSTEM}\n\n${SURGICAL_EDITING}\n\n${PATCH_MODE_RULE}\n\n${UI_UX_PROMPT}\n\n${RESPONSE_FORMAT}`; 
        break;
      case 'consistency':
        systemInstruction = `${BASE_ROLE}\n\nYou are the "Project Consistency Fixer".
Your mission is to ensure the project is structurally sound, complete, and error-free.
You MUST:
1. Identify and CREATE any missing files referenced in imports but not yet existing.
2. Fix any broken import paths or case-sensitivity mismatches.
3. Ensure the application is correctly wrapped in a Router (e.g., <MemoryRouter> in App.tsx or main.tsx) if react-router-dom is used.
4. Generate missing TypeScript definitions or interfaces to resolve type errors.
5. Ensure all components follow the project's design system and architectural patterns.

You MUST return a JSON object with a "files" field containing the modified or new files.
${RESPONSE_FORMAT}`;
        break;
    }

    if (modelName.includes('/')) {
      return this.callPhaseWithOpenRouter(modelName, systemInstruction, input, retries, projectConfig);
    }

    if (this.isLocalModel(modelName)) {
      return this.callPhaseWithOllama(modelName, systemInstruction, input);
    }

    const key = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
    if (!key || key === "undefined") throw new Error("GEMINI_API_KEY not found.");

    const model = modelName.includes('pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Calling Gemini API directly
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: input }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { 
              responseMimeType: "application/json", 
              temperature: 0.1 
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Gemini Proxy error: ${response.status} - ${errorData.error?.message || JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return parseModelJson(text || '{}');
      } catch (error: any) {
        Logger.warn(`Attempt ${attempt} failed with Gemini API`, { component: 'GeminiService', model, attempt }, error);
        lastError = error;
        
        // If it's a fetch error (Failed to fetch), retry immediately or with small delay
        if (error.message.includes('Failed to fetch') || attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Gemini API failed after ${retries} attempts: ${lastError?.message}`);
  }

  async generateTypeDefinitions(missingTypes: { name: string, context: string }[], modelName: string = 'gemini-3-pro-preview', previousFailures?: string, projectConfig?: any): Promise<string> {
    let prompt = `Generate TypeScript declarations for these missing names based on their usage context:\n\n` + 
      missingTypes.map(m => `Name: ${m.name}\nContext:\n\`\`\`typescript\n${m.context}\n\`\`\``).join('\n\n') +
      `\n\nUse 'any' or best guesses for types if context is insufficient.`;
      
    if (previousFailures) {
      prompt += `\n\n⚠️ PREVIOUS ATTEMPT FAILED:\nThe following definitions were generated previously but did not resolve the errors:\n\`\`\`typescript\n${previousFailures}\n\`\`\`\nPlease try a DIFFERENT approach. Ensure you export the types correctly, use 'declare global' if necessary, or check for interface/type conflicts.`;
    }

    const result = await this.callPhase('type_generation', prompt, modelName, 3, projectConfig);
    return result.types || "";
  }

  private async callPhaseWithOpenRouter(model: string, system: string, prompt: string, retries: number, projectConfig?: any): Promise<any> {
    const key = projectConfig?.openrouter_key || import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_API_KEY;
    if (!key || key === "undefined") throw new Error("OpenRouter API key not found. Please configure it in the settings or environment.");

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Calling OpenRouter directly
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'OneClick Studio'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1
          })
        });

        if (!response.ok) {
          let errorMsg = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.error ? (typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error) : JSON.stringify(errorData);
          } catch (e) {
            // If response is not JSON (e.g. 405 Method Not Allowed HTML page)
            errorMsg = await response.text();
          }
          throw new Error(`OpenRouter API error: ${response.status} - ${errorMsg}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        return parseModelJson(content || '{}');
      } catch (error: any) {
        Logger.warn(`Attempt ${attempt} failed with OpenRouter API`, { component: 'GeminiService', model, attempt }, error);
        lastError = error;
        
        if (error.message.includes('Failed to fetch') || attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`OpenRouter API failed after ${retries} attempts: ${lastError?.message}`);
  }

  private async callPhaseWithOllama(model: string, system: string, prompt: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for local models

    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          stream: false,
          format: 'json'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
      const data = await response.json();
      
      let content = data.message.content;
      // Sanitize markdown code blocks if present
      content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      return JSON.parse(content);
    } catch (e: any) {
      clearTimeout(timeoutId);
      Logger.error("Phase call failed", e, { component: 'GeminiService', model, provider: 'Ollama' });
      throw new Error(`Local model execution failed: ${e.message}. Ensure Ollama is running at http://127.0.0.1:11434 and OLLAMA_ORIGINS="*" is set.`);
    }
  }
}
