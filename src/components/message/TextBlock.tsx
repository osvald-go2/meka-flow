import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '../CodeBlock';

// Detect tree-like lines (├── └── │ lines) and wrap them in code fences
function wrapTreeBlocks(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let treeLines: string[] = [];

  const isTreeLine = (line: string) =>
    /[├└│┌┐┘┤┬┴┼╔╗╚╝╠╣╦╩╬─|]/.test(line) && /[├└│┌─╔╗╚╝╠╣╦╩╬]/.test(line);

  const flushTree = () => {
    if (treeLines.length >= 2) {
      result.push('```text');
      result.push(...treeLines);
      result.push('```');
    } else {
      result.push(...treeLines);
    }
    treeLines = [];
  };

  for (const line of lines) {
    if (isTreeLine(line)) {
      treeLines.push(line);
    } else {
      if (treeLines.length > 0) flushTree();
      result.push(line);
    }
  }
  if (treeLines.length > 0) flushTree();

  return result.join('\n');
}

export function TextBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const processedContent = useMemo(() => wrapTreeBlocks(content), [content]);

  return (
    <div className="space-y-3 leading-relaxed text-[15px] text-gray-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className="my-0">{children}</p>;
          },
          strong({ children }) {
            return <strong className="text-white font-semibold">{children}</strong>;
          },
          em({ children }) {
            return <em className="text-gray-400">{children}</em>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                {children}
              </a>
            );
          },
          code({ className, children }) {
            const match = className?.match(/language-(\w+)/);
            const content = String(children).replace(/\n$/, '');
            if (match || content.includes('\n')) {
              return <CodeBlock code={content} language={match?.[1] || 'text'} />;
            }
            return (
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          h1({ children }) {
            return <h1 className="text-white font-medium text-lg mt-4">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-white font-medium text-base mt-3">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-white font-medium text-[15px] mt-2">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-white font-medium text-[15px] mt-2">{children}</h4>;
          },
          blockquote({ children }) {
            return (
              <div className="border-l-2 border-white/10 pl-4 py-1 text-gray-400 italic text-sm">{children}</div>
            );
          },
          ul({ children }) {
            return <ul className="space-y-1.5 list-disc list-inside marker:text-gray-500">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-1.5 marker:text-gray-500">{children}</ol>;
          },
          table({ children }) {
            return (
              <div className="rounded-lg border border-white/10 overflow-x-auto custom-scrollbar my-3">
                <table className="w-full">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-white/[0.05]">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-xs font-semibold text-gray-300 text-left border-b border-white/10">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-sm text-gray-400 border-b border-white/[0.05]">{children}</td>;
          },
          hr() {
            return <hr className="border-white/10 my-4" />;
          },
          del({ children }) {
            return <del className="text-gray-500 line-through">{children}</del>;
          },
          input({ checked, ...props }) {
            return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-blue-500" {...props} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current animate-pulse align-middle"></span>
      )}
    </div>
  );
}
