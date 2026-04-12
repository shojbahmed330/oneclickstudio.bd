import * as ts from "typescript";

export class ReactValidator {
  public validateReactKeys(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.tsx') && !fileName.endsWith('.jsx')) continue;

      // Simple regex to detect map functions without a key prop
      const regex = /\.map\(\s*\(([^)]*?)\)\s*=>\s*<([a-zA-Z0-9]+)(?!\s+key)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        errors.push(`React Key Error in ${fileName}: List rendered without a unique 'key' prop. Ensure all mapped elements have a 'key'.`);
      }
    }
    return errors;
  }

  public validateUseEffect(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx') && !fileName.endsWith('.js') && !fileName.endsWith('.jsx')) continue;
      if (!content.includes('useEffect')) continue;

      try {
        const sourceFile = ts.createSourceFile(
          fileName,
          content,
          ts.ScriptTarget.ESNext,
          true,
          fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );

        const checkNode = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            const expr = node.expression;
            let isUseEffectCall = false;
            
            if (ts.isIdentifier(expr) && expr.text === 'useEffect') {
              isUseEffectCall = true;
            } else if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'useEffect') {
              isUseEffectCall = true;
            }

            if (isUseEffectCall && node.arguments.length === 1) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              errors.push(`🚨 CRITICAL ERROR in ${fileName} (Line ${line + 1}): \`useEffect\` is missing a dependency array. This causes infinite loops and crashes the browser. You MUST add a dependency array (e.g., \`useEffect(() => { ... }, [])\` for mount only, or \`useEffect(() => { ... }, [deps])\`).`);
            }
          }
          ts.forEachChild(node, checkNode);
        };

        checkNode(sourceFile);
      } catch (e) {
        // Ignore parser crash
      }
    }
    return errors;
  }

  public validateRouterWrapping(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    let usesRouter = false;

    // Check if react-router-dom is used in any of the files being validated
    for (const content of Object.values(filesToValidate)) {
      if (content.includes('react-router-dom')) {
        usesRouter = true;
        break;
      }
    }

    // Also check if react-router-dom is in package.json
    if (!usesRouter && allFiles['package.json']) {
      try {
        const pkg = JSON.parse(allFiles['package.json']);
        if (pkg.dependencies && pkg.dependencies['react-router-dom']) {
          usesRouter = true;
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    if (usesRouter) {
      const mainFiles = ['src/main.tsx', 'src/main.jsx', 'src/App.tsx', 'src/App.jsx'];
      let hasRouterWrapper = false;

      for (const fileName of mainFiles) {
        const content = allFiles[fileName] || filesToValidate[fileName];
        if (!content) continue;

        try {
          const sourceFile = ts.createSourceFile(
            fileName,
            content,
            ts.ScriptTarget.ESNext,
            true,
            fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
          );

          const routerAliases = new Set<string>();

          // Find imports from react-router-dom
          const findImports = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
              if (node.moduleSpecifier.text === 'react-router-dom') {
                const importClause = node.importClause;
                if (importClause && importClause.namedBindings) {
                  if (ts.isNamedImports(importClause.namedBindings)) {
                    importClause.namedBindings.elements.forEach(element => {
                      const name = element.propertyName ? element.propertyName.text : element.name.text;
                      if (['BrowserRouter', 'HashRouter', 'MemoryRouter', 'RouterProvider'].includes(name)) {
                        routerAliases.add(element.name.text);
                        if (name === 'BrowserRouter') {
                          const { line } = sourceFile.getLineAndCharacterOfPosition(element.getStart());
                          errors.push(`🚨 CRITICAL ERROR in ${fileName} (Line ${line + 1}): You imported "BrowserRouter". BrowserRouter does NOT work well in iframe preview environments. You MUST use "MemoryRouter" or "HashRouter" instead.`);
                        }
                      }
                    });
                  } else if (ts.isNamespaceImport(importClause.namedBindings)) {
                    routerAliases.add(importClause.namedBindings.name.text);
                  }
                }
              }
            }
            ts.forEachChild(node, findImports);
          };
          findImports(sourceFile);

          // If we found router imports, check if they are used as JSX tags
          if (routerAliases.size > 0) {
            const findJsxTags = (node: ts.Node) => {
              if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tagName = node.tagName;
                if (ts.isIdentifier(tagName) && routerAliases.has(tagName.text)) {
                  hasRouterWrapper = true;
                } else if (ts.isPropertyAccessExpression(tagName)) {
                  if (ts.isIdentifier(tagName.expression) && routerAliases.has(tagName.expression.text)) {
                    if (['BrowserRouter', 'HashRouter', 'MemoryRouter', 'RouterProvider'].includes(tagName.name.text)) {
                      hasRouterWrapper = true;
                    }
                  }
                }
              }
              if (!hasRouterWrapper) {
                ts.forEachChild(node, findJsxTags);
              }
            };
            findJsxTags(sourceFile);
          }
        } catch (e) {
          // Ignore parser crash
        }

        if (hasRouterWrapper) break;
      }

      if (!hasRouterWrapper) {
        errors.push(`🚨 CRITICAL ERROR: You are using "react-router-dom" (e.g., useNavigate, <Link>, <Routes>), but your app is NOT wrapped in a router. You MUST wrap your <App /> component inside a <MemoryRouter> or <HashRouter> in "src/main.tsx" or "src/App.tsx" to prevent routing crashes in the preview iframe. Do NOT use BrowserRouter.`);
      }
    }

    return errors;
  }

  public validateContextProvider(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(filesToValidate)) {
      if (content.includes('createContext(') && !content.includes('.Provider')) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: You created a Context using \`createContext\`, but you did not create or export a Provider component (e.g., \`<MyContext.Provider>\`). You MUST create a Provider component to wrap your app, otherwise \`useContext\` will throw errors.`);
      }
    }
    return errors;
  }
}
