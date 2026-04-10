import * as ts from "typescript";

export interface FileSignature {
  path: string;
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  interfaces: string[];
  types: string[];
}

export class ProjectMapGenerator {
  private signatureCache = new Map<string, { hash: string; signature: FileSignature }>();

  // Simple hash function for caching
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  public generateDirectoryTree(files: string[]): string {
    const tree: any = {};
    for (const file of files) {
      const parts = file.split('/');
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = null; // file
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      }
    }

    let result = '';
    const buildString = (node: any, prefix: string = '') => {
      const keys = Object.keys(node).sort();
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const isLast = i === keys.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        result += `${prefix}${pointer}${key}\n`;
        if (node[key] !== null) {
          buildString(node[key], prefix + (isLast ? '    ' : '│   '));
        }
      }
    };
    buildString(tree);
    return result;
  }

  public generateFileSignature(path: string, content: string): FileSignature {
    const hash = this.hashContent(content);
    const cached = this.signatureCache.get(path);
    if (cached && cached.hash === hash) {
      return cached.signature;
    }

    const signature: FileSignature = {
      path,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      interfaces: [],
      types: []
    };

    try {
      const sourceFile = ts.createSourceFile(
        path,
        content,
        ts.ScriptTarget.ESNext,
        true,
        path.endsWith('.tsx') || path.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );

      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            signature.imports.push(node.moduleSpecifier.text);
          }
        } else if (ts.isFunctionDeclaration(node) && node.name) {
          signature.functions.push(node.name.text);
          if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            signature.exports.push(node.name.text);
          }
        } else if (ts.isClassDeclaration(node) && node.name) {
          signature.classes.push(node.name.text);
          if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            signature.exports.push(node.name.text);
          }
        } else if (ts.isInterfaceDeclaration(node) && node.name) {
          signature.interfaces.push(node.name.text);
          if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            signature.exports.push(node.name.text);
          }
        } else if (ts.isTypeAliasDeclaration(node) && node.name) {
          signature.types.push(node.name.text);
          if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            signature.exports.push(node.name.text);
          }
        } else if (ts.isVariableStatement(node)) {
          const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              if (isExported) {
                signature.exports.push(decl.name.text);
              }
              // If it's an arrow function, count it as a function
              if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                signature.functions.push(decl.name.text);
              }
            }
          }
        } else if (ts.isExportDeclaration(node)) {
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              signature.exports.push(element.name.text);
            }
          }
        } else if (ts.isExportAssignment(node)) {
          signature.exports.push('default');
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    } catch (e) {
      // Ignore parse errors
    }

    this.signatureCache.set(path, { hash, signature });
    return signature;
  }

  public generateDependencyMap(dependencyGraph: any[]): string {
    let result = 'DEPENDENCY GRAPH (Who imports whom):\n';
    for (const node of dependencyGraph) {
      if (node.imports.length > 0) {
        result += `${node.file} ➔ [${node.imports.join(', ')}]\n`;
      }
    }

    result += '\nREVERSE DEPENDENCIES (Who depends on this file):\n';
    const reverseMap: Record<string, string[]> = {};
    for (const node of dependencyGraph) {
      for (const imp of node.imports) {
        reverseMap[imp] = reverseMap[imp] || [];
        reverseMap[imp].push(node.file);
      }
    }

    for (const [file, dependents] of Object.entries(reverseMap)) {
      result += `${file} ⇠ [${dependents.join(', ')}]\n`;
    }

    return result;
  }
}
