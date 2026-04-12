import jscodeshift from 'jscodeshift';

// Initialize jscodeshift with the TSX parser to support React and TypeScript
const j = jscodeshift.withParser('tsx');

/**
 * A utility function to parse, modify, and regenerate code using AST.
 * It uses jscodeshift (which uses recast under the hood) to preserve 
 * the original formatting (spaces, line breaks, comments).
 */
export const modifyCodeWithAST = (
  sourceCode: string,
  modifierFn: (root: ReturnType<typeof j>, jApi: typeof j) => void
): string => {
  try {
    // 1. Parse the source code into an Abstract Syntax Tree (AST)
    const root = j(sourceCode);

    // 2. Apply the modification logic
    modifierFn(root, j);

    // 3. Regenerate the code from the AST, preserving original formatting
    return root.toSource();
  } catch (error) {
    console.error("AST Modification Error:", error);
    return sourceCode;
  }
};

/**
 * STEP 2 & 3: Node Traversing & Modification (JSX Elements)
 * Finds a specific JSX component and adds or updates a prop.
 * Example: addJsxAttribute(code, 'Button', 'onClick', "() => alert('Hi')", true)
 */
export const addJsxAttribute = (
  sourceCode: string,
  componentName: string,
  propName: string,
  propValue: string,
  isExpression: boolean = false
): string => {
  return modifyCodeWithAST(sourceCode, (root, j) => {
    // Traverse the AST to find all JSX Opening Elements (e.g., <Button ...>)
    root.find(j.JSXOpeningElement).forEach(path => {
      // Check if the component name matches our target
      if (path.node.name.type === 'JSXIdentifier' && path.node.name.name === componentName) {
        
        let valueNode;
        if (isExpression) {
          // Parse the string expression into an actual AST node
          // We use a temporary variable declaration to trick the parser into reading the expression
          const tempRoot = j(`const _temp = ${propValue};`);
          const initNode = tempRoot.find(j.VariableDeclarator).nodes()[0]?.init;
          if (initNode) {
            valueNode = j.jsxExpressionContainer(initNode);
          }
        } else {
          // If it's just a string, create a StringLiteral node
          valueNode = j.stringLiteral(propValue);
        }

        if (!valueNode) return;

        // Check if the attribute already exists
        const existingAttrIndex = path.node.attributes?.findIndex(
          attr => attr.type === 'JSXAttribute' && attr.name.name === propName
        );

        const newAttr = j.jsxAttribute(j.jsxIdentifier(propName), valueNode);

        if (path.node.attributes) {
          if (existingAttrIndex !== undefined && existingAttrIndex > -1) {
            // Update existing attribute safely
            path.node.attributes[existingAttrIndex] = newAttr;
          } else {
            // Add new attribute safely
            path.node.attributes.push(newAttr);
          }
        } else {
          path.node.attributes = [newAttr];
        }
      }
    });
  });
};

/**
 * STEP 2 & 3: Node Traversing & Modification (Variables)
 * Finds a specific variable declaration and updates its value.
 * Example: updateVariableValue(code, 'a', '10') // changes const a = 5; to const a = 10;
 */
export const updateVariableValue = (
  sourceCode: string,
  variableName: string,
  newValue: string,
  isString: boolean = false
): string => {
  return modifyCodeWithAST(sourceCode, (root, j) => {
    // Traverse the AST to find Variable Declarators (e.g., a = 5)
    root.find(j.VariableDeclarator, {
      id: { type: 'Identifier', name: variableName }
    }).forEach(path => {
      if (isString) {
        path.node.init = j.stringLiteral(newValue);
      } else {
        // Parse the new value as an expression node
        const tempRoot = j(`const _temp = ${newValue};`);
        const initNode = tempRoot.find(j.VariableDeclarator).nodes()[0]?.init;
        if (initNode) {
          path.node.init = initNode;
        }
      }
    });
  });
};
