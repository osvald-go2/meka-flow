import React from 'react';
import { Bot, Check, ChevronRight, Loader2, X } from 'lucide-react';
import { ContentBlock } from '../../types';
import { ContentBlocksView } from './ContentBlocksView';

type SubagentData = Extract<ContentBlock, { type: 'subagent' }>;

const STATUS_STYLES = {
  launched: {
    label: 'Launched',
    badgeClassName: 'border border-blue-400/20 bg-blue-400/10 text-blue-200',
    statusDotClassName: 'bg-blue-300',
    icon: Loader2,
  },
  working: {
    label: 'Working',
    badgeClassName: 'border border-blue-400/20 bg-blue-400/10 text-blue-200',
    statusDotClassName: 'bg-blue-300',
    icon: Loader2,
  },
  done: {
    label: 'Done',
    badgeClassName: 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    statusDotClassName: 'bg-emerald-300',
    icon: Check,
  },
  error: {
    label: 'Failed',
    badgeClassName: 'border border-rose-400/20 bg-rose-400/10 text-rose-200',
    statusDotClassName: 'bg-rose-300',
    icon: X,
  },
} satisfies Record<
  SubagentData['status'],
  {
    label: string;
    badgeClassName: string;
    statusDotClassName: string;
    icon: typeof Bot;
  }
>;

export function SubagentBlock({ agentId, task, status, summary, blocks }: SubagentData) {
  const statusStyle = STATUS_STYLES[status];
  const StatusIcon = statusStyle.icon;
  const hasNestedBlocks = Boolean(blocks && blocks.length > 0);

  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02] [&::-webkit-details-marker]:hidden">
        <Bot size={14} className="text-violet-400 shrink-0" />
        <span className="text-xs font-medium text-gray-400">子智能体</span>
        <span className="font-mono text-[11px] text-gray-500">{agentId}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle.badgeClassName}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.statusDotClassName}`} />
          {statusStyle.label}
        </span>
        <div className="ml-auto flex items-center gap-1 text-gray-500">
          {status === 'working' ? (
            <StatusIcon size={13} className="animate-spin" />
          ) : (
            <StatusIcon size={13} />
          )}
          {hasNestedBlocks && <ChevronRight size={14} className="transition-transform group-open:rotate-90" />}
        </div>
      </summary>

      <div className="px-4 py-3 space-y-2">
        <p className="text-[14px] leading-5 text-gray-200">{task}</p>
        {summary && <p className="text-xs text-gray-400">{summary}</p>}

        {hasNestedBlocks && (
          <div className="rounded-lg border border-white/5 bg-black/10 px-3 py-3 mt-2">
            <ContentBlocksView blocks={blocks} />
          </div>
        )}
      </div>
    </details>
  );
}
