import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useGit } from '../../contexts/GitProvider';

export interface CommitGraphProps {
  open?: boolean;
  onToggle?: () => void;
}

const statusClass: Record<string, string> = {
  M: 'text-amber-400',
  A: 'text-emerald-400',
  D: 'text-red-400',
  R: 'text-purple-400',
  '?': 'text-zinc-500',
};

export function CommitGraph({
  open = true,
  onToggle,
}: CommitGraphProps) {
  const { log: commits, loading } = useGit();
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());

  // Scroll pagination
  const [displayCount, setDisplayCount] = useState(50);
  const visibleCommits = commits.slice(0, displayCount);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setDisplayCount(prev => Math.min(prev + 50, commits.length));
    }
  };

  const toggleCommit = (hash: string) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  return (
    <>
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between h-7 px-3 flex-shrink-0 cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-1">
          {open
            ? <ChevronDown size={12} className="text-zinc-500" />
            : <ChevronRight size={12} className="text-zinc-500" />
          }
          <span className="text-[12px] font-semibold text-zinc-300">Graph</span>
        </div>
      </div>

      {open && (
        <div className="flex-1 overflow-y-auto custom-scrollbar" onScroll={handleScroll}>
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-zinc-600 text-[12px]">
              Loading...
            </div>
          ) : visibleCommits.length === 0 ? (
            <span className="text-[12px] text-zinc-600 px-3 py-1 block">
              No commits
            </span>
          ) : (
            visibleCommits.map((commit) => {
              const isExpanded = expandedCommits.has(commit.hash);
              return (
                <div key={commit.hash}>
                  <div
                    onClick={() => toggleCommit(commit.hash)}
                    className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Green dot */}
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />

                    {/* Message */}
                    <span className="text-[12px] text-zinc-200 truncate flex-1 min-w-0">
                      {commit.message}
                    </span>

                    {/* Branch badges */}
                    {commit.branches.map((br) => (
                      <span
                        key={br}
                        className="text-[10px] text-zinc-400 border border-white/[0.12] rounded px-1 py-0 leading-4 flex-shrink-0 whitespace-nowrap"
                      >
                        {br}
                      </span>
                    ))}
                  </div>

                  {/* Expanded files */}
                  {isExpanded && commit.files.length > 0 && (
                    <div>
                      {commit.files.map((file, i) => (
                        <div
                          key={`${commit.hash}-${i}`}
                          className="flex items-center justify-between h-6 pl-7 pr-3"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <FileText size={11} className="text-zinc-600 flex-shrink-0" />
                            <span className="text-[11px] text-zinc-500 truncate min-w-0">
                              {file.path}
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-semibold flex-shrink-0 ${
                              statusClass[file.status] ?? 'text-zinc-500'
                            }`}
                          >
                            {file.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
