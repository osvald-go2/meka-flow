import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Undo2 } from 'lucide-react';
import { useGit } from '../../contexts/GitProvider';
import { DiffView } from './DiffView';
import type { DiffOutput } from '../../types/git';

interface GitReviewPanelProps {
  isOpen: boolean;
  filePath: string | null;
  onClose: () => void;
}

export function GitReviewPanel({ isOpen, filePath, onClose }: GitReviewPanelProps) {
  const { getDiff, stageFile, unstageFile, discardFile } = useGit();
  const [diff, setDiff] = useState<DiffOutput | null>(null);

  useEffect(() => {
    if (filePath) {
      getDiff(filePath).then(setDiff);
    } else {
      setDiff(null);
    }
  }, [filePath, getDiff]);

  // Clear state when panel closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setDiff(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleStage = async () => {
    if (!filePath) return;
    await stageFile(filePath);
  };

  const handleUnstage = async () => {
    if (!filePath) return;
    await unstageFile(filePath);
  };

  const handleDiscard = async () => {
    if (!filePath) return;
    await discardFile(filePath);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-[calc(100vw-200px)] max-w-4xl flex flex-col bg-zinc-900 shadow-2xl transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono text-zinc-300 truncate">
              {filePath ?? 'No file selected'}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleStage}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Stage file"
            >
              <Plus size={13} />
              Stage
            </button>
            <button
              onClick={handleUnstage}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Unstage file"
            >
              <Minus size={13} />
              Unstage
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              title="Discard changes"
            >
              <Undo2 size={13} />
              Discard
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {diff ? (
            <DiffView hunks={diff.hunks} />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              {filePath ? 'Loading diff...' : 'Select a file to view changes'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
