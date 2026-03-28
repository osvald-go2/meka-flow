import React, { useState } from 'react';
import {
  GitBranch, GitMerge, ChevronDown, ChevronRight, Check, Trash2, Loader2,
} from 'lucide-react';
import { BranchInfo } from '../../types/git';
import { useGit } from '../../contexts/GitProvider';

export interface GitTabProps {
  onMerge?: (wtPath: string, branch: string) => void;
  onDiscard?: (wtPath: string, branch: string) => void;
}

function shortenPath(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

function sortBranches(branches: BranchInfo[]): BranchInfo[] {
  return [...branches].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    if (a.is_remote !== b.is_remote) return a.is_remote ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

// ── Collapsible section header ──
function SectionHeader({
  title,
  count,
  open,
  onToggle,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center w-full px-4 py-2 gap-1.5 hover:bg-white/[0.03] transition-colors"
    >
      {open
        ? <ChevronDown size={12} className="text-zinc-500" />
        : <ChevronRight size={12} className="text-zinc-500" />
      }
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        {title}
      </span>
      <span className="text-[10px] text-zinc-600">({count})</span>
    </button>
  );
}

// ── Main component ──
export function GitTab({
  onMerge,
  onDiscard,
}: GitTabProps) {
  const { info, worktrees, branches, loading, mergeWorktree, removeWorktree } = useGit();

  const [worktreesOpen, setWorktreesOpen] = useState(true);
  const [branchesOpen, setBranchesOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-zinc-500 text-sm">
        <Loader2 size={14} className="animate-spin" />
        Loading git info...
      </div>
    );
  }

  if (!info.branch) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Not a git repository
      </div>
    );
  }

  const sortedBranches = sortBranches(branches);

  const handleMerge = (wtPath: string, branch: string) => {
    mergeWorktree(wtPath).catch(console.error);
    onMerge?.(wtPath, branch);
  };

  const handleDiscard = (wtPath: string, branch: string) => {
    removeWorktree(wtPath, branch).catch(console.error);
    onDiscard?.(wtPath, branch);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Git Status Bar ── */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <GitBranch size={14} className="text-amber-400" />
          <span className="text-[13px] font-semibold text-zinc-100">
            {info.branch}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {info.ahead > 0 && (
            <span className="text-[11px] text-amber-400">
              {'\u2197'} {info.ahead} ahead
            </span>
          )}
          {info.behind > 0 && (
            <span className="text-[11px] text-red-400">
              {'\u2199'} {info.behind} behind
            </span>
          )}
          {info.commit_hash && (
            <span className="text-[11px] text-zinc-600 font-mono">
              {info.commit_hash.slice(0, 7)}
            </span>
          )}
          {info.commit_message && (
            <span className="text-[11px] text-zinc-500 truncate flex-1 min-w-0">
              {info.commit_message}
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable area ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ── Worktrees ── */}
        {worktrees.length > 0 && (
          <div>
            <SectionHeader
              title="Worktrees"
              count={worktrees.length}
              open={worktreesOpen}
              onToggle={() => setWorktreesOpen((v) => !v)}
            />
            {worktreesOpen && (
              <div className="px-3 pb-2 flex flex-col gap-1.5">
                {worktrees.map((wt) => {
                  const isCurrent = wt.is_current;
                  const isMain = wt.is_main;
                  return (
                    <div
                      key={wt.path}
                      className={`rounded-lg p-2.5 ${
                        isCurrent
                          ? 'bg-amber-400/10 border border-amber-400/60'
                          : 'bg-white/[0.03] border border-white/[0.06]'
                      }`}
                    >
                      {/* Branch row */}
                      <div className="flex items-center gap-1.5">
                        {isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        )}
                        <GitBranch
                          size={12}
                          className={isCurrent ? 'text-amber-400' : 'text-zinc-400'}
                        />
                        <span className="text-[12px] font-semibold text-zinc-100 truncate flex-1 min-w-0">
                          {wt.branch}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-400/20 px-1.5 py-px rounded">
                            Current
                          </span>
                        )}
                        {isMain && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 border border-white/10 px-1.5 py-px rounded">
                            Main
                          </span>
                        )}
                      </div>

                      {/* Commit subtitle */}
                      <div className="text-[11px] text-zinc-500 mt-1 truncate">
                        <span className="text-zinc-600 font-mono">
                          {wt.commit_hash.slice(0, 7)}
                        </span>{' '}
                        {wt.commit_message}
                      </div>

                      {/* Path */}
                      <div className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate">
                        {shortenPath(wt.path)}
                      </div>

                      {/* Merge / Discard buttons */}
                      {!wt.is_current && !wt.is_main && (
                        <div className="flex gap-1 mt-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMerge(wt.path, wt.branch); }}
                            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
                          >
                            <GitMerge size={11} />
                            {'\u5408\u5E76'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDiscard(wt.path, wt.branch); }}
                            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
                          >
                            <Trash2 size={11} />
                            {'\u820D\u5F03'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Branches ── */}
        <div>
          <SectionHeader
            title="Branches"
            count={branches.length}
            open={branchesOpen}
            onToggle={() => setBranchesOpen((v) => !v)}
          />
          {branchesOpen && (
            <div className="px-3 pb-2 flex flex-col gap-0.5">
              {sortedBranches.map((br) => (
                <div
                  key={br.name}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors"
                >
                  {br.is_current ? (
                    <Check size={13} className="text-amber-400 flex-shrink-0" />
                  ) : (
                    <GitBranch
                      size={13}
                      className={`flex-shrink-0 ${br.is_remote ? 'text-zinc-600' : 'text-zinc-400'}`}
                    />
                  )}
                  <span
                    className={`text-[12px] truncate flex-1 min-w-0 ${
                      br.is_current
                        ? 'font-semibold text-zinc-100'
                        : br.is_remote
                          ? 'text-zinc-600'
                          : 'text-zinc-300'
                    }`}
                  >
                    {br.name}
                  </span>
                  {br.ahead != null && br.ahead > 0 && (
                    <span className="text-[10px] text-emerald-400 flex-shrink-0">
                      +{br.ahead}
                    </span>
                  )}
                  {br.behind != null && br.behind > 0 && (
                    <span className="text-[10px] text-red-400 flex-shrink-0">
                      -{br.behind}
                    </span>
                  )}
                  {br.last_commit_time && (
                    <span className="text-[10px] text-zinc-600 flex-shrink-0 whitespace-nowrap">
                      {br.last_commit_time}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
