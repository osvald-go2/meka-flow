import type {
  GitInfo,
  FileChange,
  DiffOutput,
  BranchInfo,
  WorktreeInfo,
  CommitInfo,
  BranchDiffStats,
} from '../types/git';

function isElectron(): boolean {
  return typeof window !== 'undefined' && (window as any).aiBackend !== undefined;
}

async function invoke<T>(method: string, params?: any): Promise<T> {
  return (window as any).aiBackend.invoke(method, params) as Promise<T>;
}

export const gitService = {
  async checkRepo(dir: string): Promise<boolean> {
    if (!isElectron()) return false;
    const result = await invoke<{ is_repo: boolean }>('git.check_repo', { dir });
    return result.is_repo;
  },

  async init(dir: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.init', { dir });
  },

  async info(dir: string): Promise<GitInfo> {
    if (!isElectron()) {
      return {
        branch: 'main',
        commit_hash: '',
        commit_message: '',
        ahead: 0,
        behind: 0,
        has_upstream: false,
      };
    }
    return invoke<GitInfo>('git.info', { dir });
  },

  async changes(dir: string): Promise<FileChange[]> {
    if (!isElectron()) return [];
    const result = await invoke<{ changes: FileChange[] }>('git.changes', { dir });
    return result.changes;
  },

  async diff(dir: string, file: string): Promise<DiffOutput> {
    if (!isElectron()) {
      return { file_path: file, hunks: [] };
    }
    return invoke<DiffOutput>('git.diff', { dir, file });
  },

  async stageFile(dir: string, file: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.stage_file', { dir, file });
  },

  async unstageFile(dir: string, file: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.unstage_file', { dir, file });
  },

  async discardFile(dir: string, file: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.discard_file', { dir, file });
  },

  async commit(dir: string, message: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.commit', { dir, message });
  },

  async branches(dir: string): Promise<BranchInfo[]> {
    if (!isElectron()) return [];
    const result = await invoke<{ branches: BranchInfo[] }>('git.branches', { dir });
    return result.branches;
  },

  async log(dir: string, count?: number): Promise<CommitInfo[]> {
    if (!isElectron()) return [];
    const result = await invoke<{ commits: CommitInfo[] }>('git.log', { dir, count });
    return result.commits;
  },

  async worktrees(dir: string): Promise<WorktreeInfo[]> {
    if (!isElectron()) return [];
    const result = await invoke<{ worktrees: WorktreeInfo[] }>('git.worktrees', { dir });
    return result.worktrees;
  },

  async createWorktree(projectDir: string, branch: string, base: string): Promise<string> {
    if (!isElectron()) return '';
    const result = await invoke<{ path: string }>('git.create_worktree', { dir: projectDir, branch, base });
    return result.path;
  },

  async mergeWorktree(dir: string, wtPath: string, target?: string): Promise<string> {
    if (!isElectron()) return '';
    const result = await invoke<{ message: string }>('git.merge_worktree', { dir, wt_path: wtPath, target });
    return result.message;
  },

  async removeWorktree(dir: string, wtPath: string, branch: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.remove_worktree', { dir, wt_path: wtPath, branch });
  },

  async branchDiffStats(dir: string, baseBranch?: string): Promise<BranchDiffStats> {
    if (!isElectron()) {
      return { additions: 0, deletions: 0, base_branch: baseBranch ?? 'main' };
    }
    return invoke<BranchDiffStats>('git.branch_diff_stats', { dir, base_branch: baseBranch });
  },

  async fileTree(dir: string): Promise<string[]> {
    if (!isElectron()) return [];
    const result = await invoke<{ files: string[] }>('git.file_tree', { dir });
    return result.files;
  },

  async fileContent(dir: string, filePath: string, gitRef?: string): Promise<string> {
    if (!isElectron()) return '';
    const result = await invoke<{ content: string }>('git.file_content', { dir, path: filePath, ref: gitRef });
    return result.content;
  },

  async watch(dir: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.watch', { dir });
  },

  async unwatch(dir: string): Promise<void> {
    if (!isElectron()) return;
    await invoke<void>('git.unwatch', { dir });
  },

  async generateCommitMsg(dir: string): Promise<string> {
    if (!isElectron()) return `ephemeral-mock-${Date.now()}`;
    const result = await invoke<{ session_id: string }>('git.generate_commit_msg', { dir });
    return result.session_id;
  },

  onCommitMsgStream(
    sessionId: string,
    onDelta: (text: string) => void
  ): () => void {
    if (!isElectron()) return () => {};

    const wrapper = (data: { session_id: string; block_index: number; delta: any }) => {
      if (!data.session_id.startsWith('ephemeral-')) return;
      if (data.session_id !== sessionId) return;
      if (data.delta?.content) {
        onDelta(data.delta.content);
      }
    };

    (window as any).aiBackend.on('block.delta', wrapper);

    return () => {
      (window as any).aiBackend.off('block.delta', wrapper);
    };
  },
};
