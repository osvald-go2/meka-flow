import React, { useState, useEffect } from 'react';
import { X, GitBranch, FolderGit2, ChevronDown, MessageSquare, PenLine, GitFork } from 'lucide-react';
import { gitService } from '../services/git';
import type { BranchInfo } from '../types/git';
import { useFocusTrap } from '../utils/useFocusTrap';
import { MODEL_VARIANTS, type ProviderId } from '../models';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, model: string, gitBranch: string, worktree: string, initialPrompt: string) => void;
  projectDir?: string | null;
  isGitRepo?: boolean;
  defaultTitle?: string;
}

const ClaudeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#D4A27F" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
  </svg>
);

const CodexIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#10A37F" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.778-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855L13.104 8.364l2.02-1.164a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.41-.676zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.306 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.376-3.454l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.361l2.602-1.503 2.603 1.5v3.005l-2.603 1.503-2.602-1.506z"/>
  </svg>
);

const GeminiIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285F4"/>
        <stop offset="50%" stopColor="#9B72CB"/>
        <stop offset="100%" stopColor="#D96570"/>
      </linearGradient>
    </defs>
    <path fill="url(#geminiGrad)" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
  </svg>
);

const PROVIDERS: { id: ProviderId; name: string; icon: React.FC }[] = [
  { id: 'claude', name: 'Claude Code', icon: ClaudeIcon },
  { id: 'codex', name: 'Codex', icon: CodexIcon },
  // { id: 'gemini', name: 'Gemini CLI', icon: GeminiIcon }, // TODO: not yet supported
];

export function NewSessionModal({ isOpen, onClose, onCreate, projectDir, isGitRepo, defaultTitle }: NewSessionModalProps) {
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState<ProviderId>('claude');
  const [model, setModel] = useState(MODEL_VARIANTS.claude.defaultVariant);
  const [gitBranch, setGitBranch] = useState('main');
  const [worktree, setWorktree] = useState('default');
  const [initialPrompt, setInitialPrompt] = useState('');
  const trapRef = useFocusTrap(isOpen, onClose);

  // Worktree creation state
  const [useWorktree, setUseWorktree] = useState(false);
  const [baseBranch, setBaseBranch] = useState('main');
  const [newBranch, setNewBranch] = useState('');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isCreatingWorktree, setIsCreatingWorktree] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);

  // Pre-fill title when defaultTitle is provided (e.g. copy session)
  useEffect(() => {
    if (isOpen && defaultTitle) {
      setTitle(defaultTitle);
      setGitBranch('main');
    }
  }, [isOpen, defaultTitle]);

  // Load branches when worktree mode is enabled
  useEffect(() => {
    if (useWorktree && isGitRepo && projectDir) {
      gitService.branches(projectDir).then((result) => {
        setBranches(result);
        // Set default base branch to current branch if available
        const currentBranch = result.find((b) => b.is_current);
        if (currentBranch) setBaseBranch(currentBranch.name);
      }).catch(() => {
        setBranches([]);
      });
    }
  }, [useWorktree, isGitRepo, projectDir]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalWorktree = worktree;
    let finalBranch = gitBranch;

    if (useWorktree && projectDir && newBranch.trim()) {
      setIsCreatingWorktree(true);
      setWorktreeError(null);
      try {
        // 调用后端创建 worktree，base 是基础分支名（不是路径）
        // 后端会在 .meka-flow/worktrees/ 下创建并返回实际路径
        const worktreePath = await gitService.createWorktree(projectDir, newBranch.trim(), baseBranch);
        finalWorktree = worktreePath;
        finalBranch = newBranch.trim();
      } catch (err: any) {
        setWorktreeError(err?.message ?? 'Failed to create worktree');
        setIsCreatingWorktree(false);
        return;
      } finally {
        setIsCreatingWorktree(false);
      }
    }

    onCreate(title, model, finalBranch, finalWorktree, initialPrompt);
    // Reset
    setTitle('');
    setProvider('claude');
    setModel(MODEL_VARIANTS.claude.defaultVariant);
    setGitBranch('main');
    setWorktree('default');
    setInitialPrompt('');
    setUseWorktree(false);
    setNewBranch('');
    setWorktreeError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-labelledby="new-session-title" ref={trapRef}>
      <div className="bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-7 pt-7 pb-2">
          <h2 id="new-session-title" className="text-xl font-semibold text-white">New Session</h2>
          <button onClick={onClose} aria-label="Close dialog" className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-7 pb-7 pt-4 space-y-5">
          {/* [M5] Title — required field */}
          <div className="relative">
            <PenLine size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3.5 text-white outline-none focus:border-white/15 transition-all placeholder-gray-400 text-[15px]"
              placeholder="Session title..."
              aria-label="Session title"
              required
              autoFocus
            />
          </div>

          {/* [H1] Model — radiogroup semantics */}
          <fieldset>
            <legend className="block text-[15px] font-medium text-white mb-3">Model</legend>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Provider">
              {PROVIDERS.map((p) => {
                const Icon = p.icon;
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setProvider(p.id);
                      setModel(MODEL_VARIANTS[p.id].defaultVariant);
                    }}
                    className={`flex flex-col items-center justify-center gap-2.5 py-5 px-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-white/[0.08] border-white/[0.12] text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:bg-white/[0.05] hover:text-gray-300'
                    }`}
                  >
                    <Icon />
                    <span className="text-[13px] font-medium">{p.name}</span>
                  </button>
                );
              })}
            </div>
            {MODEL_VARIANTS[provider].variants.length > 1 && (
              <div className="flex gap-2 mt-3">
                {MODEL_VARIANTS[provider].variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setModel(v.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      model === v.id
                        ? 'bg-white/[0.1] border-white/[0.15] text-white'
                        : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          {/* [C1] Worktree Toggle — role="switch" with aria-checked */}
          {isGitRepo && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={useWorktree}
                aria-label="Create in Worktree"
                onClick={() => setUseWorktree((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  useWorktree ? 'bg-amber-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    useWorktree ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <GitFork size={14} className="text-amber-400" />
                <span className="text-sm text-gray-300">Create in Worktree</span>
              </div>
            </div>
          )}

          {/* [H2] Worktree branch fields — aria-labels on all controls */}
          {useWorktree && isGitRepo ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <GitBranch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  aria-label="Base branch"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-9 py-3.5 text-white outline-none focus:border-white/15 transition-all text-[15px] appearance-none cursor-pointer"
                >
                  {branches.length > 0 ? branches.map((b) => (
                    <option className="bg-gray-900 text-white" key={b.name} value={b.name}>{b.name}</option>
                  )) : (
                    <option className="bg-gray-900 text-white" value="main">main</option>
                  )}
                </select>
              </div>
              <div className="relative">
                <FolderGit2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  aria-label="New branch name"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3.5 text-white outline-none focus:border-white/15 transition-all text-[15px] placeholder-gray-400"
                  placeholder="New branch name..."
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <GitBranch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <select
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  aria-label="Git branch"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-9 py-3.5 text-white outline-none focus:border-white/15 transition-all text-[15px] appearance-none cursor-pointer"
                >
                  <option className="bg-gray-900 text-white" value="main">main</option>
                  <option className="bg-gray-900 text-white" value="develop">develop</option>
                  <option className="bg-gray-900 text-white" value="feature">feature</option>
                  <option className="bg-gray-900 text-white" value="staging">staging</option>
                </select>
              </div>
              <div className="relative">
                <FolderGit2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                <input
                  type="text"
                  value={worktree}
                  onChange={(e) => setWorktree(e.target.value)}
                  aria-label="Worktree path"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3.5 text-white outline-none focus:border-white/15 transition-all text-[15px] placeholder-gray-400"
                  placeholder="Worktree path..."
                />
              </div>
            </div>
          )}

          {/* [M2] Error — role="alert" for screen reader announcement */}
          {worktreeError && (
            <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              {worktreeError}
            </div>
          )}

          {/* [H2] Initial Prompt — label linked via htmlFor + id */}
          <div>
            <label htmlFor="initial-prompt" className="block text-[15px] font-medium text-white mb-3">Initial Prompt</label>
            <div className="relative">
              <MessageSquare size={16} className="absolute left-3.5 top-4 text-purple-400 pointer-events-none" />
              <textarea
                id="initial-prompt"
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3.5 text-white outline-none focus:border-white/15 transition-all resize-none h-28 text-[15px] placeholder-gray-400 custom-scrollbar"
                placeholder="Enter the initial prompt to send to the session..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/[0.06] hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isCreatingWorktree}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.12] hover:bg-white/[0.18] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCreatingWorktree ? 'Creating worktree...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
