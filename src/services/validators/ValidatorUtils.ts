export class ValidatorUtils {
  private resolveCache = new Map<string, string | null>();

  public extractImports(content: string): string[] {
    const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
    const matches: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectRegex.exec(content)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    
    return matches;
  }

  public extractDefaultImports(content: string): { localName: string; specifier: string }[] {
    const matches: { localName: string; specifier: string }[] = [];
    const regex = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\}\s*)?from\s+['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      matches.push({ localName: match[1], specifier: match[2] });
    }

    return matches;
  }

  public extractNamedImports(content: string): { names: string[]; specifier: string }[] {
    const matches: { names: string[]; specifier: string }[] = [];
    const regex = /import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[0].trim();
      }).filter(n => n && n !== '*');
      matches.push({ names, specifier: match[2] });
    }

    return matches;
  }

  public resolveImportPath(importerFile: string, importPath: string, allFiles: Record<string, string>): string | null {
    const cacheKey = `${importerFile}|${importPath}`;
    if (this.resolveCache.has(cacheKey)) return this.resolveCache.get(cacheKey)!;

    let resolved = importPath;

    if (importPath.startsWith('@/')) {
      resolved = importPath.replace('@/', 'src/');
      if (!Object.keys(allFiles).some(f => f.startsWith(resolved))) {
        resolved = importPath.replace('@/', 'app/');
      }
    } else if (importPath.startsWith('.')) {
      resolved = this.resolveRelativePath(importerFile, importPath);
    }

    resolved = this.normalizePath(resolved);

    const candidates = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
    ];

    let finalMatch: string | null = null;
    for (const c of candidates) {
      if (allFiles[c] !== undefined) {
        finalMatch = c;
        break;
      }
    }

    // Fallback: If not found, check common root directories (app/, admin/, etc.)
    // This handles cases where the AI is confused about the root directory.
    if (!finalMatch) {
      const commonDirs = ['app/', 'admin/', 'tests/', 'public/'];
      for (const dir of commonDirs) {
        for (const c of candidates) {
          const pathWithDir = this.normalizePath(dir + c);
          if (allFiles[pathWithDir] !== undefined) {
            finalMatch = pathWithDir;
            break;
          }
        }
        if (finalMatch) break;
      }
    }

    this.resolveCache.set(cacheKey, finalMatch);
    return finalMatch;
  }

  public resolveImportPathCaseInsensitive(importerFile: string, importPath: string, allFiles: Record<string, string>): string | null {
    let resolved = importPath;

    if (importPath.startsWith('@/')) {
      resolved = importPath.replace('@/', 'src/');
      if (!Object.keys(allFiles).some(f => f.toLowerCase().startsWith(resolved.toLowerCase()))) {
        resolved = importPath.replace('@/', 'app/');
      }
    } else if (importPath.startsWith('.')) {
      resolved = this.resolveRelativePath(importerFile, importPath);
    }

    resolved = this.normalizePath(resolved);

    const candidates = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
    ].map(c => c.toLowerCase());

    const allFilesLowerToOriginal = new Map<string, string>();
    for (const file of Object.keys(allFiles)) {
      allFilesLowerToOriginal.set(file.toLowerCase(), file);
    }

    for (const c of candidates) {
      if (allFilesLowerToOriginal.has(c)) {
        return allFilesLowerToOriginal.get(c)!;
      }
    }

    // Fallback: Case-insensitive check in common root directories
    const commonDirs = ['app/', 'admin/', 'tests/', 'public/'];
    for (const dir of commonDirs) {
      for (const c of candidates) {
        const pathWithDir = this.normalizePath(dir + c).toLowerCase();
        if (allFilesLowerToOriginal.has(pathWithDir)) {
          return allFilesLowerToOriginal.get(pathWithDir)!;
        }
      }
    }

    return null;
  }

  public resolveRelativePath(basePath: string, relativePath: string): string {
    const baseParts = basePath.split('/').slice(0, -1);
    const relativeParts = relativePath.split('/');
    for (const part of relativeParts) {
      if (part === '.') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    return baseParts.join('/');
  }

  public normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\/\//g, '/');
  }
}
