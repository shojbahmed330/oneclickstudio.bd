
import React, { useEffect } from 'react';
import { Loader2, RefreshCw, Smartphone, Globe } from 'lucide-react';
import { Project } from '../types';
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";
import { extractDependencies } from '../utils/dependencyScanner';
import { PreviewService } from '../services/PreviewService';

interface LivePreviewViewProps {
  project: Project | null;
  loading: boolean;
  onReturnToTerminal: () => void;
}

const LivePreviewView: React.FC<LivePreviewViewProps> = ({ project, loading, onReturnToTerminal }) => {
  const [useProxy, setUseProxy] = React.useState(false);

  useEffect(() => {
    if (project) {
      // Inject <base> tag into index.html for proxy mode
      const files = { ...project.files };
      if (files['index.html']) {
        const baseTag = `<base href="${window.location.origin}/__preview/">`;
        if (!files['index.html'].includes('<base')) {
          files['index.html'] = files['index.html'].replace('<head>', `<head>\n    ${baseTag}`);
        }
      }
      PreviewService.updateFiles(files);
    }
  }, [project]);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-[#09090b] flex flex-col items-center justify-center gap-6">
        <Loader2 className="animate-spin text-pink-500" size={40}/>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Initializing Uplink...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-[100dvh] w-full bg-[#09090b] flex flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-black text-white uppercase">Project Offline</h1>
        <p className="text-zinc-600 text-xs uppercase font-bold">The developer has not authorized this uplink or it has been terminated.</p>
        <button onClick={onReturnToTerminal} className="mt-6 px-10 py-4 bg-pink-600 rounded-2xl font-black uppercase text-[10px]">Return to Terminal</button>
      </div>
    );
  }

  // Format files for Sandpack (ensure leading slash and inject .env)
  const sandpackFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(project.files)) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    sandpackFiles[normalizedPath] = content;
  }

  // Inject .env file
  let envContent = '';
  if (project.config?.supabase_url) {
    envContent += `VITE_SUPABASE_URL=${project.config.supabase_url}\n`;
  }
  if (project.config?.supabase_key) {
    envContent += `VITE_SUPABASE_ANON_KEY=${project.config.supabase_key}\n`;
  }
  if (envContent) {
    sandpackFiles['/.env'] = envContent;
  }

  // Extract dynamic dependencies from project files
  const dynamicDependencies = extractDependencies(project.files);

  return (
    <div className="h-[100dvh] w-full bg-[#09090b] flex flex-col relative">
      <div className="flex-1 w-full relative h-full">
        {useProxy ? (
          <iframe 
            src={PreviewService.getPreviewUrl()} 
            className="w-full h-full border-none bg-white"
            title="Custom Preview"
          />
        ) : (
          <SandpackProvider 
            template="vite-react-ts" 
            files={sandpackFiles}
            customSetup={{
              dependencies: dynamicDependencies
            }}
          >
            <SandpackPreview 
              showOpenInCodeSandbox={false} 
              showRefreshButton={false} 
              style={{ width: '100%', height: '100%', border: 'none', background: '#09090b' }} 
            />
          </SandpackProvider>
        )}
        
        <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-50">
           <button 
             onClick={() => setUseProxy(!useProxy)} 
             className={`p-4 ${useProxy ? 'bg-blue-600' : 'bg-zinc-800'} text-white rounded-2xl shadow-2xl active:scale-90 transition-all`}
             title={useProxy ? "Switch to Sandpack" : "Switch to Custom Proxy"}
           >
             <Globe size={20}/>
           </button>
           <button onClick={() => window.location.reload()} className="p-4 bg-pink-600 text-white rounded-2xl shadow-2xl active:scale-90 transition-all">
             <RefreshCw size={20}/>
           </button>
           <button onClick={onReturnToTerminal} className="p-4 bg-white/10 backdrop-blur-xl border border-white/10 text-white rounded-2xl shadow-2xl active:scale-90 transition-all">
             <Smartphone size={20}/>
           </button>
        </div>
      </div>
    </div>
  );
};

export default LivePreviewView;
