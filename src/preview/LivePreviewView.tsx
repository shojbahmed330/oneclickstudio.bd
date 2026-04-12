
import React, { useEffect, useState, useRef } from 'react';
import { extractDependencies } from '../utils/dependencyScanner';
import { ProjectConfig, WorkspaceType } from '../types';
import { PreviewService } from '../services/PreviewService';
import { WebContainerService } from '../services/WebContainerService';
import { TerminalComponent } from '../dashboard/components/Terminal';
import { Terminal } from 'xterm';
import { AlertCircle } from 'lucide-react';

interface LivePreviewViewProps {
  project: {
    files: Record<string, string>;
    config?: ProjectConfig;
  };
  workspace?: WorkspaceType;
  useProxy?: boolean;
  loading?: boolean;
  onReturnToTerminal?: () => void;
}

const LivePreviewView: React.FC<LivePreviewViewProps> = ({ 
  project, 
  workspace = 'app', 
  useProxy,
  loading,
  onReturnToTerminal
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [bootStatus, setBootStatus] = useState('Initializing WebContainer...');
  const terminalRef = useRef<Terminal | null>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    // Always update PreviewService files for fallback/standalone preview
    PreviewService.updateFiles(project.files);

    if (!window.crossOriginIsolated) {
      setPreviewUrl(PreviewService.getPreviewUrl());
      setIsBooting(false);
      return;
    }
    
    if (!project.files || Object.keys(project.files).length === 0) return;
    
    const formattedFiles: Record<string, string> = {};
    const prefix = `${workspace}/`;
    
    for (const [path, content] of Object.entries(project.files)) {
      let normalizedPath = path;
      if (path.startsWith(prefix)) {
        normalizedPath = path.slice(prefix.length);
      } else if (path.includes('/') && (path.startsWith('app/') || path.startsWith('admin/'))) {
        continue;
      }
      formattedFiles[normalizedPath] = content;
    }

    if (!formattedFiles['package.json']) {
      formattedFiles['package.json'] = JSON.stringify({
        name: "preview-app",
        type: "module",
        scripts: { dev: "vite" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.2.0" }
      }, null, 2);
    }

    if (!formattedFiles['vite.config.ts'] && !formattedFiles['vite.config.js']) {
      formattedFiles['vite.config.ts'] = `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });`;
    }

    // Only mount and boot once
    if (hasMounted.current) {
      // Update files dynamically
      Object.entries(formattedFiles).forEach(([path, content]) => {
        WebContainerService.updateFile(path, content);
      });
      return;
    }
    hasMounted.current = true;

    const initWebContainer = async () => {
      try {
        setIsBooting(true);
        
        // 2. Boot and Mount
        setBootStatus('Mounting files...');
        await WebContainerService.mountFiles(formattedFiles);

        // 3. Listen for URL
        WebContainerService.onUrlChange((url) => {
          setPreviewUrl(url);
          setIsBooting(false);
        });

        // 4. Run npm install
        setBootStatus('Running npm install...');
        const installExitCode = await WebContainerService.runCommand('npm', ['install'], (data) => {
          terminalRef.current?.write(data);
        });

        if (installExitCode !== 0) {
          terminalRef.current?.write('\\r\\n[Error] npm install failed.\\r\\n');
          setBootStatus('Failed to install dependencies.');
          return;
        }

        // 5. Run dev server
        setBootStatus('Starting dev server...');
        await WebContainerService.runCommand('npm', ['run', 'dev'], (data) => {
          terminalRef.current?.write(data);
        });

      } catch (error: any) {
        console.error("WebContainer Error:", error);
        setBootStatus(`Error: ${error.message}`);
        terminalRef.current?.write(`\\r\\n[Fatal Error] ${error.message}\\r\\n`);
      }
    };

    initWebContainer();
  }, [project.files, workspace]);

  if (loading || !project.files || Object.keys(project.files).length === 0) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Initializing Preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-[#09090b] flex flex-col relative">
      <div className="flex-1 w-full relative h-2/3">
        {isBooting && !previewUrl ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#09090b] z-10">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-zinc-400 font-mono text-sm">{bootStatus}</p>
            </div>
          </div>
        ) : null}
        
        {previewUrl && (
          <iframe 
            src={previewUrl} 
            className="w-full h-full border-none bg-white"
            title="Preview"
            allow="cross-origin-isolated"
          />
        )}

        {!window.crossOriginIsolated && (
          <div className="absolute top-4 left-4 right-4 z-20">
            <div className="glass-tech p-3 rounded-lg flex items-center gap-3 border-pink-500/30 bg-pink-500/10">
              <AlertCircle size={18} className="text-pink-500 shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Compatibility Mode</p>
                <p className="text-[10px] text-zinc-400">Node.js features disabled. Open in New Tab for full power.</p>
              </div>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-3 py-1 bg-pink-500 text-white text-[10px] font-bold rounded-full uppercase"
              >
                New Tab
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Terminal View - Only show if isolated */}
      {window.crossOriginIsolated && (
        <div className="h-1/3 w-full border-t border-zinc-800 bg-[#09090b] p-2">
          <div className="text-xs text-zinc-500 font-mono mb-2 px-2 flex justify-between">
            <span>WebContainer Terminal</span>
          </div>
          <div className="h-[calc(100%-24px)] w-full">
            <TerminalComponent onInit={(term) => { terminalRef.current = term; }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LivePreviewView;
