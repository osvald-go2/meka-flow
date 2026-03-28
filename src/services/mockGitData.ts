import type {
  GitInfo,
  FileChange,
  BranchInfo,
  WorktreeInfo,
  CommitInfo,
  TreeNode,
  DiffOutput,
} from '../types/git';

export const mockGitInfo: GitInfo = {
  branch: 'main',
  commit_hash: 'a1b2c3d',
  commit_message: 'feat: add AI commit message generation',
  ahead: 0,
  behind: 0,
  has_upstream: true,
};

export const mockChanges: FileChange[] = [
  { path: 'src/App.tsx', status: 'M', additions: 12, deletions: 3 },
  { path: 'src/utils/helpers.ts', status: 'M', additions: 5, deletions: 8 },
  { path: 'src/components/NewFeature.tsx', status: 'A', additions: 45, deletions: 0 },
];

export const mockBranches: BranchInfo[] = [
  { name: 'main', is_current: true, is_remote: false, last_commit_time: '2 hours ago', ahead: 0, behind: 0 },
  { name: 'feat/git-panel', is_current: false, is_remote: false, last_commit_time: '1 day ago', ahead: 3, behind: 0 },
  { name: 'origin/main', is_current: false, is_remote: true, last_commit_time: '2 hours ago', ahead: 0, behind: 0 },
];

export const mockWorktrees: WorktreeInfo[] = [];

export const mockLog: CommitInfo[] = [
  {
    hash: 'a1b2c3d',
    message: 'feat: add AI commit message generation',
    author: 'Developer',
    date: '2 hours ago',
    branches: ['main'],
    files: [
      { path: 'src/services/git.ts', status: 'M' },
      { path: 'src/components/git/CommitSection.tsx', status: 'M' },
    ],
  },
  {
    hash: 'e4f5g6h',
    message: 'fix: resolve diff view scroll issue',
    author: 'Developer',
    date: '5 hours ago',
    branches: [],
    files: [{ path: 'src/components/git/DiffView.tsx', status: 'M' }],
  },
  {
    hash: 'i7j8k9l',
    message: 'feat: add worktree management UI',
    author: 'Developer',
    date: '1 day ago',
    branches: [],
    files: [
      { path: 'src/components/git/GitTab.tsx', status: 'M' },
      { path: 'src/components/git/MergeDialog.tsx', status: 'A' },
    ],
  },
  {
    hash: 'm0n1o2p',
    message: 'refactor: extract git service layer',
    author: 'Developer',
    date: '2 days ago',
    branches: [],
    files: [{ path: 'src/services/git.ts', status: 'A' }],
  },
  {
    hash: 'q3r4s5t',
    message: 'feat: initial git panel implementation',
    author: 'Developer',
    date: '3 days ago',
    branches: [],
    files: [
      { path: 'src/components/git/GitPanel.tsx', status: 'A' },
      { path: 'src/components/git/ChangesTab.tsx', status: 'A' },
    ],
  },
];

export const mockFileTree: TreeNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'directory',
    children: [
      { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
      { name: 'main.tsx', path: 'src/main.tsx', type: 'file' },
      { name: 'index.css', path: 'src/index.css', type: 'file' },
      {
        name: 'components',
        path: 'src/components',
        type: 'directory',
        children: [
          { name: 'TopBar.tsx', path: 'src/components/TopBar.tsx', type: 'file' },
          { name: 'SessionWindow.tsx', path: 'src/components/SessionWindow.tsx', type: 'file' },
        ],
      },
      {
        name: 'services',
        path: 'src/services',
        type: 'directory',
        children: [
          { name: 'git.ts', path: 'src/services/git.ts', type: 'file' },
        ],
      },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
];

export const mockDiffOutput: DiffOutput = {
  file_path: 'src/App.tsx',
  hunks: [
    {
      header: '@@ -10,6 +10,8 @@',
      lines: [
        { line_type: ' ', old_lineno: 10, new_lineno: 10, content: 'import React from "react";' },
        { line_type: '+', old_lineno: null, new_lineno: 11, content: 'import { GitProvider } from "./contexts/GitProvider";' },
        { line_type: '+', old_lineno: null, new_lineno: 12, content: 'import { useGit } from "./contexts/GitProvider";' },
        { line_type: ' ', old_lineno: 11, new_lineno: 13, content: 'import { App } from "./App";' },
      ],
    },
  ],
};
