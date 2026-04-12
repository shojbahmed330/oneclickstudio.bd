
import { GenerationMode } from "../types";

export class ModeDetector {
  public static detectMode(prompt: string, currentFiles: Record<string, string>): GenerationMode {
    const p = prompt.toLowerCase();
    const fileCount = Object.keys(currentFiles).length;
    const hasFiles = fileCount > 0;

    // 1. FIX Mode (High Priority)
    const fixKeywords = ['fix', 'error', 'bug', 'failed', 'issue', 'problem', 'ভুল', 'সমস্যা', 'ঠিক করো', 'সংশোধন', 'বাগ'];
    if (fixKeywords.some(k => p.includes(k))) return GenerationMode.FIX;

    // 2. OPTIMIZE Mode
    const optimizeKeywords = ['optimize', 'performance', 'speed up', 'faster', 'উন্নত', 'গতি', 'অপ্টিমাইজ'];
    if (optimizeKeywords.some(k => p.includes(k))) return GenerationMode.OPTIMIZE;

    // 3. If no files exist, it MUST be SCAFFOLD
    if (!hasFiles) return GenerationMode.SCAFFOLD;

    // 4. Smart SCAFFOLD vs EDIT detection for existing projects
    
    // Keywords that strongly suggest starting a NEW project/app from scratch
    const scaffoldKeywords = [
      'start over', 'from scratch', 'rebuild', 'new project', 'new app', 'new platform',
      'নতুন করে', 'সব মুছে', 'নতুন অ্যাপ', 'নতুন প্রজেক্ট', 'নতুন প্ল্যাটফর্ম', 'নতুন করে শুরু'
    ];
    
    // Keywords that suggest adding to an existing project
    const editKeywords = [
      'add', 'new feature', 'new screen', 'new page', 'new component', 'new system', 'new functionality',
      'update', 'change', 'modify', 'implement', 'integrate', 'refactor', 'setup',
      'যোগ করো', 'নতুন ফিচার', 'নতুন স্ক্রিন', 'নতুন পেজ', 'নতুন কম্পোনেন্ট', 'পরিবর্তন', 'আপডেট', 'যোগ', 'নতুন সিস্টেম', 'নতুন ফাংশন'
    ];

    const hasScaffoldKeyword = scaffoldKeywords.some(k => p.includes(k));
    const hasEditKeyword = editKeywords.some(k => p.includes(k));

    // Regex for explicit new app creation vs new feature/page
    const isExplicitNewApp = /(create|build|make|generate|start)\s+(a\s+)?(new\s+)?(app|project|platform|system|site|website)$/i.test(p);
    const isNewFeature = /(add|create|new|implement)\s+(a\s+)?(feature|screen|page|component|functionality|module|system|logic)/i.test(p);

    // If it looks like a new app request AND doesn't look like a feature request
    if ((hasScaffoldKeyword || isExplicitNewApp) && !hasEditKeyword && !isNewFeature) {
      // Even if they say "new app", if they have many files, we should probably still EDIT 
      // unless they explicitly say "start over" or "from scratch"
      if (fileCount > 3 && !p.includes('start over') && !p.includes('from scratch') && !p.includes('সব মুছে')) {
        return GenerationMode.EDIT;
      }
      return GenerationMode.SCAFFOLD;
    }

    // Default for existing projects is EDIT
    return GenerationMode.EDIT;
  }
}
