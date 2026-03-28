import React from 'react';
import { ContentBlock } from '../../types';
import { TextBlock } from './TextBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { TodoListBlock } from './TodoListBlock';
import { SubagentBlock } from './SubagentBlock';
import { AskUserBlock } from './AskUserBlock';
import { SkillBlock } from './SkillBlock';
import { FileChangesBlock } from './FileChangesBlock';
import { CodeBlock } from '../CodeBlock';
import { FormTableBlock } from './FormTableBlock';
import { ToolCallSummary } from './ToolCallSummary';

/** Block types that get folded into a collapsible summary */
function isToolBlock(b: ContentBlock): b is Extract<ContentBlock, { type: 'tool_call' }> | Extract<ContentBlock, { type: 'skill' }> {
  return b.type === 'tool_call' || b.type === 'skill';
}

type GroupItem =
  | { kind: 'block'; block: ContentBlock; index: number }
  | { kind: 'tool_group'; blocks: (Extract<ContentBlock, { type: 'tool_call' }> | Extract<ContentBlock, { type: 'skill' }>)[]; startIndex: number };

export function ContentBlocksView({
  blocks,
  isStreaming,
  onSendMessage,
}: {
  blocks: ContentBlock[];
  isStreaming?: boolean;
  onSendMessage?: (text: string) => void;
}) {
  // Filter out system status blocks (e.g. "Connected: ...")
  const visibleBlocks = blocks.filter(
    b => !(b.type === 'text' && b.content.startsWith('Connected:'))
  );

  // Only keep the last todolist block (feels like one list refreshing, not many)
  const lastTodoIndex = visibleBlocks.reduce(
    (acc, b, i) => (b.type === 'todolist' ? i : acc), -1
  );

  // Group consecutive tool_call/skill blocks into collapsible summaries
  const groups: GroupItem[] = [];

  for (let i = 0; i < visibleBlocks.length; i++) {
    const block = visibleBlocks[i];
    if (isToolBlock(block)) {
      const last = groups[groups.length - 1];
      if (last?.kind === 'tool_group') {
        last.blocks.push(block);
      } else {
        groups.push({ kind: 'tool_group', blocks: [block], startIndex: i });
      }
    } else {
      groups.push({ kind: 'block', block, index: i });
    }
  }

  return (
    <div className="space-y-2.5">
      {groups.map((item, gi) => {
        if (item.kind === 'tool_group') {
          return <ToolCallSummary key={`tg-${item.startIndex}`} blocks={item.blocks} />;
        }
        const { block, index } = item;
        const isLast = index === visibleBlocks.length - 1;
        switch (block.type) {
          case 'text':
            return <TextBlock key={index} content={block.content} isStreaming={isStreaming && isLast} />;
          case 'code':
            return <CodeBlock key={index} code={block.code} language={block.language} />;
          case 'tool_call':
            return <ToolCallBlock key={index} {...block} />;
          case 'todolist':
            if (index !== lastTodoIndex) return null;
            return <TodoListBlock key="todolist-latest" items={block.items} />;
          case 'subagent':
            return <SubagentBlock key={index} {...block} />;
          case 'askuser':
            return <AskUserBlock key={index} {...block} onSubmit={onSendMessage} />;
          case 'skill':
            return <SkillBlock key={index} {...block} />;
          case 'file_changes':
            return null;
          case 'form_table':
            return <FormTableBlock key={index} {...block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
