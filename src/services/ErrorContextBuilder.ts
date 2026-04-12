import { ErrorAnalyzer, ErrorKnowledgeEntry } from "../constants/errorKnowledgeBase";
import { KnowledgeBaseService } from "./KnowledgeBaseService";

export class ErrorContextBuilder {
  public static build(validationErrors: string[], attempts: number, files?: Record<string, string>): string {
    let feedbackLoopMessage = `\n\nতুমি যে কোডটি দিয়েছ, তা বিল্ড করার সময় এই এররগুলো এসেছে (Attempt ${attempts + 1}):\n`;

    const knowledgeBase = KnowledgeBaseService.getInstance().getFullKnowledgeBase();

    const errorDetails = validationErrors.map(error => {
      const analysis = ErrorAnalyzer.analyze(error, knowledgeBase);
      
      let detail = `- এরর: ${error}`;
      
      // Try to find the file and line number to provide a snippet
      if (files) {
        const match = error.match(/in ([^:]+)(?: \(Line (\d+)\)|: (\d+),(\d+))?/);
        if (match) {
          const fileName = match[1].trim();
          const lineNum = parseInt(match[2] || match[3]);
          if (files[fileName] && !isNaN(lineNum)) {
            const lines = files[fileName].split('\n');
            const start = Math.max(0, lineNum - 3);
            const end = Math.min(lines.length, lineNum + 2);
            const snippet = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
            detail += `\n  CODE SNIPPET (${fileName}):\n\`\`\`\n${snippet}\n\`\`\``;
          }
        }
      }

      if (analysis) {
        detail += `\n  কারণ: ${analysis.rootCause}\n  সমাধান: ${analysis.solution}`;
      }
      return detail;
    }).join('\n\n');

    feedbackLoopMessage += `${errorDetails}\n\n🚨 CRITICAL INSTRUCTION: শুধুমাত্র যে ফাইলগুলোতে এরর আছে, ঠিক সেই ফাইলগুলোই ফিক্স করো। বাকি প্রজেক্ট এবং ফাইলগুলো একদম ঠিক আছে, সেগুলোতে হাত দেওয়ার কোনো প্রয়োজন নেই।`;
    
    if (attempts >= 10) {
      feedbackLoopMessage += "\n\n🚨 EMERGENCY: You have failed 10+ times. STOP using your current logic. It is fundamentally flawed. REWRITE the entire feature using a completely different, simpler strategy. Avoid any complex libraries or patterns you were using.";
    } else if (attempts >= 5) {
      feedbackLoopMessage += "\n\n🚨 CRITICAL STRATEGY CHANGE: You have failed 5 times. Your current approach is NOT working. You MUST try a COMPLETELY DIFFERENT approach. Simplify everything.";
    }

    return feedbackLoopMessage;
  }
}
