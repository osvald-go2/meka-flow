import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  GitInfo,
  FileChange,
  BranchInfo,
  WorktreeInfo,
  CommitInfo,
  TreeNode,
  DiffOutput,
} from '../types/git';
import { gitService } from '../services/git';
import * as mock from '../services/mockGitData';

function isElectron(): boolean {
  return typeof window !== 'undefined' && (window as any).aiBackend !== undefined;
}

function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const filePath of paths) {
    const parts = filePath.split('/');
    let current = root;
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const isFile = i === parts.length - 1;
      let existing = current.find(n => n.name === parts[i]);
      if (!existing) {
        existing = {
          name: parts[i],
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        };
        current.push(existing);
      }
      if (!isFile) {
        current = existing.children!;
      }
    }
  }
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => { if (n.children) sortTree(n.children); });
  };
  sortTree(root);
  return root;
}

interface GitState {
  isRepo: boolean;
  info: GitInfo;
  changes: FileChange[];
  branches: BranchInfo[];
  worktrees: WorktreeInfo[];
  log: CommitInfo[];
  fileTree: TreeNode[];
  loading: boolean;
}

interface GitActions {
  stageFile: (file: string) => Promise<void>;
  unstageFile: (file: string) => Promise<void>;
  discardFile: (file: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  createWorktree: (branch: string, base: string) => Promise<string>;
  mergeWorktree: (wtPath: string, target?: string) => Promise<string>;
  removeWorktree: (wtPath: string, branch: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshChanges: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshLog: () => Promise<void>;
  refreshInfo: () => Promise<void>;
  refreshFileTree: () => Promise<void>;
  getDiff: (file: string) => Promise<DiffOutput>;
  getFileContent: (filePath: string, gitRef?: string) => Promise<string>;
  generateCommitMsg: () => Promise<string>;
  onCommitMsgStream: (sessionId: string, onDelta: (text: string) => void) => () => void;
}

interface GitContextValue extends GitState, GitActions {}

const GitContext = createContext<GitContextValue | null>(null);

const defaultInfo: GitInfo = {
  branch: '',
  commit_hash: '',
  commit_message: '',
  ahead: 0,
  behind: 0,
  has_upstream: false,
};

interface GitProviderProps {
  projectDir: string | null;
  overrideDir?: string | null;
  children: React.ReactNode;
}

export function GitProvider({ projectDir, overrideDir, children }: GitProviderProps) {
  const [state, setState] = useState<GitState>({
    isRepo: false,
    info: defaultInfo,
    changes: [],
    branches: [],
    worktrees: [],
    log: [],
    fileTree: [],
    loading: true,
  });

  const effectiveDir = overrideDir || projectDir;
  const dirRef = useRef(effectiveDir);
  dirRef.current = effectiveDir;

  const dir = effectiveDir ?? '';

  const refreshInfo = useCallback(async () => {
    if (!dir || !isElectron()) return;
    try {
      const info = await gitService.info(dir);
      setState(prev => ({ ...prev, info }));
    } catch { /* empty repo or unavailable */ }
  }, [dir]);

  const refreshChanges = useCallback(async () => {
    if (!dir || !isElectron()) return;
    const changes = await gitService.changes(dir);
    setState(prev => ({
      ...prev,
      changes,
    }));
  }, [dir]);

  const refreshBranches = useCallback(async () => {
    if (!dir || !isElectron()) return;
    try {
      const [branches, worktrees] = await Promise.all([
        gitService.branches(dir),
        gitService.worktrees(dir),
      ]);
      // Override is_current based on active session's worktree (overrideDir)
      const activeWt = overrideDir || projectDir;
      const adjusted = worktrees.map(wt => ({
        ...wt,
        is_current: activeWt ? wt.path === activeWt : wt.is_current,
      }));
      setState(prev => ({ ...prev, branches, worktrees: adjusted }));
    } catch { /* unavailable */ }
  }, [dir, overrideDir, projectDir]);

  const refreshLog = useCallback(async () => {
    if (!dir || !isElectron()) return;
    try {
      const log = await gitService.log(dir, 50);
      setState(prev => ({ ...prev, log }));
    } catch { /* empty repo or unavailable */ }
  }, [dir]);

  const refreshFileTree = useCallback(async () => {
    if (!dir || !isElectron()) return;
    try {
      const filePaths = await gitService.fileTree(dir);
      setState(prev => ({ ...prev, fileTree: buildFileTree(filePaths) }));
    } catch { /* unavailable */ }
  }, [dir]);

  const refresh = useCallback(async () => {
    if (!dir) return;
    if (!isElectron()) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const isRepo = await gitService.checkRepo(dir);
      if (!isRepo) {
        setState(prev => ({ ...prev, isRepo: false, loading: false }));
        return;
      }
      const [info, changes, branches, rawWorktrees, log, filePaths] = await Promise.all([
        gitService.info(dir).catch(() => defaultInfo),
        gitService.changes(dir).catch(() => [] as FileChange[]),
        gitService.branches(dir).catch(() => [] as BranchInfo[]),
        gitService.worktrees(dir).catch(() => [] as WorktreeInfo[]),
        gitService.log(dir, 50).catch(() => [] as CommitInfo[]),
        gitService.fileTree(dir).catch(() => [] as string[]),
      ]);
      // Override is_current based on active session's worktree (overrideDir)
      const activeWt = overrideDir || projectDir;
      const worktrees = rawWorktrees.map(wt => ({
        ...wt,
        is_current: activeWt ? wt.path === activeWt : wt.is_current,
      }));
      setState({
        isRepo: true,
        info,
        changes,
        branches,
        worktrees,
        log,
        fileTree: buildFileTree(filePaths),
        loading: false,
      });
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [dir, overrideDir, projectDir]);

  useEffect(() => {
    if (!dir) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }
    if (!isElectron()) {
      setState({
        isRepo: true,
        info: mock.mockGitInfo,
        changes: mock.mockChanges,
        branches: mock.mockBranches,
        worktrees: mock.mockWorktrees,
        log: mock.mockLog,
        fileTree: mock.mockFileTree,
        loading: false,
      });
      return;
    }
    refresh();
  }, [dir, refresh]);

  useEffect(() => {
    if (!dir || !isElectron()) return;

    gitService.watch(dir).catch(() => {});

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingKinds = new Set<string>();

    const flushPending = () => {
      debounceTimer = null;
      const kinds = pendingKinds;
      pendingKinds = new Set();
      if (kinds.has('files') || kinds.has('head')) refreshChanges();
      if (kinds.has('refs')) refreshBranches();
      if (kinds.has('head')) {
        refreshInfo();
        refreshLog();
      }
    };

    const handler = (data: { dir: string; kind: string }) => {
      if (data.dir !== dirRef.current) return;
      pendingKinds.add(data.kind);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushPending, 300);
    };

    (window as any).aiBackend?.on('git.changed', handler);

    return () => {
      (window as any).aiBackend?.off('git.changed', handler);
      if (debounceTimer) clearTimeout(debounceTimer);
      gitService.unwatch(dir).catch(() => {});
    };
  }, [dir, refreshChanges, refreshBranches, refreshInfo, refreshLog]);

  const stageFile = useCallback(async (file: string) => {
    if (!dir) return;
    if (!isElectron()) {
      setState(prev => ({ ...prev, changes: prev.changes.filter(c => c.path !== file) }));
      return;
    }
    await gitService.stageFile(dir, file);
    await refreshChanges();
  }, [dir, refreshChanges]);

  const unstageFile = useCallback(async (file: string) => {
    if (!dir) return;
    if (!isElectron()) return;
    await gitService.unstageFile(dir, file);
    await refreshChanges();
  }, [dir, refreshChanges]);

  const discardFile = useCallback(async (file: string) => {
    if (!dir) return;
    if (!isElectron()) {
      setState(prev => ({ ...prev, changes: prev.changes.filter(c => c.path !== file) }));
      return;
    }
    await gitService.discardFile(dir, file);
    await refreshChanges();
  }, [dir, refreshChanges]);

  const commitAction = useCallback(async (message: string) => {
    if (!dir) return;
    if (!isElectron()) {
      setState(prev => ({
        ...prev,
        changes: [],
        log: [{ hash: 'mock' + Date.now(), message, author: 'You', date: 'just now', branches: [prev.info.branch], files: [] }, ...prev.log],
      }));
      return;
    }
    await gitService.commit(dir, message);
    await refresh();
  }, [dir, refresh]);

  const mainDir = projectDir ?? '';

  const createWorktree = useCallback(async (branch: string, base: string) => {
    if (!mainDir || !isElectron()) return '';
    const path = await gitService.createWorktree(mainDir, branch, base);
    await refreshBranches();
    return path;
  }, [mainDir, refreshBranches]);

  const mergeWorktree = useCallback(async (wtPath: string, target?: string) => {
    if (!mainDir || !isElectron()) return '';
    const msg = await gitService.mergeWorktree(mainDir, wtPath, target);
    await refresh();
    return msg;
  }, [mainDir, refresh]);

  const removeWorktree = useCallback(async (wtPath: string, branch: string) => {
    if (!mainDir || !isElectron()) return;
    await gitService.removeWorktree(mainDir, wtPath, branch);
    await refreshBranches();
  }, [mainDir, refreshBranches]);

  const getDiff = useCallback(async (file: string): Promise<DiffOutput> => {
    if (!dir) return { file_path: file, hunks: [] };
    if (!isElectron()) return mock.mockDiffOutput;
    return gitService.diff(dir, file);
  }, [dir]);

  const getFileContent = useCallback(async (filePath: string, gitRef?: string) => {
    if (!dir) return '';
    if (!isElectron()) return `// Mock content for ${filePath}`;
    return gitService.fileContent(dir, filePath, gitRef);
  }, [dir]);

  const generateCommitMsg = useCallback(async () => {
    if (!dir) return '';
    return gitService.generateCommitMsg(dir);
  }, [dir]);

  const onCommitMsgStream = useCallback((sessionId: string, onDelta: (text: string) => void) => {
    return gitService.onCommitMsgStream(sessionId, onDelta);
  }, []);

  const value: GitContextValue = {
    ...state,
    stageFile,
    unstageFile,
    discardFile,
    commit: commitAction,
    createWorktree,
    mergeWorktree,
    removeWorktree,
    refresh,
    refreshChanges,
    refreshBranches,
    refreshLog,
    refreshInfo,
    refreshFileTree,
    getDiff,
    getFileContent,
    generateCommitMsg,
    onCommitMsgStream,
  };

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext);
  if (!ctx) throw new Error('useGit must be used within GitProvider');
  return ctx;
}
