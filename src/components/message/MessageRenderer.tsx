import React from 'react';
import { ContentBlock } from '../../types';
import { TextBlock } from './TextBlock';
import { ContentBlocksView } from './ContentBlocksView';

export function MessageRenderer({
  blocks,
  fallbackContent,
  isStreaming,
  onSendMessage,
}: {
  blocks?: ContentBlock[];
  fallbackContent: string;
  isStreaming?: boolean;
  onSendMessage?: (text: string) => void;
}) {
  // No blocks → use markdown rendering on plain text content
  if (!blocks || blocks.length === 0) {
    return <TextBlock content={fallbackContent} isStreaming={isStreaming} />;
  }

  return <ContentBlocksView blocks={blocks} isStreaming={isStreaming} onSendMessage={onSendMessage} />;
}
