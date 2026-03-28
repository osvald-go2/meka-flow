import React, { useState, useEffect } from 'react';
import { X, GitMerge, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { gitService } from '../../services/git';
import type { BranchInfo } from '../../types/git';
import { useFocusTrap } from '../../utils/useFocusTrap';

export interface MergeDialogProps {
  isOpen: boolean;
  worktreePath: string;
  branch: string;
  projectDir: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function MergeDialog({
  isOpen,
  worktreePath,
  branch,
  projectDir,
  onClose,
  onSuccess,
}: MergeDialogProps) {
  const [targetBranch, setTargetBranch] = useState('main');
  const [removeAfterMerge, setRemoveAfterMerge] = useState(true);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    gitService.branches(projectDir).then((result) => {
      // Exclude the current worktree branch from target options
      const others = result.filter((b) => b.name !== branch && !b.is_remote);
      setBranches(others);
      const main = others.find((b) => b.name === 'main') ?? others[0];
      if (main) setTargetBranch(main.name);
    }).catch(() => {
      setBranches([]);
    });
  }, [isOpen, projectDir, branch]);

  const trapRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsMerging(true);
    setError(null);
    try {
      await gitService.mergeWorktree(projectDir, worktreePath, targetBranch || undefined);
      if (removeAfterMerge) {
        await gitService.removeWorktree(projectDir, worktreePath, branch);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-labelledby="merge-dialog-title" ref={trapRef}>
      <div className="bg-surface-panel/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <GitMerge size={18} className="text-emerald-400" />
            <h2 id="merge-dialog-title" className="text-base font-semibold text-white">Merge Worktree</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Info */}
          <p className="text-sm text-gray-400">
            Merge branch <span className="font-mono text-amber-300">{branch}</span> into:
          </p>

          {/* Target branch selector */}
          <div className="relative">
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              aria-label="Target branch"
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-white/20 appearance-none cursor-pointer"
            >
              {branches.map((b) => (
                <option className="bg-gray-900 text-white" key={b.name} value={b.name}>{b.name}</option>
              ))}
              {branches.length === 0 && (
                <option className="bg-gray-900 text-white" value="main">main</option>
              )}
            </select>
          </div>

          {/* Remove after merge toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={removeAfterMerge}
              onChange={(e) => setRemoveAfterMerge(e.target.checked)}
              className="w-4 h-4 rounded border border-white/20 bg-white/5 accent-emerald-500 cursor-pointer"
            />
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              Remove worktree after merge
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isMerging}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/[0.06] hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isMerging}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isMerging ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge size={14} />
                  Merge
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
