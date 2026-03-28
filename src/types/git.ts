export interface GitInfo {
  branch: string
  commit_hash: string
  commit_message: string
  ahead: number
  behind: number
  has_upstream: boolean
}

export interface FileChange {
  path: string
  status: string // M/A/D/R/U/?
  additions: number
  deletions: number
}

export interface DiffOutput {
  file_path: string
  hunks: DiffHunk[]
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffLine {
  line_type: string // "+", "-", " "
  old_lineno: number | null
  new_lineno: number | null
  content: string
}

export interface BranchInfo {
  name: string
  is_current: boolean
  is_remote: boolean
  last_commit_time: string
  ahead: number | null
  behind: number | null
}

export interface WorktreeInfo {
  branch: string
  path: string
  commit_hash: string
  commit_message: string
  is_main: boolean
  is_current: boolean
}

export interface CommitInfo {
  hash: string
  message: string
  author: string
  date: string
  branches: string[]
  files: CommitFile[]
}

export interface CommitFile {
  path: string
  status: string
}

export interface BranchDiffStats {
  additions: number
  deletions: number
  base_branch: string
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}
