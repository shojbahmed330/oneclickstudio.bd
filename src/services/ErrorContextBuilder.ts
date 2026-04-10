import { ErrorAnalyzer, ERROR_KNOWLEDGE_BASE } from "../constants/errorKnowledgeBase";

export class ErrorContextBuilder {
  public static build(validationErrors: string[], attempts: number): string {
    let feedbackLoopMessage = `\n\nতুমি যে কোডটি দিয়েছ, তা বিল্ড করার সময় এই এররগুলো এসেছে:\n`;

    const errorDetails = validationErrors.map(error => {
      const analysis = ErrorAnalyzer.analyze(error, ERROR_KNOWLEDGE_BASE);

      if (analysis) {
        return `- এরর: ${error}\n  কারণ: ${analysis.rootCause}\n  সমাধান: ${analysis.solution}`;
      }
      return `- এরর: ${error}`;
    }).join('\n\n');

    feedbackLoopMessage += `${errorDetails}\n\nফাইলটি অ্যানালাইজ করে দ্রুত ফিক্স করো।`;

    if (attempts >= 2) {
      feedbackLoopMessage += "\n\nSTRATEGY CHANGE: You are failing repeatedly. SIMPLIFY the implementation. Remove complex types or advanced features if they are causing errors. Focus on basic functionality.";
    }

    return feedbackLoopMessage;
  }
}
