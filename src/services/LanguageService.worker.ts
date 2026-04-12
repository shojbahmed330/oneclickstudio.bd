
import * as ts from "typescript";
import { createSystem, createVirtualLanguageServiceHost, createDefaultMapFromCDN } from '@typescript/vfs';
import { setupTypeAcquisition } from "@typescript/ata";

let fsMap: Map<string, string> = new Map();
let baseKeys: Set<string> = new Set();
let langService: ts.LanguageService | null = null;
let ata: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

const compilerOptions: ts.CompilerOptions = {
  noEmit: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  skipLibCheck: true,
  jsx: ts.JsxEmit.ReactJSX,
  strict: false,
  allowJs: true,
  esModuleInterop: true,
  baseUrl: "/",
  // Explicitly list all required libs to ensure Symbol.iterator, Array, document etc. are always present
  lib: [
    "lib.esnext.d.ts", 
    "lib.dom.d.ts", 
    "lib.dom.iterable.d.ts", 
    "lib.scripthost.d.ts",
    "lib.es2015.d.ts",
    "lib.es2016.d.ts",
    "lib.es2017.d.ts",
    "lib.es2018.d.ts",
    "lib.es2019.d.ts",
    "lib.es2020.d.ts",
    "lib.es2021.d.ts",
    "lib.es2022.d.ts"
  ],
  paths: {
    "@/*": ["./src/*"]
  }
};

// Use real localStorage if available for faster subsequent loads
const storer = typeof self !== 'undefined' && self.localStorage ? self.localStorage : {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// Emergency Stubs: These ensure basic types are ALWAYS available even if CDN fails
const emergencyStubs = `
  interface Iterable<T> { [Symbol.iterator](): IterableIterator<T>; }
  interface IterableIterator<T> extends Iterator<T> { [Symbol.iterator](): IterableIterator<T>; }
  interface Iterator<T> { next(value?: any): IteratorResult<T>; return?(value?: any): IteratorResult<T>; throw?(e?: any): IteratorResult<T>; }
  interface IteratorResult<T> { done: boolean; value: T; }

  declare interface Array<T> { 
    [n: number]: T; length: number; 
    map<U>(cb: (x: T, i: number, a: T[]) => U): U[]; 
    filter(cb: (x: T, i: number, a: T[]) => boolean): T[]; 
    forEach(cb: (x: T, i: number, a: T[]) => void): void; 
    reduce<U>(cb: (acc: U, x: T, i: number, a: T[]) => U, init: U): U; 
    find(cb: (x: T, i: number, a: T[]) => boolean): T | undefined; 
    some(cb: (x: T, i: number, a: T[]) => boolean): boolean; 
    every(cb: (x: T, i: number, a: T[]) => boolean): boolean; 
    includes(x: T, fromIndex?: number): boolean; 
    join(s?: string): string; push(...items: T[]): number; pop(): T | undefined; shift(): T | undefined; unshift(...items: T[]): number; 
    slice(start?: number, end?: number): T[]; splice(start: number, deleteCount?: number, ...items: T[]): T[]; 
    concat(...items: (T | T[])[]): T[]; sort(cb?: (a: T, b: T) => number): this; reverse(): T[]; 
    indexOf(x: T, fromIndex?: number): number; lastIndexOf(x: T, fromIndex?: number): number; 
    [Symbol.iterator](): IterableIterator<T>;
    keys(): IterableIterator<number>;
    values(): IterableIterator<T>;
    entries(): IterableIterator<[number, T]>;
  }
  declare const Array: { 
    new(len?: number): any[]; (...items: any[]): any[]; isArray(arg: any): arg is any[]; 
    from<T>(iterable: any): T[]; of<T>(...items: T[]): T[]; readonly prototype: any[]; 
  };

  declare interface String { 
    length: number; toString(): string; charAt(n: number): string; charCodeAt(n: number): number; 
    concat(...strings: string[]): string; indexOf(s: string, start?: number): number; lastIndexOf(s: string, start?: number): number; 
    localeCompare(s: string): number; match(regexp: string | RegExp): RegExpMatchArray | null; 
    replace(searchValue: string | RegExp, replaceValue: string): string; search(regexp: string | RegExp): number; 
    slice(start?: number, end?: number): string; split(separator: string | RegExp, limit?: number): string[]; 
    substring(start: number, end?: number): string; toLowerCase(): string; toLocaleLowerCase(): string; 
    toUpperCase(): string; toLocaleUpperCase(): string; trim(): string; 
    includes(s: string, pos?: number): boolean; startsWith(s: string, pos?: number): boolean; endsWith(s: string, pos?: number): boolean;
    [Symbol.iterator](): IterableIterator<string>; 
  }
  declare const String: { new(value?: any): String; (value?: any): string; fromCharCode(...codes: number[]): string; readonly prototype: String; };

  declare interface Object { 
    constructor: Function; toString(): string; toLocaleString(): string; valueOf(): Object; 
    hasOwnProperty(v: string): boolean; isPrototypeOf(v: Object): boolean; propertyIsEnumerable(v: string): boolean; 
  }
  declare const Object: { 
    new(value?: any): Object; (value?: any): any; 
    keys(o: object): string[]; values(o: object): any[]; entries(o: object): [string, any][]; 
    assign(t: any, ...s: any[]): any; getOwnPropertyNames(o: any): string[]; 
    freeze<T>(o: T): T; seal<T>(o: T): T; create(o: object | null, properties?: any): any;
    readonly prototype: Object; 
  };

  declare interface Function { apply(this: Function, thisArg: any, argArray?: any): any; call(this: Function, thisArg: any, ...argArray: any[]): any; bind(this: Function, thisArg: any, ...argArray: any[]): any; toString(): string; prototype: any; length: number; name: string; }
  declare const Function: { new(...args: string[]): Function; (...args: string[]): Function; readonly prototype: Function; };

  declare interface Boolean { valueOf(): boolean; }
  declare const Boolean: { new(value?: any): Boolean; (value?: any): boolean; readonly prototype: Boolean; };

  declare interface Number { toString(radix?: number): string; toFixed(fractionDigits?: number): string; toExponential(fractionDigits?: number): string; toPrecision(precision?: number): string; valueOf(): number; }
  declare const Number: { new(value?: any): Number; (value?: any): number; isFinite(v: any): boolean; isInteger(v: any): boolean; isNaN(v: any): boolean; parseFloat(s: string): number; parseInt(s: string, r?: number): number; readonly prototype: Number; };

  declare interface RegExp { exec(string: string): RegExpExecArray | null; test(string: string): boolean; readonly source: string; readonly global: boolean; readonly ignoreCase: boolean; readonly multiline: boolean; lastIndex: number; }
  declare const RegExp: { new(pattern: string | RegExp, flags?: string): RegExp; (pattern: string | RegExp, flags?: string): RegExp; readonly prototype: RegExp; };

  declare interface Error { name: string; message: string; stack?: string; }
  declare const Error: { new(message?: string): Error; (message?: string): Error; readonly prototype: Error; };
  declare const console: { log(...args: any[]): void; error(...args: any[]): void; warn(...args: any[]): void; info(...args: any[]): void; };
  declare const document: any;
  declare const window: any;
  declare const localStorage: any;
  declare const setTimeout: (cb: Function, ms: number) => any;
  declare const setInterval: (cb: Function, ms: number) => any;
  declare const clearTimeout: (id: any) => void;
  declare const clearInterval: (id: any) => void;
  declare const fetch: (url: string, init?: any) => Promise<any>;
  
  declare interface EventTarget { value?: any; checked?: boolean; name?: string; id?: string; }
  declare interface SyntheticEvent { target: EventTarget; currentTarget: EventTarget; preventDefault(): void; stopPropagation(): void; }
  declare interface ChangeEvent extends SyntheticEvent {}
  declare interface FormEvent extends SyntheticEvent {}
  declare interface MouseEvent extends SyntheticEvent {}
  
  declare interface Promise<T> { then<U>(cb: (x: T) => U | Promise<U>): Promise<U>; catch<U>(cb: (err: any) => U | Promise<U>): Promise<U>; finally(cb: () => void): Promise<T>; }
  declare interface PromiseConstructor { resolve<T>(v: T | Promise<T>): Promise<T>; reject(reason?: any): Promise<never>; all<T>(values: T[]): Promise<any[]>; race<T>(values: T[]): Promise<any>; }
  declare const Promise: PromiseConstructor;

  // React Essentials
  declare namespace React {
    type SetStateAction<S> = S | ((prevState: S) => S);
    type Dispatch<A> = (value: A) => void;
    function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
    function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    function useMemo<T>(factory: () => T, deps: any[]): T;
    function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
    function useRef<T>(initialValue: T): { current: T };
    function useReducer<R extends (state: any, action: any) => any>(reducer: R, initialState: any): [any, Dispatch<any>];
    function useContext<T>(context: any): T;
    function memo<T>(component: T): T;
    function forwardRef<T, P = {}>(render: (props: P, ref: any) => any): any;
    interface ReactNode {}
    interface ReactElement {}
  }

  declare module "react/jsx-runtime" {
    export namespace JSX {
      interface Element {}
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
  }

  declare namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
`;

async function init() {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Add emergency stubs immediately
    fsMap.set("/emergency-stubs.d.ts", emergencyStubs);
    baseKeys.add("/emergency-stubs.d.ts");

    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 5000;

    while (attempts < maxAttempts) {
      try {
        console.log(`[Worker] Loading core TypeScript libraries (Attempt ${attempts + 1}/${maxAttempts})...`);
        const baseMap = await createDefaultMapFromCDN(compilerOptions, ts.version, true, ts, undefined, undefined, storer as any);
        
        if (baseMap && baseMap.size > 0) {
          for (const [k, v] of baseMap) {
            const key = k.startsWith('/') ? k : '/' + k;
            fsMap.set(key, v);
            baseKeys.add(key);
          }
          
          const criticalFiles = ["/lib.esnext.d.ts", "/lib.dom.d.ts", "/lib.dom.iterable.d.ts"];
          const missing = criticalFiles.filter(file => !fsMap.has(file));
          
          if (missing.length === 0) {
            console.log("[Worker] Core libraries loaded successfully.");
            break; 
          }
        }
      } catch (error) {
        console.error(`[Worker] CDN load failed:`, error);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!isInitialized) {
      ata = setupTypeAcquisition({
        projectName: "ai-studio-app",
        typescript: ts,
        logger: console,
        delegate: {
          receivedFile: (code: string, path: string) => {
            const finalPath = path.startsWith('/') ? path : '/' + path;
            fsMap.set(finalPath, code);
            // Don't recreate every time, wait for batch
          }
        }
      });
      
      isInitialized = true;
      recreateLanguageService();
    }
  })();

  return initPromise;
}

function recreateLanguageService() {
  // Hard reset: clear the existing service to force a fresh state
  langService = null;
  
  const languageServiceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => Array.from(fsMap.keys()),
    getScriptVersion: (fileName) => {
      // Ensure fileName is normalized for lookup
      const normalizedPath = fileName.startsWith('/') ? fileName : '/' + fileName;
      return fsMap.has(normalizedPath) ? "1" : "0";
    },
    getScriptSnapshot: (fileName) => {
      const normalizedPath = fileName.startsWith('/') ? fileName : '/' + fileName;
      const content = fsMap.get(normalizedPath);
      if (content === undefined) return undefined;
      return ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => "/" + ts.getDefaultLibFileName(options),
    fileExists: (fileName) => {
      const normalizedPath = fileName.startsWith('/') ? fileName : '/' + fileName;
      return fsMap.has(normalizedPath);
    },
    readFile: (fileName) => {
      const normalizedPath = fileName.startsWith('/') ? fileName : '/' + fileName;
      return fsMap.get(normalizedPath);
    },
    directoryExists: (dirName) => dirName === "/" || dirName === "/node_modules",
    getDirectories: () => [],
    resolveModuleNames: (moduleNames, containingFile) => {
      const resolvedModules: (ts.ResolvedModule | undefined)[] = [];
      for (const moduleName of moduleNames) {
        // 1. Try to resolve from fsMap (local files)
        let resolvedPath: string | undefined;
        
        if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
          const baseDir = containingFile.substring(0, containingFile.lastIndexOf('/'));
          const rawPath = moduleName.startsWith('/') ? moduleName : `${baseDir}/${moduleName}`;
          
          // Recursive Path Resolver: Handle ../ and ./ correctly
          const parts = rawPath.split('/').filter(p => p && p !== '.');
          const resolvedParts: string[] = [];
          for (const part of parts) {
            if (part === '..') {
              resolvedParts.pop();
            } else {
              resolvedParts.push(part);
            }
          }
          const normalizedPath = '/' + resolvedParts.join('/');
          
          const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.d.ts'];
          for (const ext of extensions) {
            if (fsMap.has(normalizedPath + ext)) {
              resolvedPath = normalizedPath + ext;
              break;
            }
            // Handle directory index imports
            if (fsMap.has(normalizedPath + "/index" + ext)) {
              resolvedPath = normalizedPath + "/index" + ext;
              break;
            }
          }
        } else if (moduleName.startsWith('@/')) {
          const normalizedPath = ('/' + moduleName.replace('@/', '/src/')).replace(/\/+/g, '/');
          const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.d.ts'];
          for (const ext of extensions) {
            if (fsMap.has(normalizedPath + ext)) {
              resolvedPath = normalizedPath + ext;
              break;
            }
          }
        }

        if (resolvedPath) {
          resolvedModules.push({ resolvedFileName: resolvedPath });
        } else {
          // 2. Fallback to standard resolution (for node_modules/CDN types)
          resolvedModules.push(undefined);
        }
      }
      return resolvedModules;
    }
  };

  langService = ts.createLanguageService(languageServiceHost);
}

const impossibleGlobals = [
  // Core JS
  'Array', 'String', 'Object', 'Function', 'Boolean', 'Number', 'Math', 'Date', 'RegExp', 'Error', 'Promise', 'JSON',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'Symbol', 'BigInt', 'Intl', 'ArrayBuffer', 'Uint8Array', 
  'Float32Array', 'DataView', 'Infinity', 'NaN', 'undefined', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
  'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
  
  // DOM & Browser
  'document', 'window', 'localStorage', 'sessionStorage', 'console', 'location', 'history', 'navigator', 'screen',
  'performance', 'fetch', 'URL', 'URLSearchParams', 'AbortController', 'Blob', 'File', 'FileReader', 'FormData',
  'Headers', 'Request', 'Response', 'WebSocket', 'Worker', 'Notification', 'ServiceWorker', 'SharedWorker',
  'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'MediaQueryList', 'CustomElementRegistry',
  
  // HTML Elements
  'HTMLElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLAnchorElement', 'HTMLButtonElement', 'HTMLImageElement',
  'HTMLInputElement', 'HTMLFormElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLOptionElement',
  'HTMLCanvasElement', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLTableElement', 'HTMLTableRowElement',
  'HTMLTableCellElement', 'HTMLUListElement', 'HTMLOListElement', 'HTMLLIElement', 'HTMLParagraphElement',
  'HTMLHeadingElement', 'HTMLStyleElement', 'HTMLScriptElement', 'HTMLMetaElement', 'HTMLHeadElement', 'HTMLBodyElement',
  'Node', 'Element', 'DocumentFragment', 'ShadowRoot', 'Text', 'Comment', 'Attr', 'NamedNodeMap', 'NodeList', 'HTMLCollection',
  
  // Events & Timers
  'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'TouchEvent', 'PointerEvent', 'UIEvent', 'WheelEvent',
  'AnimationEvent', 'TransitionEvent', 'MessageEvent', 'ErrorEvent', 'HashChangeEvent', 'PopStateEvent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback',
  
  // CSS & Layout
  'CSSStyleDeclaration', 'ComputedStyleDeclaration', 'StyleSheet', 'CSSStyleSheet', 'ScreenOrientation', 'VisualViewport'
];

function formatDiagnostic(diagnostic: ts.Diagnostic, fileName: string): string | null {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file && diagnostic.start !== undefined) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    
    // 1. Handle Missing Imports (TS2307)
    if (diagnostic.code === 2307) {
      const match = message.match(/Cannot find module '([^']+)'/);
      if (match && match[1]) {
        const moduleName = match[1];
        if (!moduleName.startsWith('.') && !moduleName.startsWith('@/')) {
          return null; 
        }
      }
      return `🚨 CRITICAL ERROR: Missing import target in "${fileName}" at line ${line + 1}. You referenced a file that does not exist. You MUST create this missing file or fix the path.`;
    }

    // 2. Guardian Logic: Filter out "Impossible" errors (TS2304, TS2792, TS2488, TS2339)
    if (diagnostic.code === 2304 || diagnostic.code === 2792 || diagnostic.code === 2488 || diagnostic.code === 2339) {
      const isImpossibleGlobal = impossibleGlobals.some(g => message.includes(`'${g}'`));
      const isJsxRuntime = message.includes('react/jsx-runtime');
      const isIteratorError = message.includes('Symbol.iterator') || message.includes('must have a \'[Symbol.iterator]()\' method');
      const isEmptyObjectError = message.includes('Property \'map\' does not exist on type \'{}\'') || message.includes('Property \'length\' does not exist on type \'{}\'');

      if (isImpossibleGlobal || isJsxRuntime || isIteratorError || isEmptyObjectError) {
        return "INTERNAL_SYSTEM_TYPE_MISSING"; 
      }
    }

    // 3. Handle Testing Globals
    const testingGlobals = ['describe', 'test', 'expect', 'it', 'beforeEach', 'afterEach', 'vi', 'vitest', 'jest', 'beforeAll', 'afterAll'];
    if (diagnostic.code === 2304 || diagnostic.code === 2582 || diagnostic.code === 2591 || diagnostic.code === 2339) {
      if (testingGlobals.some(g => message.includes(`'${g}'`))) {
        return null;
      }
    }

    // 4. Handle React Router / Third-party noise
    if (diagnostic.code === 2347 || diagnostic.code === 7016) {
      return null;
    }

    if (diagnostic.code === 2322 && message.includes("'to'") && (message.includes("NavLink") || message.includes("Link"))) {
      return null;
    }

    // 5. Syntax Errors
    if (diagnostic.code === 1005) {
       return `🚨 SYNTAX ERROR in "${fileName}" at line ${line + 1}: ${message}. Check for missing semicolons or brackets.`;
    }

    return `TS Error in ${fileName} (Line ${line + 1}, Col ${character + 1}): ${message}`;
  }
  return `TS Error in ${fileName}: ${message}`;
}

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;
  
  await init();
  
  if (type === 'updateVFS') {
    const files = payload;
    const keysToDelete = [];
    for (const key of fsMap.keys()) {
      if (!baseKeys.has(key) && !key.startsWith('/node_modules')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => fsMap.delete(k));
    
    let combinedCode = "";
    for (const [path, content] of Object.entries(files)) {
      const absolutePath = path.startsWith('/') ? path : '/' + path;
      fsMap.set(absolutePath, content as string);
      if (path.endsWith('.ts') || path.endsWith('.tsx')) {
        combinedCode += content + "\n";
      }
    }
    
    if (ata && combinedCode) {
      ata(combinedCode);
    }
    
    recreateLanguageService();
    self.postMessage({ id, type: 'updateVFS_done' });
  } else if (type === 'validateFiles') {
    const filesToValidate = payload;
    let errors: string[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 3000;

    // Initial sync delay to ensure fsMap is fully populated from main thread
    await new Promise(resolve => setTimeout(resolve, 500));

    const runValidation = () => {
      let currentErrors: string[] = [];
      if (!langService) recreateLanguageService();
      
      for (const fileName of filesToValidate) {
        const absolutePath = fileName.startsWith('/') ? fileName : '/' + fileName;
        try {
          const syntactic = langService!.getSyntacticDiagnostics(absolutePath);
          for (const diag of syntactic) {
            const msg = formatDiagnostic(diag, fileName);
            if (msg) currentErrors.push(msg);
          }

          const semantic = langService!.getSemanticDiagnostics(absolutePath);
          for (const diag of semantic) {
            const msg = formatDiagnostic(diag, fileName);
            if (msg) currentErrors.push(msg);
          }
        } catch (err) {
          console.error(`[Worker] Error validating ${fileName}:`, err);
        }
      }
      return currentErrors;
    };

    while (attempts < maxAttempts) {
      errors = runValidation();
      
      // If we see INTERNAL_SYSTEM_TYPE_MISSING, it means the engine is "blind".
      // We MUST retry and NEVER report these to the AI.
      const hasSystemErrors = errors.some(e => e === "INTERNAL_SYSTEM_TYPE_MISSING");
      const hasMissingTypes = errors.some(e => 
        e.includes("Cannot find name") || 
        e.includes("Cannot find module") || 
        e.includes("Property 'map' does not exist") ||
        e.includes("Symbol.iterator")
      );

      if (hasSystemErrors || hasMissingTypes) {
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          recreateLanguageService();
          continue;
        }
      }
      break;
    }
    
    // Final Filter: Remove any remaining internal system markers before sending to AI
    const finalErrors = errors.filter(e => e !== "INTERNAL_SYSTEM_TYPE_MISSING");
    
    self.postMessage({ id, type: 'validateFiles_done', payload: finalErrors });
  }
};
