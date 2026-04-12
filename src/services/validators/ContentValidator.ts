import * as ts from "typescript";
import { createSystem, createVirtualCompilerHost } from '@typescript/vfs';

export class ContentValidator {
  public validateTailwindCDN(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      if (fileName.endsWith('index.html')) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('cdn.tailwindcss.com')) {
            errors.push(`🚨 CRITICAL ERROR in ${fileName} (Line ${index + 1}): You MUST NOT use the Tailwind CDN script (<script src="https://cdn.tailwindcss.com"></script>). It causes severe conflicts with the Tailwind npm package. Remove it and rely on the npm package and @tailwind directives in index.css.`);
          }
        });
      }
    }
    return errors;
  }

  public validateImageURLs(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx')) continue;
      
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('images.unsplash.com') || line.includes('source.unsplash.com')) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName} (Line ${index + 1}): You are using a real/fake Unsplash image URL. This often results in broken images (404). You MUST use "https://picsum.photos/[width]/[height]" or "https://via.placeholder.com/[width]x[height]" instead.`);
        }
      });
    }
    return errors;
  }

  public validateForbiddenPatterns(files: Record<string, string>): string[] {
    const errors: string[] = [];
    const safeBuiltins = new Set([
      'Function', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object', 'RegExp', 'Error', 'Promise', 'Symbol', 'Map', 'Set', 'URL', 'FormData', 'Intl', 'Math', 'JSON', 'Console', 'Blob', 'File', 'Headers', 'Request', 'Response', 'URLSearchParams', 'WebSocket', 'Worker', 'Image', 'Audio', 'Video', 'CanvasGradient', 'CanvasPattern', 'CanvasRenderingContext2D', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'Performance', 'Notification', 'Storage', 'IDBKeyRange', 'IDBRequest', 'IDBTransaction', 'IDBDatabase', 'IDBObjectStore', 'IDBIndex', 'IDBCursor', 'IDBCursorWithValue', 'IDBFactory', 'Event', 'CustomEvent', 'MessageEvent', 'CloseEvent', 'ErrorEvent', 'ProgressEvent', 'UIEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'WheelEvent', 'PointerEvent', 'TouchEvent', 'CompositionEvent', 'InputEvent', 'AnimationEvent', 'TransitionEvent', 'ClipboardEvent', 'DragEvent', 'HashChangeEvent', 'PageTransitionEvent', 'PopStateEvent', 'StorageEvent', 'DeviceOrientationEvent', 'DeviceMotionEvent', 'GamepadEvent', 'BeforeUnloadEvent', 'SecurityPolicyViolationEvent', 'PromiseRejectionEvent', 'MediaQueryListEvent', 'OfflineAudioCompletionEvent', 'AudioProcessingEvent', 'RTCPeerConnectionIceEvent', 'RTCTrackEvent', 'RTCDataChannelEvent', 'RTCPeerConnectionIceErrorEvent', 'RTCCertificate', 'RTCSessionDescription', 'RTCIceCandidate', 'RTCIceServer', 'RTCIceTransport', 'RTCDtlsTransport', 'RTCSctpTransport', 'RTCRtpSender', 'RTCRtpReceiver', 'RTCRtpTransceiver', 'RTCRtpContributionSource', 'RTCRtpReceiveParameters', 'RTCRtpSendParameters', 'RTCRtpCodecParameters', 'RTCRtpHeaderExtensionParameters', 'RTCRtpCodecCapability', 'RTCRtpHeaderExtensionCapability', 'RTCRtpCapabilities', 'RTCIceParameters', 'RTCIceCandidatePair', 'RTCIceCandidateStats', 'RTCIceCandidatePairStats', 'RTCIceTransportStats', 'RTCOutboundRtpStreamStats', 'RTCInboundRtpStreamStats', 'RTCRemoteOutboundRtpStreamStats', 'RTCRemoteInboundRtpStreamStats', 'RTCAudioSourceStats', 'RTCVideoSourceStats', 'RTCTransportStats', 'RTCPeerConnectionStats', 'RTCCodecStats', 'RTCMediaStreamStats', 'RTCMediaStreamTrackStats', 'RTCDataChannelStats', 'RTCCertificateStats', 'RTCIceServerStats', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'DataView', 'ArrayBuffer', 'SharedArrayBuffer', 'BigInt', 'UTC', 'DateTimeFormat', 'NumberFormat',
      // React Hooks
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect', 'useDebugValue', 'useDeferredValue', 'useTransition', 'useId', 'useSyncExternalStore', 'useInsertionEffect',
      // Common Router Hooks
      'useNavigate', 'useLocation', 'useParams', 'useSearchParams', 'useRouteError', 'useNavigation', 'useFetcher', 'useMatch',
      // Browser APIs
      'TextEncoder', 'TextDecoder', 'AbortController', 'FileReader', 'XMLHttpRequest', 'AudioContext', 'OfflineAudioContext', 'BiquadFilterNode', 'GainNode', 'OscillatorNode', 'PannerNode', 'DelayNode', 'ConvolverNode', 'DynamicsCompressorNode', 'AnalyserNode', 'StereoPannerNode', 'ChannelSplitterNode', 'ChannelMergerNode', 'IIRFilterNode', 'WaveShaperNode', 'ConstantSourceNode', 'AudioWorkletNode', 'MediaStreamAudioSourceNode', 'MediaStreamAudioDestinationNode', 'MediaElementAudioSourceNode', 'AudioDestinationNode', 'AudioListener', 'AudioParam', 'AudioScheduledSourceNode', 'AudioNode', 'AudioParamMap', 'AudioWorklet', 'AudioWorkletGlobalScope', 'AudioWorkletProcessor',
      // Error Types
      'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'EvalError', 'URIError', 'AggregateError'
    ]);

    for (const [fileName, content] of Object.entries(files)) {
      if (!fileName.endsWith('.tsx') && !fileName.endsWith('.jsx') && !fileName.endsWith('.ts') && !fileName.endsWith('.js')) continue;

      // 1. Detect component calls as functions: ComponentName() or {ComponentName()}
      if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
        try {
          const sourceFile = ts.createSourceFile(
            fileName,
            content,
            ts.ScriptTarget.ESNext,
            true,
            fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
          );

          const visit = (node: ts.Node, isInsideJsx: boolean = false) => {
            const currentIsInsideJsx = isInsideJsx || ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) || ts.isJsxExpression(node);

            if (ts.isCallExpression(node)) {
              let isComponentCall = false;
              let name = "Component";

              if (ts.isIdentifier(node.expression)) {
                name = node.expression.text;
                const startsUppercase = /^[A-Z]/.test(name);
                // Only flag if it starts with uppercase, is NOT a safe builtin, AND is inside a JSX context
                if (startsUppercase && !safeBuiltins.has(name) && currentIsInsideJsx) {
                  isComponentCall = true;
                }
              } else if (ts.isPropertyAccessExpression(node.expression)) {
                name = node.expression.name.text;
                const startsUppercase = /^[A-Z]/.test(name);
                if (startsUppercase && !safeBuiltins.has(name) && currentIsInsideJsx) {
                  isComponentCall = true;
                }
              } else if (ts.isElementAccessExpression(node.expression)) {
                // e.g., LucideIcons[name]()
                const expText = node.expression.expression.getText(sourceFile);
                if ((expText.toLowerCase().includes('icon') || expText === 'LucideIcons') && currentIsInsideJsx) {
                  isComponentCall = true;
                  name = `${expText}[...]`;
                }
              }

              if (isComponentCall) {
                errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are calling React component "${name}" as a function: ${name}(). ALWAYS use JSX syntax: <${name} /> (or if dynamic: const Comp = ${name}; <Comp />). Calling components as functions causes "Cannot read properties of null (reading 'useContext')" errors.`);
              }
            }

            ts.forEachChild(node, (child) => visit(child, currentIsInsideJsx));
          };

          visit(sourceFile);
        } catch (_e) {
          // If parser fails, skip this specific heuristic to avoid noisy false positives.
        }
      }

      // 2. Detect dynamic require
      if (!fileName.includes('tailwind.config.js') && content.match(/\brequire\s*\(/) && !content.includes('createRequire')) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: Dynamic "require()" is not supported in Vite. You MUST use ESM "import" syntax. Example: import { something } from 'package';`);
      }

      // 3. Detect process.env usage (must use import.meta.env in Vite client code)
      if (content.includes('process.env.') && !content.includes('process.env.GEMINI_API_KEY') && !content.includes('process.env.API_KEY') && !fileName.includes('vite.config.ts') && !fileName.includes('server.ts')) {
        let hint = 'Use "import.meta.env.VITE_VARIABLE_NAME" instead.';
        if (content.includes('SUPABASE')) {
          hint = 'For Supabase, use "import.meta.env.VITE_SUPABASE_URL" and "import.meta.env.VITE_SUPABASE_ANON_KEY".';
        }
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: "process.env" is not allowed in Vite client code. ${hint} Ensure you have null-safe fallback/checks to prevent runtime crashes.`);
      }

      // 5. Detect react-native imports
      if (content.match(/import\s+.*\s+from\s+['"]react-native['"]/)) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: "react-native" is not supported in this web environment. You MUST use React DOM elements (div, span, etc.) instead of React Native components (View, Text, etc.).`);
      }

      // 6. Detect broken main.tsx
      if (fileName.endsWith('main.tsx') || fileName.endsWith('index.tsx')) {
        if (!content.includes('createRoot') || !content.includes('render(')) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: The entry file MUST contain "createRoot" and "render" to mount the React app. Otherwise, the app will show a black screen.`);
        }
      }

      // 8. Detect JSX in .ts files
      if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts') && !fileName.includes('Validator.ts')) {
        // Look for common JSX patterns: <div, <span, <Component />
        // Refined to avoid matching generics like useState<T>
        const hasJsxTags = content.match(/<(div|span|p|a|button|input|form|ul|li)[^>]*>/) || 
                          content.match(/<[A-Z][a-zA-Z0-9]*\s+[^>]*>/) || 
                          content.match(/<[A-Z][a-zA-Z0-9]*\s*\/>/);
        const hasJsxProps = content.match(/className=/) || content.match(/onClick=/) || content.match(/style=\{\{/);
        
        if (hasJsxTags || hasJsxProps) {
          errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are using JSX syntax (e.g., <Component /> or <div>) inside a ".ts" file. This causes fatal syntax errors (e.g., "'>' expected"). You MUST rename this file to end with ".tsx".`);
        }
      }

      // 9. Detect .svg imports
      if (content.match(/import\s+.*\s+from\s+['"].*\.svg['"]/)) {
        errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are importing a ".svg" file. This is NOT ALLOWED. You MUST use icons from "lucide-react" instead. Example: import { Home } from "lucide-react";`);
      }

      // 10. Detect invalid lucide-react imports
      const lucideMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
      if (lucideMatch) {
        const importedIcons = lucideMatch[1].split(',').map(i => i.trim().split(/\s+as\s+/)[0]);
        const commonInvalidIcons = ['Sad', 'Happy', 'Angry', 'Like', 'Dislike', 'Comment', 'Share', 'Retweet', 'ThumbUp', 'ThumbDown', 'DotsVertical', 'DotsHorizontal'];
        
        for (const icon of importedIcons) {
          if (commonInvalidIcons.includes(icon)) {
            errors.push(`🚨 CRITICAL ERROR in ${fileName}: You are importing an invalid icon "${icon}" from "lucide-react". This icon does not exist and will cause a runtime crash. Please use valid lucide-react icon names (e.g., Frown instead of Sad, Smile instead of Happy, MessageCircle instead of Comment, MoreVertical instead of DotsVertical).`);
          }
        }
      }
    }
    return errors;
  }

  public validateTypeScriptSyntax(files: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const [fileName, content] of Object.entries(files)) {
      // Check for 'require' usage in all JS/TS files, excluding config files like tailwind.config.js
      if (!fileName.includes('tailwind.config.js') && (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.jsx')) && content.match(/require\s*\(/) && !content.includes('createRequire')) {
        errors.push(`TS Syntax Error in ${fileName}: "require()" is not supported in Vite. Use ES6 "import" syntax instead.`);
      }

      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx')) continue;
      try {
        const sourceFile = ts.createSourceFile(
          fileName,
          content,
          ts.ScriptTarget.ESNext,
          true,
          fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );
        const diagnostics = (sourceFile as any).parseDiagnostics || [];
        for (const d of diagnostics) {
          let msg = d.messageText;
          if (fileName.endsWith('.tsx') && (msg.includes("Expression expected") || msg.includes("'>' expected"))) {
            msg += ` (HINT: In .tsx files, you CANNOT use '<Type>value' for type assertions, you MUST use 'value as Type'. Also, generic arrow functions MUST be written as '<T,>(arg: T) => ...' to avoid confusing the JSX parser.)`;
          }
          errors.push(`TS Syntax Error in ${fileName}: ${msg}`);
        }
      } catch (e) {
        // Ignore parser crash
      }
    }
    return errors;
  }

  public validateTypeScriptTypes(filesToValidate: Record<string, string>, allFiles: Record<string, string>): string[] {
    const errors: string[] = [];
    
    // Performance: Only validate files that are in filesToValidate
    const tsFiles = Object.keys(filesToValidate).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFiles.length === 0) return errors;

    const compilerOptions: ts.CompilerOptions = {
      noEmit: true,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false
    };

    // 1. Create a Virtual System
    const fsMap = new Map<string, string>();
    // Pre-populate with default lib files if needed by TS
    // (TypeScript often needs lib.d.ts to function correctly)
    
    for (const [path, content] of Object.entries(allFiles)) {
      if (typeof content === 'string' && content.length > 0) {
        fsMap.set('/' + path, content);
      }
    }
    for (const [path, content] of Object.entries(filesToValidate)) {
      if (typeof content === 'string' && content.length > 0) {
        fsMap.set('/' + path, content);
      }
    }

    const system = createSystem(fsMap);

    // 2. Create Virtual Compiler Host
    const host = createVirtualCompilerHost(system, compilerOptions, ts);
    
    // Fully overwrite getSourceFile to ensure we control SourceFile creation
    host.compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const content = system.readFile(fileName);
      if (content === undefined) {
        return undefined;
      }
      return ts.createSourceFile(fileName, content, languageVersion, true);
    };

    // 3. Create Program and Validate
    const program = ts.createProgram({
      rootNames: tsFiles.map(f => '/' + f),
      options: compilerOptions,
      host: host.compilerHost
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    diagnostics.forEach(d => {
      // Accuracy: Ignore "Cannot find module" (2307), "Cannot find name" (2304, 2584)
      // Ignore "Untyped function calls may not accept type arguments" (2347)
      // Ignore "Could not find a declaration file for module" (7016)
      if (d.code === 2307 || d.code === 2304 || d.code === 2584 || d.code === 2347 || d.code === 7016) return;
      
      if (d.file) {
        const fileName = d.file.fileName.replace(/^\//, '');
        
        // Only report errors for files we are currently validating
        if (filesToValidate[fileName]) {
          const { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start!);
          const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
          errors.push(`TS Type Error in ${fileName} (${line + 1},${character + 1}): ${message}`);
        }
      }
    });

    return errors;
  }

  public validateMockDataEnforcement(filesToValidate: Record<string, string>, prompt: string): string[] {
    const errors: string[] = [];
    if (!prompt) return errors;
    
    // Extract allowed URLs from prompt
    const promptUrls = new Set<string>();
    const urlRegex = /(https?:\/\/[^\s"'`]+)/g;
    let match;
    while ((match = urlRegex.exec(prompt)) !== null) {
      promptUrls.add(match[1]);
    }

    for (const [fileName, content] of Object.entries(filesToValidate)) {
      if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx') && !fileName.endsWith('.js') && !fileName.endsWith('.jsx')) continue;
      
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
            let isNetworkCall = false;
            
            if (ts.isIdentifier(expr) && expr.text === 'fetch') {
              isNetworkCall = true;
            } else if (ts.isPropertyAccessExpression(expr)) {
              if (ts.isIdentifier(expr.expression) && expr.expression.text === 'axios') {
                isNetworkCall = true;
              }
            } else if (ts.isIdentifier(expr) && expr.text === 'axios') {
              isNetworkCall = true;
            }

            if (isNetworkCall && node.arguments.length > 0) {
              const firstArg = node.arguments[0];
              let urlToCheck = "";

              if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                urlToCheck = firstArg.text;
              } else if (ts.isTemplateExpression(firstArg)) {
                urlToCheck = firstArg.head.text;
              }

              if (urlToCheck.startsWith('http://') || urlToCheck.startsWith('https://')) {
                // Check if this URL is in the prompt or in the always-allowed list
                let isAllowed = false;
                const alwaysAllowedDomains = [
                  'supabase.co',
                  'firebaseio.com',
                  'googleapis.com',
                  'openrouter.ai',
                  'openai.com',
                  'anthropic.com',
                  'localhost',
                  '127.0.0.1',
                  'picsum.photos',
                  'placeholder.com'
                ];

                for (const allowedUrl of promptUrls) {
                  if (urlToCheck.startsWith(allowedUrl) || allowedUrl.startsWith(urlToCheck)) {
                    isAllowed = true;
                    break;
                  }
                }

                if (!isAllowed) {
                  isAllowed = alwaysAllowedDomains.some(domain => urlToCheck.includes(domain));
                }
                
                if (!isAllowed) {
                  errors.push(`🚨 CRITICAL ERROR: You used a real API URL ("${urlToCheck}...") in "${fileName}". You MUST use hardcoded Mock Data (arrays/objects) to build the UI first. DO NOT use real APIs unless the user explicitly provided the URL in their prompt.`);
                }
              }
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
}
