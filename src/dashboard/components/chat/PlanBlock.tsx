
import React, { useState } from 'react';
import { ListChecks, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

interface PlanStep {
  title?: string;
  subPlans?: string[];
  [key: string]: any;
}

interface PlanBlockProps {
  plan: (string | PlanStep)[];
  isLocal?: boolean;
  activePlanIndex?: number;
  completedPlanIndices?: number[];
}

const PlanBlock: React.FC<PlanBlockProps> = ({ plan, isLocal, activePlanIndex, completedPlanIndices }) => {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  if (!plan || plan.length === 0) return null;

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="mb-6 bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-white/5 pb-3">
        <ListChecks size={16} className={isLocal ? 'text-amber-500' : 'text-pink-500'} />
        <span className="text-[10px] font-black uppercase tracking-widest text-white">Execution Plan</span>
      </div>
      <div className="space-y-3">
        {plan.map((step, i) => {
          const isObject = typeof step === 'object' && step !== null;
          const title = isObject ? (step.title || step.step || 'Step ' + (i + 1)) : step;
          const subPlans = isObject ? (step.subPlans || step.substeps || []) : [];
          const hasSubPlans = subPlans.length > 0;
          const isExpanded = expandedItems[i];
          const isActive = activePlanIndex === i;
          const isCompleted = completedPlanIndices?.includes(i);

          return (
            <div key={i} className="flex flex-col gap-2">
              <div 
                className={`flex items-start gap-3 ${hasSubPlans ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={() => hasSubPlans && toggleExpand(i)}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${isLocal ? 'bg-amber-500/10 border-amber-500/30' : 'bg-pink-500/10 border-pink-500/30'}`}>
                  {isActive ? (
                    <Loader2 size={12} className={`animate-spin ${isLocal ? 'text-amber-500' : 'text-pink-500'}`} />
                  ) : isCompleted ? (
                    <CheckCircle2 size={12} className={isLocal ? 'text-amber-500' : 'text-pink-500'} />
                  ) : hasSubPlans ? (
                    isExpanded ? <ChevronDown size={12} className={isLocal ? 'text-amber-500' : 'text-pink-500'} /> : <ChevronRight size={12} className={isLocal ? 'text-amber-500' : 'text-pink-500'} />
                  ) : (
                    <span className={`text-[9px] font-black ${isLocal ? 'text-amber-500' : 'text-pink-500'}`}>{i + 1}</span>
                  )}
                </div>
                <span className={`text-[11px] font-bold leading-snug mt-1 ${isActive ? 'text-white' : 'text-zinc-400'}`}>{title}</span>
              </div>
              
              {hasSubPlans && (isExpanded || isActive) && (
                <div className="pl-8 space-y-2 mt-1">
                  {subPlans.map((sub: string, j: number) => (
                    <div key={j} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${isActive ? (isLocal ? 'bg-amber-500' : 'bg-pink-500') : 'bg-zinc-600'}`} />
                      <span className={`text-[10px] font-medium leading-snug ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>{sub}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanBlock;
