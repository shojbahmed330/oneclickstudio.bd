
import { diff_match_patch } from "diff-match-patch";
import { Logger } from "./Logger";

export class DiffEngine {
  private dmp: any;

  constructor() {
    this.dmp = new diff_match_patch();
    this.dmp.Match_Threshold = 0.5;
    this.dmp.Match_Distance = 1000;
  }

  public hashContent(content: string): string {
    let hash = 0;
    for (let i = 0, len = content.length; i < len; i++) {
      const chr = content.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  public detectFileChanges(files: Record<string, string>, fileHashes: Map<string, string>): boolean {
    if (fileHashes.size === 0) return false;

    for (const [path, content] of Object.entries(files)) {
      const newHash = this.hashContent(content);
      const oldHash = fileHashes.get(path);

      if (!oldHash || newHash !== oldHash) {
        return true;
      }
    }

    for (const oldPath of fileHashes.keys()) {
      if (!files[oldPath]) return true;
    }

    return false;
  }

  private normalize(content: string): string {
    if (typeof content !== 'string') {
      Logger.warn('DiffEngine.normalize received non-string content', { type: typeof content });
      return String(content || '');
    }
    // Standardize line endings
    let normalized = content.replace(/\r\n/g, '\n');
    
    // Auto-fix: Vite Web Worker Syntax
    // new Worker('./worker.js') -> new Worker(new URL('./worker.js', import.meta.url))
    normalized = normalized.replace(
      /new\s+Worker\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      (match, path) => {
        if (path.includes('import.meta.url')) return match; // Already fixed
        return `new Worker(new URL('${path}', import.meta.url))`;
      }
    );

    // Auto-fix: Replace require() with import() for Vite compatibility
    normalized = normalized.replace(
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      (match, path) => {
        // Only replace if it's not a special require like createRequire
        if (match.includes('createRequire')) return match;
        return `import('${path}')`; // Returns a Promise
      }
    );

    return normalized.trim();
  }

  public updateSnapshot(files: Record<string, string>, fileHashes: Map<string, string>) {
    fileHashes.clear();
    for (const [path, content] of Object.entries(files)) {
      fileHashes.set(path, this.hashContent(content));
    }
  }


  public enforcePatchRules(generatedFiles: Record<string, string>, currentFiles: Record<string, string>, exemptedFiles: Set<string>): string[] {
    // Disabled: We now prefer full files for reliability
    return [];
  }

  public applyChanges(base: Record<string, string>, changes: Record<string, string> | any[], exemptedFiles: Set<string> = new Set()): { merged: Record<string, string>, errors: string[] } {
    const result = { ...base };
    const errors: string[] = [];

    // Normalize changes if it's an array
    let normalizedChanges: Record<string, string> = {};
    if (Array.isArray(changes)) {
      for (const item of changes) {
        if (item && typeof item === 'object') {
          const path = item.path || item.file || item.filename;
          const content = item.content || item.code || item.body || '';
          if (path && typeof path === 'string') {
            normalizedChanges[path] = typeof content === 'string' ? content : JSON.stringify(content);
          }
        }
      }
    } else if (changes && typeof changes === 'object') {
      normalizedChanges = changes;
    }

    for (let [path, incomingContent] of Object.entries(normalizedChanges)) {
      if (typeof incomingContent !== 'string') {
        incomingContent = JSON.stringify(incomingContent, null, 2);
      }
      
      // Handle database migrations separately
      if (path === 'database.sql' && base[path]) {
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const migrationPath = `migrations/${timestamp}_auto_migration.sql`;
        result[migrationPath] = this.normalize(incomingContent);
        continue;
      }

      // If file doesn't exist, create it
      if (!base[path]) {
        result[path] = this.normalize(incomingContent);
        continue;
      }

      // If file exists, try to apply patch
      try {
        const baseContent = this.normalize(base[path]);
        let trimmed = incomingContent.trim();
        let isUnifiedDiff = trimmed.startsWith('--- ') || trimmed.includes('@@ ');

        // Handle false positive: File starts with "--- filename" but has no hunks (@@)
        // This happens when AI returns full file but adds a header.
        if (isUnifiedDiff && !trimmed.includes('@@ ')) {
           isUnifiedDiff = false;
           const lines = trimmed.split('\n');
           if (lines[0].startsWith('--- ')) {
             // Strip the header and treat as full file
             trimmed = lines.slice(1).join('\n').trim();
             // Keep as full file content after header strip
           }
        }

        if (isUnifiedDiff) {
          // Clean up the patch content
          let patchContent = this.normalize(trimmed);
          // Remove markdown code blocks if present
          patchContent = patchContent.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
          
          // Ensure patch has a header if missing (sometimes AI omits it)
          if (!patchContent.startsWith('--- ')) {
             const firstHunk = patchContent.indexOf('@@ ');
             if (firstHunk !== -1) {
               patchContent = `--- ${path}\n+++ ${path}\n${patchContent.substring(firstHunk)}`;
             }
          }

          try {
            const patches = this.dmp.patch_fromText(patchContent);
            
            if (patches.length === 0) {
              throw new Error("No valid patches parsed from content");
            }

            // Strict check: verify context before applying
            const [patchedText, results] = this.dmp.patch_apply(patches, baseContent);
            
            // Check if ALL patches applied successfully
            const allSuccessful = results.every((success: boolean) => success === true);
            
            if (allSuccessful) {
              result[path] = patchedText;
            } else {
              // Identify which hunk failed
              const failedHunks = results.map((s: boolean, i: number) => s ? null : i + 1).filter(Boolean);
              errors.push(`Failed to apply patch for ${path} (Hunks: ${failedHunks.join(', ')} failed). The patch context did not match the original file. Please ensure you provide correct context lines.`);
              // Keep original content
              result[path] = base[path];
            }
          } catch (e: any) {
            errors.push(`Failed to parse patch for ${path}: ${e.message}`);
            result[path] = base[path];
          }
          continue;
        }

        // Handle full file replacement
        result[path] = this.normalize(trimmed);
        continue;

      } catch (e: any) {
        errors.push(`Error processing changes for ${path}: ${e.message}`);
        result[path] = base[path];
      }
    }

    return { merged: result, errors };
  }
}
