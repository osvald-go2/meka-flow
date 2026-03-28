import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import { FileChange } from '../../types/git';
import { useGit } from '../../contexts/GitProvider';

export interface CommitSectionProps {
  changes: FileChange[];
  branch: string;
  onCommitSuccess: () => void;
}

export function CommitSection({
  changes,
  branch,
  onCommitSuccess,
}: CommitSectionProps) {
  const { commit, generateCommitMsg, onCommitMsgStream } = useGit();
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const minH = 34;
    const maxH = 216; // 10 lines
    const newH = Math.max(minH, Math.min(el.scrollHeight, maxH));
    el.style.height = `${newH}px`;
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => { autoResize(); }, [commitMessage, autoResize]);

  // Cleanup streaming listener on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const canGenerate = !isGenerating && changes.length > 0;
  const canCommit = commitMessage.trim().length > 0 && changes.length > 0 && !isCommitting;

  // AI generate commit message
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setError(null);
    setIsGenerating(true);
    setCommitMessage('');

    // Clean up previous listener
    cleanupRef.current?.();
    cleanupRef.current = null;

    try {
      const sessionId = await generateCommitMsg();

      let accumulated = '';
      const cleanup = onCommitMsgStream(sessionId, (delta) => {
        accumulated += delta;
        setCommitMessage(accumulated.trim().replace(/^["']|["']$/g, ''));
      });
      cleanupRef.current = cleanup;

      // For non-Electron (mock), the sessionId starts with "ephemeral-mock-"
      // The stream will not fire, so we end generation after a short timeout
      if (sessionId.startsWith('ephemeral-mock-')) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (!accumulated) {
          setCommitMessage('feat: update project files');
        }
        setIsGenerating(false);
        cleanup();
        cleanupRef.current = null;
      }
    } catch (err) {
      setError(`Generate failed: ${err}`);
      setIsGenerating(false);
    }
  }, [canGenerate, generateCommitMsg, onCommitMsgStream]);

  const handleCommit = useCallback(async () => {
    if (!canCommit) return;
    setError(null);
    setIsCommitting(true);
    try {
      await commit(commitMessage.trim());
      setCommitMessage('');
      onCommitSuccess();
    } catch (err) {
      setError(`Commit failed: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  }, [canCommit, commit, commitMessage, onCommitSuccess]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!textareaRef.current || document.activeElement !== textareaRef.current) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        if (canGenerate) handleGenerate();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canCommit) handleCommit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGenerate, canCommit, handleGenerate, handleCommit]);

  return (
    <div className="flex flex-col gap-2 px-3 py-2 border-b border-white/[0.06]">
      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={commitMessage}
          onChange={(e) => {
            setCommitMessage(e.target.value);
            setError(null);
          }}
          placeholder={branch ? `Message (\u2318\u21B5 to commit on "${branch}")` : 'Commit message...'}
          rows={1}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-[7px] pr-8 text-[12px] text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20 resize-none custom-scrollbar overflow-hidden leading-5"
          style={{ minHeight: '34px', maxHeight: '216px', boxSizing: 'border-box' }}
        />
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          title="AI Generate commit message (\u2318G)"
          className="absolute right-1.5 top-[5px] w-6 h-6 rounded-md flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
        </button>
      </div>

      {/* Commit button */}
      <button
        onClick={handleCommit}
        disabled={!canCommit}
        title="Commit (\u2318Enter)"
        className="flex items-center justify-center gap-1.5 w-full h-[34px] bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] font-semibold text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-default transition-colors"
      >
        {isCommitting ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Check size={13} />
        )}
        Commit
      </button>

      {error && (
        <span className="text-[11px] text-red-400 leading-snug">{error}</span>
      )}
    </div>
  );
}
