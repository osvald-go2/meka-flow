import React from 'react';
import { Zap, Check, Loader2, X } from 'lucide-react';
import { ContentBlock } from '../../types';

type SkillData = Extract<ContentBlock, { type: 'skill' }>;

export function SkillBlock({ skill, args, status, duration }: SkillData) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
          status === 'done' ? 'bg-green-500/20 text-green-500' :
          status === 'error' ? 'bg-red-500/20 text-red-500' :
          'bg-violet-500/20 text-violet-400'
        }`}>
          {status === 'done' && <Check size={10} strokeWidth={3} />}
          {status === 'error' && <X size={10} strokeWidth={3} />}
          {status === 'invoking' && <Loader2 size={10} className="animate-spin" />}
        </div>
        <Zap size={13} className="text-violet-400" />
        <span className="text-xs font-medium text-gray-400">{skill}</span>
        {args && <span className="text-xs text-gray-500 font-mono">{args}</span>}
        {status === 'invoking' && <span className="text-violet-400/60 text-[11px] animate-pulse">invoking...</span>}
        {status === 'error' && <span className="text-red-400/80 text-[11px]">failed</span>}
        {duration != null && status === 'done' && <span className="text-xs text-gray-500 ml-auto">{duration}s</span>}
      </div>
    </div>
  );
}
