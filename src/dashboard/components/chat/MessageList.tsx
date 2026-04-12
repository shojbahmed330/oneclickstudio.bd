
import React, { useEffect, useRef } from 'react';
import { Loader2, RefreshCw, Cpu, Brain, Code, FileText, Save, Terminal, Zap, Clock, Layout, Palette, Type, Layers } from 'lucide-react';
import MessageItem from './MessageItem';
import PhaseTimeline from './PhaseTimeline';
import TypingIndicator from './TypingIndicator';
import { useLanguage } from '../../../i18n/LanguageContext';
import { BuilderPhase, BuilderStatus } from '../../../types';

interface MessageListProps {
  messages: any[];
  isGenerating: boolean;
  currentAction?: string | null;
  handleSend: (extraData?: string) => void;
  waitingForApproval?: boolean;
  phase: BuilderPhase;
  builderStatuses: BuilderStatus[];
  saveProjectConfig?: (config: any) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isGenerating, currentAction, handleSend, waitingForApproval, phase, builderStatuses, saveProjectConfig }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isGenerating, currentAction]);

  const getActionIcon = () => {
    if (!currentAction) return <RefreshCw className="animate-spin" size={16}/>;
    const action = currentAction.toLowerCase();
    if (action.includes('analyz') || action.includes('requir') || action.includes('thought')) return <Brain size={16} className="animate-pulse text-pink-400" />;
    if (action.includes('read') || action.includes('fetch')) return <FileText size={16} className="animate-bounce text-blue-400" />;
    if (action.includes('edit') || action.includes('patch') || action.includes('writ') || action.includes('generat')) return <Code size={16} className="animate-pulse text-emerald-400" />;
    if (action.includes('save') || action.includes('synthes') || action.includes('finaliz')) return <Save size={16} className="animate-bounce text-amber-400" />;
    if (action.includes('draft') || action.includes('answer')) return <Terminal size={16} className="animate-pulse text-indigo-400" />;
    return <Cpu size={16} className="animate-spin text-pink-500" />;
  };

  const getModelName = (modelId: string) => {
    switch (modelId) {
      case 'gemini-3-pro-preview': return 'Gemini 3 Pro (Cloud)';
      case 'gemini-3-flash-preview': return 'Gemini 3 Flash (Cloud)';
      case 'anthropic/claude-3.7-sonnet': return 'Claude 3.7 Sonnet (OpenRouter)';
      case 'anthropic/claude-3.5-sonnet': return 'Claude 3.5 Sonnet (OpenRouter)';
      case 'anthropic/claude-3.5-haiku': return 'Claude 3.5 Haiku (OpenRouter)';
      case 'openai/gpt-4o': return 'GPT-4o (OpenRouter)';
      case 'openai/gpt-4o-mini': return 'GPT-4o Mini (OpenRouter)';
      case 'google/gemini-2.5-pro': return 'Gemini 2.5 Pro (OpenRouter)';
      case 'google/gemini-2.5-flash': return 'Gemini 2.5 Flash (OpenRouter)';
      case 'deepseek/deepseek-chat': return 'DeepSeek Chat (OpenRouter)';
      case 'deepseek/deepseek-chat-v3-0324': return 'DeepSeek V3 0324 (OpenRouter)';
      default: return modelId || 'Google Cloud (Gemini)';
    }
  };

  const getPhaseModelName = (currentPhase: string) => {
    const phaseLower = currentPhase?.toLowerCase() || '';
    if (phaseLower.includes('plan')) return 'DeepSeek V3 0324 (OpenRouter)';
    if (phaseLower.includes('cod')) return 'DeepSeek V3 0324 (OpenRouter)';
    if (phaseLower.includes('review') || phaseLower.includes('verif')) return 'Claude 3.5 Haiku (OpenRouter)';
    if (phaseLower.includes('fix')) return 'GPT-4o Mini / GPT-4o (OpenRouter)';
    if (phaseLower.includes('consist')) return 'GPT-4o (OpenRouter)';
    if (phaseLower.includes('secur')) return 'GPT-4o (OpenRouter)';
    if (phaseLower.includes('perf')) return 'Gemini 2.5 Flash (OpenRouter)';
    if (phaseLower.includes('ui')) return 'GPT-4o Mini (OpenRouter)';
    if (phaseLower.includes('type')) return 'GPT-4o Mini (OpenRouter)';
    if (phaseLower.includes('build')) return 'GPT-4o Mini (OpenRouter)';
    return 'AI Processing...';
  };

  return (
    <div 
      ref={scrollRef}
      className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden space-y-10 pt-20 lg:pt-6 pb-10 md:pb-48 scroll-smooth custom-scrollbar relative w-full"
    >
      {/* Top Status Bar */}
      {isGenerating && (
        <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
            <span className="text-[10px] md:text-[11px] font-bold text-white uppercase tracking-wider truncate max-w-[150px] md:max-w-none">
              {currentAction || 'AI is working...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
              {phase}
            </span>
          </div>
        </div>
      )}

      {messages.map((m, idx) => (
        <MessageItem 
          key={m.id || idx} 
          message={m} 
          index={idx} 
          handleSend={handleSend} 
          isLatest={idx === messages.length - 1}
          waitingForApproval={waitingForApproval}
          phase={phase}
          saveProjectConfig={saveProjectConfig}
        />
      ))}

      {isGenerating && <PhaseTimeline statuses={builderStatuses} currentPhase={phase} />}
      
      {isGenerating && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[380px]">
           <TypingIndicator 
             status={currentAction} 
             modelName={getPhaseModelName(phase)}
           />
        </div>
      )}

      <style>{`
        @keyframes loading-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
      `}</style>
    </div>
  );
};

export default MessageList;
