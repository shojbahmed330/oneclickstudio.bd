
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
    phase: 'planning' | 'coding' | 'review' | 'security' | 'performance' | 'uiux' | 'type_generation',
    input: string,
    modelName: string = 'gemini-3-pro-preview',
    retries: number = 3,
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
    }

    if (modelName.includes('/')) {
      return this.callPhaseWithOpenRouter(modelName, systemInstruction, input, retries, projectConfig);
    }

    if (this.isLocalModel(modelName)) {
      return this.callPhaseWithOllama(modelName, systemInstruction, input);
    }

    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key || key === "undefined") throw new Error("GEMINI_API_KEY not found.");

    const ai = new GoogleGenAI({ apiKey: key });
    const model = modelName.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: input }] }],
          config: { 
            systemInstruction: { parts: [{ text: systemInstruction }] },
            responseMimeType: "application/json", 
            temperature: 0.1 
          }
        });
        
        return parseModelJson(response.text || '{}');
      } catch (error: any) {
        Logger.warn(`Attempt ${attempt} failed`, { component: 'GeminiService', model, attempt }, error);
        lastError = error;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw new Error(`Gemini API failed after ${retries} attempts: ${lastError?.message}`);
  }

  async generateTypeDefinitions(missingTypes: { name: string, context: string }[], modelName: string = 'gemini-3-pro-preview', previousFailures?: string): Promise<string> {
    let prompt = `Generate TypeScript declarations for these missing names based on their usage context:\n\n` + 
      missingTypes.map(m => `Name: ${m.name}\nContext:\n\`\`\`typescript\n${m.context}\n\`\`\``).join('\n\n') +
      `\n\nUse 'any' or best guesses for types if context is insufficient.`;
      
    if (previousFailures) {
      prompt += `\n\n⚠️ PREVIOUS ATTEMPT FAILED:\nThe following definitions were generated previously but did not resolve the errors:\n\`\`\`typescript\n${previousFailures}\n\`\`\`\nPlease try a DIFFERENT approach. Ensure you export the types correctly, use 'declare global' if necessary, or check for interface/type conflicts.`;
    }

    const result = await this.callPhase('type_generation', prompt, modelName);
    return result.types || "";
  }

  private async callPhaseWithOpenRouter(model: string, system: string, prompt: string, retries: number, projectConfig?: any): Promise<any> {
    const key = projectConfig?.openrouter_key || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OpenRouter API key not found. Please configure it in the settings or environment.");

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai.studio/build',
            'X-Title': 'AI Studio Build'
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
          const errorText = await response.text();
          throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        return parseModelJson(content || '{}');
      } catch (error: any) {
        Logger.warn(`Attempt ${attempt} failed with OpenRouter`, { component: 'GeminiService', model, attempt }, error);
        lastError = error;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
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
