import * as ts from "typescript";

const files: Record<string, string> = {
  "index.ts": "import React from 'react';\nconst x: number = 'hello';\nconsole.log(x);",
};

const options: ts.CompilerOptions = {
  noEmit: true,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  skipLibCheck: true,
};

const host = ts.createCompilerHost(options);
const originalGetSourceFile = host.getSourceFile;
host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
  if (files[fileName]) {
    return ts.createSourceFile(fileName, files[fileName], languageVersion);
  }
  return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
};
host.fileExists = (fileName) => {
  return !!files[fileName] || ts.sys.fileExists(fileName);
};
host.readFile = (fileName) => {
  return files[fileName] || ts.sys.readFile(fileName);
};

const program = ts.createProgram(Object.keys(files), options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);

diagnostics.forEach(d => {
  // Ignore "Cannot find module" (2307) and "Cannot find name" (2304, 2584)
  if (d.code === 2307 || d.code === 2304 || d.code === 2584) return;
  console.log(`Error ${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
});
