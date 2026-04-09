import React from 'react';

interface TypingIndicatorProps {
  status?: string | null;
  modelName?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ status, modelName }) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm w-fit animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Animated Dots */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></div>
      </div>

      {/* Status Text & Model Info */}
      {(status || modelName) && (
        <div className="flex flex-col border-l border-white/10 pl-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-pink-500/90">
              {modelName || 'Neural Core'}
            </span>
          </div>
          <span className="text-[11px] font-medium text-zinc-300 animate-pulse">
            {status || 'Thinking...'}
          </span>
        </div>
      )}
    </div>
  );
};

export default TypingIndicator;
