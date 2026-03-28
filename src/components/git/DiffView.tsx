import React from 'react';
import { DiffHunk } from '../../types/git';

export interface DiffViewProps {
  hunks: DiffHunk[];
}

export function DiffView({ hunks }: DiffViewProps) {
  if (hunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No changes to display
      </div>
    );
  }

  return (
    <div className="font-mono text-[12px] leading-6 overflow-auto custom-scrollbar h-full">
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          {/* Hunk header */}
          <div className="px-3 py-0.5 bg-blue-950/60 text-blue-400 text-[11px] leading-6 select-none">
            {hunk.header}
          </div>

          {/* Diff lines */}
          {hunk.lines.map((line, li) => {
            const isAdd = line.line_type === '+';
            const isDel = line.line_type === '-';

            return (
              <div
                key={`${hi}-${li}`}
                className={`flex min-h-[24px] ${
                  isAdd
                    ? 'bg-emerald-500/[0.08]'
                    : isDel
                      ? 'bg-red-500/[0.10]'
                      : 'bg-transparent'
                }`}
              >
                {/* Old line number */}
                <span
                  className={`w-9 text-right pr-1.5 flex-shrink-0 select-none text-[11px] ${
                    isDel ? 'text-red-400/50' : 'text-zinc-600'
                  }`}
                >
                  {line.old_lineno ?? ''}
                </span>

                {/* New line number */}
                <span
                  className={`w-9 text-right pr-1.5 flex-shrink-0 select-none text-[11px] ${
                    isAdd ? 'text-emerald-400/50' : 'text-zinc-600'
                  }`}
                >
                  {line.new_lineno ?? ''}
                </span>

                {/* +/- indicator with color bar */}
                <span
                  className={`w-5 text-center flex-shrink-0 select-none font-bold ${
                    isAdd
                      ? 'text-emerald-400 border-l-[3px] border-emerald-400'
                      : isDel
                        ? 'text-red-400 border-l-[3px] border-red-400'
                        : 'text-transparent border-l-[3px] border-transparent'
                  }`}
                >
                  {isAdd ? '+' : isDel ? '–' : ''}
                </span>

                {/* Content */}
                <span
                  className={`whitespace-pre flex-1 min-w-0 pl-1 ${
                    isAdd
                      ? 'text-emerald-300'
                      : isDel
                        ? 'text-red-300'
                        : 'text-zinc-300'
                  }`}
                >
                  {line.content}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
