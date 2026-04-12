import ts from "typescript";
import { createDefaultMapFromNodeModules } from '@typescript/vfs';
import fs from 'fs';
import path from 'path';

function addTypesToMap(map: Map<string, string>, pkgName: string) {
  const typesDir = path.join(process.cwd(), 'node_modules', '@types', pkgName);
  if (!fs.existsSync(typesDir)) return;
  
  const files = fs.readdirSync(typesDir);
  for (const file of files) {
    if (file.endsWith('.d.ts')) {
      const content = fs.readFileSync(path.join(typesDir, file), 'utf-8');
      map.set(`/node_modules/@types/${pkgName}/${file}`, content);
    }
  }
}

async function test() {
  try {
    const map = createDefaultMapFromNodeModules({ target: ts.ScriptTarget.ESNext });
    addTypesToMap(map, 'react');
    addTypesToMap(map, 'react-dom');
    
    // Add a package.json
    map.set('/package.json', JSON.stringify({
      dependencies: { "react": "*", "react-dom": "*" },
      devDependencies: { "@types/react": "*", "@types/react-dom": "*" }
    }));
    
    console.log("Total files loaded:", map.size);
    console.log("React index.d.ts exists:", map.has('/node_modules/@types/react/index.d.ts'));
  } catch (e) {
    console.error(e);
  }
}
test();
