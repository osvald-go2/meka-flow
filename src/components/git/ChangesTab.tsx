import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, FileText, FileDiff, Undo2, Loader2 } from 'lucide-react';
import { FileChange } from '../../types/git';
import { useGit } from '../../contexts/GitProvider';
import { DiffView } from './DiffView';
import { CommitSection } from './CommitSection';
import { CommitGraph } from './CommitGraph';

export interface ChangesTabProps {
  onOpenDiff?: (filePath: string) => void;
  selectedFile?: string | null;
  onFileConsumed?: () => void;
}

// ── Status letter colors ──
const statusClass: Record<string, string> = {
  M: 'text-amber-400',
  A: 'text-emerald-400',
  D: 'text-red-400',
  R: 'text-purple-400',
  U: 'text-yellow-400',
  '?': 'text-zinc-500',
};

function StatusLetter({ status }: { status: string }) {
  const cls = statusClass[status] ?? 'text-zinc-500';
  return (
    <span className={`text-[11px] font-semibold flex-shrink-0 ${cls}`}>
      {status}
    </span>
  );
}

// ── File row ──
function FileRow({
  change,
  onClick,
  onDoubleClick,
  onDiscard,
}: {
  change: FileChange;
  onClick: () => void;
  onDoubleClick?: () => void;
  onDiscard: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const fileName = change.path.split('/').pop() || change.path;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); if (e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="flex items-center justify-between h-[26px] pl-6 pr-3 cursor-pointer hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none transition-colors"
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <FileText size={13} className="text-zinc-500 flex-shrink-0" />
        <span
          className="text-[12px] text-zinc-300 truncate min-w-0"
          title={change.path}
        >
          {fileName}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {hovered && (
          <button
            onClick={onDiscard}
            className="w-5 h-5 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            title="Discard changes"
            aria-label="Discard changes"
          >
            <Undo2 size={11} />
          </button>
        )}
        {change.additions > 0 && (
          <span className="text-[11px] font-medium text-emerald-400 font-mono">
            +{change.additions}
          </span>
        )}
        {change.deletions > 0 && (
          <span className="text-[11px] font-medium text-red-400 font-mono">
            -{change.deletions}
          </span>
        )}
        <StatusLetter status={change.status} />
      </div>
    </div>
  );
}

// ── Main component ──
export function ChangesTab({ onOpenDiff, selectedFile: externalFile, onFileConsumed }: ChangesTabProps) {
  const { changes, info, loading, getDiff, discardFile, refresh } = useGit();
  const [changesOpen, setChangesOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);

  // Diff mode state
  const [diffFile, setDiffFile] = useState<FileChange | null>(null);
  const [diffHunks, setDiffHunks] = useState<import('../../types/git').DiffHunk[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  const branch = info.branch || 'main';

  // Open diff for a file
  const openDiff = useCallback(async (change: FileChange) => {
    setDiffFile(change);
    setDiffHunks([]);
    setDiffLoading(true);
    try {
      const result = await getDiff(change.path);
      setDiffHunks(result.hunks);
    } catch (err) {
      console.error('Failed to load diff:', err);
    } finally {
      setDiffLoading(false);
    }
  }, [getDiff]);

  useEffect(() => {
    if (externalFile) {
      const change = changes.find(c => c.path === externalFile);
      if (change) {
        openDiff(change);
      }
      onFileConsumed?.();
    }
  }, [externalFile]);

  const handleDiscard = useCallback(async (e: React.MouseEvent, change: FileChange) => {
    e.stopPropagation();
    try {
      await discardFile(change.path);
    } catch (err) {
      console.error('Failed to discard:', err);
    }
  }, [discardFile]);

  const handleCommitSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // ── Diff mode ──
  if (diffFile !== null) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => setDiffFile(null)}
            aria-label="Back to changes list"
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
          <FileDiff size={13} className="text-zinc-500 flex-shrink-0" />
          <span className="text-[13px] font-semibold text-zinc-100 truncate flex-1 min-w-0">
            {diffFile.path.split('/').pop()}
          </span>
          <StatusLetter status={diffFile.status} />
          <span className="flex-shrink-0 flex gap-1.5 font-mono text-[12px] font-semibold">
            {diffFile.additions > 0 && (
              <span className="text-emerald-400">+{diffFile.additions}</span>
            )}
            {diffFile.deletions > 0 && (
              <span className="text-red-400">-{diffFile.deletions}</span>
            )}
          </span>
        </div>

        {/* Diff body */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {diffLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-zinc-500 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Loading diff...
            </div>
          ) : (
            <DiffView hunks={diffHunks} />
          )}
        </div>
      </div>
    );
  }

  // ── List mode ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-zinc-500 text-sm">
        <Loader2 size={14} className="animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Changes section */}
      <div className="flex-[3] flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {/* Changes header */}
        <button
          type="button"
          className="flex items-center justify-between h-7 px-3 w-full flex-shrink-0 cursor-pointer hover:bg-white/[0.03] group"
          onClick={() => setChangesOpen((v) => !v)}
          aria-expanded={changesOpen}
        >
          <div className="flex items-center gap-1">
            {changesOpen
              ? <ChevronDown size={12} className="text-zinc-500" />
              : <ChevronRight size={12} className="text-zinc-500" />
            }
            <span className="text-[12px] font-semibold text-zinc-300">Changes</span>
            {changes.length > 0 && (
              <span className="text-[11px] text-zinc-500 ml-0.5">{changes.length}</span>
            )}
          </div>
        </button>

        {changesOpen && (
          <>
            <CommitSection
              changes={changes}
              branch={branch}
              onCommitSuccess={handleCommitSuccess}
            />
            {changes.length === 0 ? (
              <span className="text-[12px] text-zinc-600 px-3 py-1 block">
                No changes
              </span>
            ) : (
              changes.map((change) => (
                <FileRow
                  key={change.path}
                  change={change}
                  onClick={() => openDiff(change)}
                  onDoubleClick={() => onOpenDiff?.(change.path)}
                  onDiscard={(e) => handleDiscard(e, change)}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] flex-shrink-0" />

      {/* Graph section */}
      <div className="flex-[2] flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        <CommitGraph
          open={graphOpen}
          onToggle={() => setGraphOpen((v) => !v)}
        />
      </div>
    </div>
  );
}
