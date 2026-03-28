export type SessionStatus = 'inbox' | 'inprocess' | 'review' | 'done';

export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; code: string; language: string }
  | { type: 'tool_call'; tool: string; args: string; description?: string; duration?: number; status: 'running' | 'done' | 'error' }
  | { type: 'todolist'; items: TodoItem[] }
  | { type: 'subagent'; agentId: string; task: string; status: 'launched' | 'working' | 'done' | 'error'; summary?: string; blocks?: ContentBlock[] }
  | { type: 'askuser'; questions: AskUserQuestion[]; submitted?: boolean }
  | { type: 'skill'; skill: string; args?: string; status: 'invoking' | 'done' | 'error'; duration?: number }
  | { type: 'file_changes'; title: string; files: FileChangeItem[] }
  | { type: 'form_table'; title?: string; columns: FormTableColumn[]; rows: Record<string, string>[]; submitLabel?: string };

export interface FormTableColumn {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'select';
  options?: string[];
}

export interface FileChangeItem {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
}

export interface AskUserQuestion {
  id: string;
  question: string;
  options?: string[];
  response?: string;
}

export interface TodoItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'done';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'input_required' | 'code';
  blocks?: ContentBlock[];
  timestamp?: number;
}

export interface Session {
  id: string;
  title: string;
  model: string;
  gitBranch?: string;
  worktree?: string;
  status: SessionStatus;
  position: { x: number; y: number };
  messages: Message[];
  hasChanges?: boolean;
  changeCount?: number;
  height?: number;
  width?: number;
  prevHeight?: number;
  claudeSessionId?: string;
  codexThreadId?: string;
  sidecarSessionId?: string;
  harnessRole?: HarnessRole;
  harnessGroupId?: string;
}

// Harness Multi-Agent Types
export type HarnessRole = 'planner' | 'generator' | 'evaluator';

export type HarnessGroupStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface HarnessConnection {
  id: string;
  fromSessionId: string;
  toSessionId: string;
  fromRole: HarnessRole;
  toRole: HarnessRole;
}

export interface HarnessGroup {
  id: string;
  name: string;
  connections: HarnessConnection[];
  maxRetries: number;
  status: HarnessGroupStatus;
  currentSprint: number;
  currentRound: number;
  harnessDir: string;
}

// Runtime-only pipeline state, not persisted to DB.
// Held in a separate Map inside useHarnessController, keyed by group ID.
export interface HarnessRunState {
  pendingGenerators: string[];
  pendingStep: 'generator' | 'evaluator' | null;
  deferredCompletion?: string | null;
}

export interface DbHarnessGroup {
  id: string;
  project_id: number;
  name: string;
  connections_json: string;
  max_retries: number;
  status: string;
  current_sprint: number;
  current_round: number;
  harness_dir: string;
  created_at: string;
  updated_at: string;
}

export interface SessionWindowHandle {
  injectMessage(content: string): Promise<void>;
}

export interface DbProject {
  id: number;
  name: string;
  path: string;
  view_mode: string;
  canvas_x: number;
  canvas_y: number;
  canvas_zoom: number;
  last_opened_at: string;
  created_at: string;
}

export interface DbSession {
  id: string;
  project_id: number;
  title: string;
  model: string;
  status: string;
  position_x: number;
  position_y: number;
  height: number | null;
  git_branch: string | null;
  worktree: string | null;
  messages: string;
  created_at: string;
  updated_at: string;
  claude_session_id: string | null;
  codex_thread_id: string | null;
}

export interface SkillInfo {
  name: string;
  description: string;
  filePath: string;
  source: 'project' | 'user';
  pluginName?: string;
}
