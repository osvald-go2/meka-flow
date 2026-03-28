import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { gitService } from '../../services/git';
import { useFocusTrap } from '../../utils/useFocusTrap';

export interface DiscardWorktreeDialogProps {
  isOpen: boolean;
  worktreePath: string;
  branch: string;
  projectDir: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DiscardWorktreeDialog({
  isOpen,
  worktreePath,
  branch,
  projectDir,
  onClose,
  onSuccess,
}: DiscardWorktreeDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trapRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsRemoving(true);
    setError(null);
    try {
      await gitService.removeWorktree(projectDir, worktreePath, branch);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove worktree');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-labelledby="discard-dialog-title" ref={trapRef}>
      <div className="bg-surface-panel/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            <h2 id="discard-dialog-title" className="text-base font-semibold text-white">Discard Worktree</h2>
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
          {/* Warning message */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
            <p className="text-sm text-red-300 font-medium">
              This action cannot be undone.
            </p>
            <p className="text-sm text-gray-400">
              All uncommitted changes in worktree{' '}
              <span className="font-mono text-amber-300">{branch}</span> will be permanently lost.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isRemoving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/[0.06] hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isRemoving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isRemoving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Discard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
