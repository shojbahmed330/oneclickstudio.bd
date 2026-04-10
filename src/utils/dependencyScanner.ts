export const extractDependencies = (files: Record<string, string>): Record<string, string> => {
  const dependencies: Record<string, string> = {
    // Base dependencies that are always required
    "react-router-dom": "^6.22.3",
    "lucide-react": "^0.344.0",
    "recharts": "^2.12.2",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "framer-motion": "^11.0.8",
    "zustand": "^4.5.2",
    "@supabase/supabase-js": "^2.39.7"
  };

  // Built-in Node.js modules or React core modules to ignore
  const ignoreList = new Set([
    'react', 'react-dom', 'react-dom/client', 'fs', 'path', 'crypto', 'http', 'https', 'os', 'events', 'stream', 'util'
  ]);

  // Regex to match import statements: import ... from 'package-name' or import 'package-name'
  const importRegex = /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]/g;

  for (const content of Object.values(files)) {
    if (typeof content !== 'string') continue;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      let packageName = match[1];

      // 1. Ignore local files (starts with ./, ../, or @/)
      if (packageName.startsWith('.') || packageName.startsWith('/') || packageName.startsWith('@/')) {
        continue;
      }

      // 2. Handle scoped packages (e.g., @radix-ui/react-dialog) vs normal packages (e.g., lodash/fp)
      // We only want the base package name for npm installation
      if (packageName.startsWith('@')) {
        const parts = packageName.split('/');
        if (parts.length >= 2) {
          packageName = `${parts[0]}/${parts[1]}`;
        }
      } else {
        packageName = packageName.split('/')[0];
      }

      // 3. Ignore built-in modules and already added dependencies
      if (!ignoreList.has(packageName) && !dependencies[packageName]) {
        // Assign "latest" version to newly discovered packages
        dependencies[packageName] = "latest";
      }
    }
  }

  return dependencies;
};
