import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ContentBlock } from '../../types';
import { ToolCallBlock } from './ToolCallBlock';
import { SkillBlock } from './SkillBlock';

type ToolOrSkill = Extract<ContentBlock, { type: 'tool_call' }> | Extract<ContentBlock, { type: 'skill' }>;

const COMMAND_TOOLS = new Set(['bash', 'edit', 'write']);
const READ_TOOLS = new Set(['read', 'grep', 'glob']);

function buildSummary(blocks: ToolOrSkill[]): string {
  let commands = 0;
  let reads = 0;
  let skills = 0;

  for (const b of blocks) {
    if (b.type === 'skill') {
      skills++;
    } else {
      const t = b.tool.toLowerCase();
      if (COMMAND_TOOLS.has(t)) commands++;
      else if (READ_TOOLS.has(t)) reads++;
      else commands++; // fallback: count unknown tools as commands
    }
  }

  const parts: string[] = [];
  if (skills > 0) parts.push(`${skills} skill${skills > 1 ? 's' : ''}`);
  if (commands > 0) parts.push(`${commands} command${commands > 1 ? 's' : ''}`);
  if (reads > 0) parts.push(`${reads} read${reads > 1 ? 's' : ''}`);

  return parts.join(', ') || `${blocks.length} operations`;
}

export function ToolCallSummary({ blocks }: { blocks: ToolOrSkill[] }) {
  if (blocks.length === 0) return null;

  const summary = buildSummary(blocks);
  const hasRunning = blocks.some(
    b => (b.type === 'tool_call' && b.status === 'running') || (b.type === 'skill' && b.status === 'invoking')
  );

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="text-gray-500 shrink-0 transition-transform group-open:rotate-90" />
        <span>{summary}</span>
        {hasRunning && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
      </summary>
      <div className="pl-1 pt-1 space-y-0.5">
        {blocks.map((block, i) =>
          block.type === 'skill'
            ? <SkillBlock key={i} {...block} />
            : <ToolCallBlock key={i} {...block} />
        )}
      </div>
    </details>
  );
}
