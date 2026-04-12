
import { ERROR_KNOWLEDGE_BASE, ErrorKnowledgeEntry } from "../constants/errorKnowledgeBase";
import { DatabaseService } from "./dbService";

export class KnowledgeBaseService {
  private static instance: KnowledgeBaseService;
  private dynamicKnowledge: ErrorKnowledgeEntry[] = [];
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  public async loadDynamicKnowledge(): Promise<void> {
    try {
      const learned = await this.db.getLearnedErrors();
      this.dynamicKnowledge = learned.map(item => ({
        ...item,
        pattern: item.pattern.startsWith('/') && item.pattern.endsWith('/') 
          ? new RegExp(item.pattern.slice(1, -1)) 
          : item.pattern
      }));
    } catch (e) {
      console.error("Failed to load dynamic knowledge:", e);
    }
  }

  public getFullKnowledgeBase(): ErrorKnowledgeEntry[] {
    return [...ERROR_KNOWLEDGE_BASE, ...this.dynamicKnowledge];
  }

  public async addKnowledge(entry: ErrorKnowledgeEntry): Promise<void> {
    await this.db.saveLearnedError(entry);
    this.dynamicKnowledge.push(entry);
  }
}
