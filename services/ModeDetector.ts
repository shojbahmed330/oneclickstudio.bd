
import { GenerationMode } from "../types";

export class ModeDetector {
  public static detectMode(prompt: string, currentFiles: Record<string, string>): GenerationMode {
    const p = prompt.toLowerCase();
    const hasFiles = Object.keys(currentFiles).length > 0;

    // Force SCAFFOLD mode if the user explicitly asks for a new app or to create something from scratch
    // Supports English and Bengali keywords with flexible matching
    const isNewAppIntent = /(create|new|start|build|scaffold|generate|make|তৈরি|বানাও|নতুন|একটি|app|অ্যাপ).*(app|project|platform|system|site|অ্যাপ|প্রজেক্ট|বানাও|তৈরি)/i.test(p) || 
                          p.startsWith('create ') || p.startsWith('make a ') || p.startsWith('একটি ') || p.startsWith('নতুন ') || p.includes('অ্যাপ');

    if (!hasFiles || isNewAppIntent) return GenerationMode.SCAFFOLD;
    
    if (p.includes('fix') || p.includes('error') || p.includes('bug') || p.includes('failed')) return GenerationMode.FIX;
    if (p.includes('optimize') || p.includes('performance') || p.includes('speed up')) return GenerationMode.OPTIMIZE;
    
    return GenerationMode.EDIT;
  }
}
