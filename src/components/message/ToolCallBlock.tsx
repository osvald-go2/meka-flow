import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { ContentBlock } from '../../types';

type ToolCallData = Extract<ContentBlock, { type: 'tool_call' }>;

const TOOL_COLORS: Record<string, string> = {
  glob: 'text-purple-400',
  read: 'text-blue-400',
  bash: 'text-green-400',
  write: 'text-orange-400',
  edit: 'text-orange-400',
  grep: 'text-purple-400',
  taskcreate: 'text-teal-400',
  taskupdate: 'text-teal-400',
  tasklist: 'text-teal-400',
  taskget: 'text-teal-400',
};

function lastSegment(p: string): string {
  return p.replace(/\/+$/, '').split('/').pop() || p;
}

function shortenDisplay(tool: string, text: string): string {
  if (!text) return text;
  const dashIdx = text.indexOf(' — ');
  if (dashIdx > 0) {
    const path = text.slice(0, dashIdx);
    const desc = text.slice(dashIdx);
    return lastSegment(path) + desc;
  }
  if (tool === 'bash') return text;
  if (tool === 'grep' && !text.includes('/')) return text;
  if (text.includes('/')) return lastSegment(text);
  return text;
}

export function ToolCallBlock({ tool, args, description, duration, status }: ToolCallData) {
  const colorClass = TOOL_COLORS[tool.toLowerCase()] || 'text-cyan-400';
  const rawText = description || args;
  const displayText = shortenDisplay(tool, rawText);

  return (
    <div className="flex items-center justify-between group cursor-pointer font-mono text-sm py-0.5 overflow-x-auto scrollbar-on-hover">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${
          status === 'done' ? 'bg-green-500/20 text-green-500' :
          status === 'error' ? 'bg-red-500/20 text-red-500' :
          'bg-yellow-500/20 text-yellow-500'
        }`}>
          {status === 'done' && <Check size={10} strokeWidth={3} />}
          {status === 'error' && <X size={10} strokeWidth={3} />}
          {status === 'running' && <Loader2 size={10} className="animate-spin" />}
        </div>
        <span className={`${colorClass} font-medium shrink-0`}>{tool}</span>
        <span className="text-gray-400 whitespace-nowrap" title={rawText !== displayText ? rawText : undefined}>{displayText}</span>
      </div>
      {duration != null && (
        <div className="flex items-center gap-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <span>{duration}s</span>
          <span className="text-xs">&gt;</span>
        </div>
      )}
    </div>
  );
}
