/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CanvasView } from './components/CanvasView';
import { BoardView } from './components/BoardView';
import { TabView } from './components/TabView';
import { TopBar } from './components/TopBar';
import { NewSessionModal } from './components/NewSessionModal';
import { GitReviewPanel } from './components/git/GitReviewPanel';
import { GitPanel } from './components/git/GitPanel';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import { GitProvider } from './contexts/GitProvider';
import { HomePage } from './components/HomePage';
import { Session, SessionStatus, Message, DbProject, DbSession, DbHarnessGroup, HarnessGroup, HarnessGroupStatus } from './types';
import type { SessionWindowHandle } from './types';
import { useHarnessController } from './services/harnessController';
import { backend } from './services/backend';
import { gitService } from './services/git';
import { initialSessions } from './data';
import { migrateModel } from './models';
import { SESSION_WIDTH, SESSION_DEFAULT_HEIGHT, SESSION_GAP } from '@/constants';

function findNextGridPosition(
  sessions: Session[],
  viewportWidth: number
): { x: number; y: number } {
  if (sessions.length === 0) return { x: 0, y: 0 };

  const gap = SESSION_GAP;
  const w = SESSION_WIDTH;
  const h = SESSION_DEFAULT_HEIGHT;

  const hasAnyCollision = (nx: number, ny: number): boolean =>
    sessions.some(s => {
      const eLeft = s.position.x - gap;
      const eRight = s.position.x + w + gap;
      const eTop = s.position.y - gap;
      const eBottom = s.position.y + (s.height ?? h) + gap;
      return nx < eRight && nx + w > eLeft && ny < eBottom && ny + h > eTop;
    });

  // Group sessions into visual rows by vertical overlap
  const sorted = [...sessions].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x
  );
  const rows: Session[][] = [];
  for (const s of sorted) {
    const sTop = s.position.y;
    const sBottom = s.position.y + (s.height ?? h);
    let placed = false;
    for (const row of rows) {
      const rowTop = Math.min(...row.map(r => r.position.y));
      const rowBottom = Math.max(...row.map(r => r.position.y + (r.height ?? h)));
      if (sTop < rowBottom && sBottom > rowTop) {
        row.push(s);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([s]);
  }
  rows.sort((a, b) =>
    Math.min(...a.map(s => s.position.y)) - Math.min(...b.map(s => s.position.y))
  );

  // Attempt 1: right of rightmost session in last row
  const lastRow = rows[rows.length - 1];
  const rightmost = lastRow.reduce((best, s) =>
    s.position.x > best.position.x ? s : best
  );
  const candX1 = rightmost.position.x + w + gap;
  const candY1 = rightmost.position.y;
  if (candX1 + w <= viewportWidth && !hasAnyCollision(candX1, candY1)) {
    return { x: candX1, y: candY1 };
  }

  // Attempt 2: new row below all sessions, aligned with first-row left edge
  const lastRowMinY = Math.min(...lastRow.map(s => s.position.y));
  const candX2 = Math.max(0, Math.min(...rows[0].map(s => s.position.x)));
  const candY2 = lastRowMinY + h + gap;
  if (!hasAnyCollision(candX2, candY2)) {
    return { x: candX2, y: candY2 };
  }

  // Fallback: right of everything at y=0
  const maxX = sessions.reduce((max, s) => Math.max(max, s.position.x + w), 0);
  return { x: maxX + gap, y: 0 };
}

function extractMessageText(m: Message): string {
  if (m.role === 'assistant' && m.blocks && m.blocks.length > 0) {
    const text = m.blocks
      .filter((b): b is { type: 'text'; content: string } =>
        b.type === 'text' && !b.content.startsWith('Connected:')
      )
      .map(b => b.content)
      .join('')
    if (text) return text
  }
  return m.content
}

function getSessionLastMessage(s: Session): string | undefined {
  if (s.messages.length === 0) return undefined
  const last = s.messages[s.messages.length - 1]
  if (last.role === 'assistant' && last.blocks && last.blocks.length > 0) {
    return last.blocks
      .filter((b): b is { type: 'text'; content: string } =>
        b.type === 'text' && !b.content.startsWith('Connected:')
      )
      .map(b => b.content)
      .join('')
      .slice(0, 100) || undefined
  }
  return last.content.slice(0, 100) || undefined
}

export default function App() {
  const [showHomePage, setShowHomePage] = useState(true);
  const [viewMode, setViewMode] = useState<'canvas' | 'board' | 'tab'>('canvas');
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  // Deduplicate sessions to prevent React duplicate key warnings from legacy data
  const dedupedSessions = useMemo(() => {
    const seen = new Set<string>();
    return sessions.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [sessions]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [copyTitle, setCopyTitle] = useState('');
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

  // Terminal State
  const [showTerminal, setShowTerminal] = useState(false);
  const [showIsland, setShowIsland] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Git Review State
  const [reviewFilePath, setReviewFilePath] = useState<string | null>(null);

  // Git Project State
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [gitPanelActiveTab, setGitPanelActiveTab] = useState<'changes' | 'git' | 'files' | null>(null);
  const [gitPanelSelectedFile, setGitPanelSelectedFile] = useState<string | null>(null);

  // Canvas Transform State (lifted from CanvasView)
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  // Persistence State
  const [currentProject, setCurrentProject] = useState<DbProject | null>(null);
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [isSwitchingProject, setIsSwitchingProject] = useState(false);
  const sessionCreatedAtRef = useRef<Record<string, string>>({});
  const loadedSessionIdsRef = useRef<Set<string>>(new Set());
  const loadedGroupIdsRef = useRef<Set<string>>(new Set());
  const canvasWidthRef = useRef(window.innerWidth);
  const sessionRefs = useRef<Map<string, SessionWindowHandle>>(new Map());
  const isElectronApp = typeof window !== 'undefined' && (window as any).aiBackend !== undefined;

  // Harness groups persistence state
  const [initialHarnessGroups, setInitialHarnessGroups] = useState<HarnessGroup[]>([]);
  const harness = useHarnessController(sessions, setSessions, projectDir, sessionRefs, initialHarnessGroups);

  // Compute terminal cwd based on active session's worktree
  const activeSession = dedupedSessions.find(s => s.id === activeSessionId);
  const terminalCwd = (activeSession?.worktree && activeSession.worktree !== 'default')
    ? activeSession.worktree
    : projectDir ?? '';

  // Ref for focusing the search input in TopBar
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ref to access latest sessions in event handlers without re-registering
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input/textarea
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setShowTerminal(v => !v);
        return;
      }

      // Cmd+N — New session
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsNewModalOpen(true);
        return;
      }

      // Cmd+K — Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Cmd+1~9 — Switch to session by index
      if ((e.ctrlKey || e.metaKey) && !isInput && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < sessionsRef.current.length) {
          setFocusedSessionId(sessionsRef.current[index].id);
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Re-check git repo status when projectDir changes
  useEffect(() => {
    if (!projectDir) return;
    gitService.checkRepo(projectDir).then(setIsGitRepo).catch(() => setIsGitRepo(false));
  }, [projectDir]);

  // Apply a project: load sessions and harness groups, restore state
  const applyProject = useCallback(async (project: DbProject) => {
    const [dbSessions, dbGroups] = await Promise.all([
      backend.loadSessions(project.id),
      backend.loadHarnessGroups(project.id),
    ]);
    const loaded: Session[] = dbSessions.map(s => {
      sessionCreatedAtRef.current[s.id] = s.created_at;
      return {
        id: s.id,
        title: s.title,
        model: migrateModel(s.model),
        status: s.status as SessionStatus,
        position: { x: s.position_x, y: s.position_y },
        height: s.height ?? undefined,
        gitBranch: s.git_branch ?? undefined,
        worktree: s.worktree ?? undefined,
        claudeSessionId: s.claude_session_id || undefined,
        codexThreadId: s.codex_thread_id || undefined,
        messages: JSON.parse(s.messages),
      };
    });

    // Deserialize harness groups; reset 'running' to 'paused' (pipeline can't resume mid-flight)
    const loadedGroups: HarnessGroup[] = dbGroups.map(g => ({
      id: g.id,
      name: g.name,
      connections: JSON.parse(g.connections_json),
      maxRetries: g.max_retries,
      status: (g.status === 'running' ? 'paused' : g.status) as HarnessGroupStatus,
      currentSprint: g.current_sprint,
      currentRound: g.current_round,
      harnessDir: g.harness_dir,
    }));

    setCurrentProject(project);
    setSessions(loaded.length > 0 ? loaded : initialSessions);
    loadedSessionIdsRef.current = new Set(loaded.map(s => s.id));
    setInitialHarnessGroups(loadedGroups);
    loadedGroupIdsRef.current = new Set(loadedGroups.map(g => g.id));
    setViewMode(project.view_mode as 'canvas' | 'board' | 'tab');
    setCanvasTransform({ x: project.canvas_x, y: project.canvas_y, scale: project.canvas_zoom });
    setProjectDir(project.path);
    setShowHomePage(false);

    // Refresh projects list
    backend.listProjects().then(setProjects).catch(() => {});
  }, []);

  // Flush pending session saves immediately
  const flushSessionSaves = useCallback(async (sessionsToSave: Session[], projectId: number) => {
    const now = new Date().toISOString();
    await Promise.all(sessionsToSave.map(session => {
      if (!sessionCreatedAtRef.current[session.id]) {
        sessionCreatedAtRef.current[session.id] = now;
      }
      const dbSession: DbSession = {
        id: session.id,
        project_id: projectId,
        title: session.title,
        model: session.model,
        status: session.status,
        position_x: session.position.x,
        position_y: session.position.y,
        height: session.height ?? null,
        git_branch: session.gitBranch ?? null,
        worktree: session.worktree ?? null,
        messages: JSON.stringify(session.messages),
        created_at: sessionCreatedAtRef.current[session.id],
        updated_at: now,
        claude_session_id: session.claudeSessionId ?? null,
        codex_thread_id: session.codexThreadId ?? null,
      };
      return backend.saveSession(dbSession);
    }));
  }, []);

  // Flush pending harness group saves immediately
  const flushHarnessGroupSaves = useCallback(async (groupsToSave: HarnessGroup[], projectId: number) => {
    const now = new Date().toISOString();
    await Promise.all(groupsToSave.map(group => {
      const dbGroup: DbHarnessGroup = {
        id: group.id,
        project_id: projectId,
        name: group.name,
        connections_json: JSON.stringify(group.connections),
        max_retries: group.maxRetries,
        status: group.status,
        current_sprint: group.currentSprint,
        current_round: group.currentRound,
        harness_dir: group.harnessDir,
        created_at: now,
        updated_at: now,
      };
      return backend.saveHarnessGroup(dbGroup);
    }));
  }, []);

  // Switch to a different project
  const switchProject = useCallback(async (projectId: number) => {
    if (isSwitchingProject) return;
    if (currentProject?.id === projectId) return;

    const target = projects.find(p => p.id === projectId);
    if (!target) return;

    setIsSwitchingProject(true);

    // Phase 1: Immediately clear UI so the user sees a responsive switch
    const prevProject = currentProject;
    const prevSessions = sessions;
    const prevGroups = harness.groups;
    const prevViewMode = viewMode;
    const prevTransform = canvasTransform;

    setSessions([]);
    setCurrentProject(null);
    setProjectDir(target.path);

    // Phase 2a: Save old project in background (fire-and-forget)
    if (prevProject) {
      Promise.all([
        backend.updateProject({
          ...prevProject,
          view_mode: prevViewMode,
          canvas_x: prevTransform.x,
          canvas_y: prevTransform.y,
          canvas_zoom: prevTransform.scale,
        }),
        flushSessionSaves(prevSessions, prevProject.id),
        flushHarnessGroupSaves(prevGroups, prevProject.id),
      ]).catch(err => console.warn('Background save failed:', err));
    }

    // Phase 2b: Load new project
    try {
      const project = await backend.openProject(target.path);
      if (!project) return;
      await applyProject(project);
    } catch (e) {
      console.error('Failed to switch project:', e);
    } finally {
      setIsSwitchingProject(false);
    }
  }, [isSwitchingProject, currentProject, viewMode, canvasTransform, sessions, projects, flushSessionSaves, flushHarnessGroupSaves, harness.groups, applyProject]);

  // Load project list and show homepage on mount
  useEffect(() => {
    if (!isElectronApp) return;

    const init = async () => {
      try {
        // Load projects list for the homepage
        const projectList = await backend.listProjects();
        setProjects(projectList);
      } catch (e) {
        console.error('Failed to load projects:', e);
      }
    };

    init();
  }, []);

  // Auto-save sessions to backend (debounced)
  useEffect(() => {
    if (!isElectronApp || !currentProject || isSwitchingProject) return;

    const saveTimeout = setTimeout(() => {
      const now = new Date().toISOString();
      sessions.forEach(session => {
        if (!sessionCreatedAtRef.current[session.id]) {
          sessionCreatedAtRef.current[session.id] = now;
        }
        const dbSession: DbSession = {
          id: session.id,
          project_id: currentProject.id,
          title: session.title,
          model: session.model,
          status: session.status,
          position_x: session.position.x,
          position_y: session.position.y,
          height: session.height ?? null,
          git_branch: session.gitBranch ?? null,
          worktree: session.worktree ?? null,
          messages: JSON.stringify(session.messages),
          created_at: sessionCreatedAtRef.current[session.id],
          updated_at: now,
          claude_session_id: session.claudeSessionId ?? null,
          codex_thread_id: session.codexThreadId ?? null,
        };
        backend.saveSession(dbSession).catch(console.error);
      });
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [sessions, currentProject]);

  // Auto-save harness groups to backend (debounced)
  useEffect(() => {
    if (!isElectronApp || !currentProject || isSwitchingProject) return;

    const saveTimeout = setTimeout(() => {
      const now = new Date().toISOString();
      harness.groups.forEach(group => {
        const dbGroup: DbHarnessGroup = {
          id: group.id,
          project_id: currentProject.id,
          name: group.name,
          connections_json: JSON.stringify(group.connections),
          max_retries: group.maxRetries,
          status: group.status,
          current_sprint: group.currentSprint,
          current_round: group.currentRound,
          harness_dir: group.harnessDir,
          created_at: now,
          updated_at: now,
        };
        backend.saveHarnessGroup(dbGroup).catch(console.error);
      });
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [harness.groups, currentProject]);

  // Sync harness group deletions to backend
  useEffect(() => {
    if (!isElectronApp || !currentProject) return;

    const currentGroupIds = new Set(harness.groups.map(g => g.id));
    const previousGroupIds = loadedGroupIdsRef.current;

    previousGroupIds.forEach(id => {
      if (!currentGroupIds.has(id)) {
        backend.deleteHarnessGroup(id).catch(console.error);
      }
    });

    loadedGroupIdsRef.current = currentGroupIds;
  }, [harness.groups, currentProject]);

  // Refs to access latest state in before-quit handler
  const currentProjectRef = useRef(currentProject);
  const harnessGroupsRef = useRef(harness.groups);
  sessionsRef.current = sessions;
  currentProjectRef.current = currentProject;
  harnessGroupsRef.current = harness.groups;

  // Flush session and harness group saves before app quit
  useEffect(() => {
    if (!isElectronApp) return;
    const aiBackend = (window as any).aiBackend;
    if (!aiBackend.onBeforeQuit) return;

    aiBackend.onBeforeQuit(async () => {
      const proj = currentProjectRef.current;
      const sess = sessionsRef.current;
      const groups = harnessGroupsRef.current;
      if (proj) {
        try {
          await Promise.all([
            flushSessionSaves(sess, proj.id),
            flushHarnessGroupSaves(groups, proj.id),
          ]);
        } catch (e) {
          console.error('Emergency flush failed:', e);
        }
      }
      aiBackend.notifyFlushComplete();
    });
  }, [flushSessionSaves, flushHarnessGroupSaves]);

  // Island integration — session-independent listeners (register once)
  useEffect(() => {
    if (!window.aiBackend) return

    // Handle message send from Island
    window.aiBackend.onIslandMessage(({ sessionId, content }) => {
      const event = new CustomEvent('island:send-message', {
        detail: { sessionId, content }
      })
      window.dispatchEvent(event)
    })

    // Handle cancel from Island
    window.aiBackend.onIslandCancel(({ sessionId }) => {
      const event = new CustomEvent('island:cancel-session', {
        detail: { sessionId }
      })
      window.dispatchEvent(event)
    })
  }, [])

  // Island integration — session-dependent listeners
  useEffect(() => {
    if (!window.aiBackend) return

    // Respond to session list requests from Island
    window.aiBackend.onIslandRequestSessions(() => {
      const islandSessions = sessionsRef.current.map(s => ({
        id: s.id,
        title: s.title,
        model: s.model,
        status: s.status,
        lastMessage: getSessionLastMessage(s),
        messageCount: s.messages.length
      }))
      window.aiBackend.sendIslandSessionsResponse(islandSessions)
    })

    // Handle message history fetch from Island
    window.aiBackend.onIslandFetchMessages(({ sessionId }) => {
      const session = sessionsRef.current.find(s => s.id === sessionId)
      if (session) {
        const simplifiedMessages = session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: extractMessageText(m),
          timestamp: m.timestamp
        }))
        window.aiBackend.sendIslandMessagesHistory(sessionId, simplifiedMessages)
      }
    })
  }, [])

  // Chat Popup integration — respond to session data requests + metadata sync
  useEffect(() => {
    if (!window.aiBackend?.ipcOn) return

    const handleSessionRequest = (_e: any, { sessionId, requestId }: { sessionId: string; requestId: string }) => {
      const session = sessionsRef.current.find(s => s.id === sessionId)
      if (session) {
        window.aiBackend.ipcSend(
          `chat-popup:session-response:${requestId}`,
          JSON.parse(JSON.stringify(session))
        )
      }
    }

    const handleMetadataUpdate = (_e: any, metadata: { id: string; title: string; status: string; claudeSessionId?: string; codexThreadId?: string }) => {
      setSessions(prev => prev.map(s =>
        s.id === metadata.id
          ? { ...s, title: metadata.title, status: metadata.status as any, claudeSessionId: metadata.claudeSessionId, codexThreadId: metadata.codexThreadId }
          : s
      ))
    }

    const handleMessagesUpdate = (_e: any, payload: { sessionId: string; messages: Message[] }) => {
      setSessions(prev => prev.map(s =>
        s.id === payload.sessionId ? { ...s, messages: payload.messages } : s
      ))
    }

    window.aiBackend.ipcOn('chat-popup:request-session', handleSessionRequest)
    window.aiBackend.ipcOn('chat-popup:metadata-updated', handleMetadataUpdate)
    window.aiBackend.ipcOn('chat-popup:messages-updated', handleMessagesUpdate)

    return () => {
      window.aiBackend.ipcOff('chat-popup:request-session', handleSessionRequest)
      window.aiBackend.ipcOff('chat-popup:metadata-updated', handleMetadataUpdate)
      window.aiBackend.ipcOff('chat-popup:messages-updated', handleMessagesUpdate)
    }
  }, [])

  // Keep Island in sync — fires when session list, statuses, or titles change
  const sessionSyncKey = sessions.map(s => `${s.id}:${s.status}:${s.title}`).join(',')
  useEffect(() => {
    if (!isElectronApp || !window.aiBackend?.sendIslandSessionsResponse) return
    const islandSessions = sessions.map(s => ({
      id: s.id,
      title: s.title,
      model: s.model,
      status: s.status,
      lastMessage: getSessionLastMessage(s),
      messageCount: s.messages.length
    }))
    window.aiBackend.sendIslandSessionsResponse(islandSessions)
  }, [sessionSyncKey])

  // Island toggle — sync status on mount and listen for changes
  useEffect(() => {
    if (!window.aiBackend?.island) return

    // Query initial status
    window.aiBackend.island.getStatus().then(setShowIsland).catch(() => {})

    // Listen for status changes (e.g. Island crashed)
    const cleanup = window.aiBackend.island.onStatusChanged(setShowIsland)
    return cleanup
  }, [])

  // Persist view mode changes
  useEffect(() => {
    if (!isElectronApp || !currentProject) return;
    backend.updateProject({ ...currentProject, view_mode: viewMode }).catch(console.error);
  }, [viewMode, currentProject]);

  // Persist canvas transform (debounced)
  useEffect(() => {
    if (!isElectronApp || !currentProject) return;
    const timeout = setTimeout(() => {
      backend.updateProject({
        ...currentProject,
        canvas_x: canvasTransform.x,
        canvas_y: canvasTransform.y,
        canvas_zoom: canvasTransform.scale,
      }).catch(console.error);
    }, 500);
    return () => clearTimeout(timeout);
  }, [canvasTransform, currentProject]);

  // Sync session deletions to backend
  useEffect(() => {
    if (!isElectronApp || !currentProject) return;

    const currentIds = new Set(sessions.map(s => s.id));
    const previousIds = loadedSessionIdsRef.current;

    previousIds.forEach(id => {
      if (!currentIds.has(id)) {
        backend.persistDeleteSession(id).catch(console.error);
        window.aiBackend?.emitSessionDeleted?.(id);
      }
    });

    loadedSessionIdsRef.current = currentIds;
  }, [sessions, currentProject]);

  const handleCreateSession = (title: string, model: string, gitBranch: string, worktree: string, initialPrompt: string) => {
    const position = findNextGridPosition(sessions, canvasWidthRef.current);
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const newSession: Session = {
      id: sessionId,
      title,
      model,
      gitBranch,
      worktree,
      status: 'inbox',
      position,
      messages: initialPrompt.trim() ? [{
        id: crypto.randomUUID(),
        role: 'user',
        content: initialPrompt.trim(),
        type: 'text',
        timestamp: Date.now()
      }] : []
    };

    setSessions(prev => [...prev, newSession]);

    // Notify Island of new session list
    if (isElectronApp && window.aiBackend) {
      // Use setTimeout to ensure sessionsRef.current includes newSession after React re-render
      setTimeout(() => {
        const islandSessions = sessionsRef.current.map(s => ({
          id: s.id,
          title: s.title,
          model: s.model,
          status: s.status,
          lastMessage: s.messages.length > 0
            ? getSessionLastMessage(s)
            : undefined,
          messageCount: s.messages.length
        }))
        window.aiBackend.sendIslandSessionsResponse(islandSessions)
      }, 0)
    }

    // Immediately persist to DB so the session survives page reloads
    if (isElectronApp && currentProject) {
      sessionCreatedAtRef.current[newSession.id] = now;
      const dbSession: DbSession = {
        id: newSession.id,
        project_id: currentProject.id,
        title: newSession.title,
        model: newSession.model,
        status: newSession.status,
        position_x: newSession.position.x,
        position_y: newSession.position.y,
        height: newSession.height ?? null,
        git_branch: newSession.gitBranch ?? null,
        worktree: newSession.worktree ?? null,
        messages: JSON.stringify(newSession.messages),
        created_at: now,
        updated_at: now,
        claude_session_id: newSession.claudeSessionId ?? null,
        codex_thread_id: newSession.codexThreadId ?? null,
      };
      backend.saveSession(dbSession).catch(console.error);
    }

    // Auto-pan canvas to the newly created session
    setFocusedSessionId(newSession.id);
  };

  const handleCopySession = (title: string) => {
    setCopyTitle(title + '_copy');
    setIsNewModalOpen(true);
  };

  const handleLocateSession = (id: string) => {
    setFocusedSessionId(id);
  };

  const handleSessionUpdate = (id: string, updates: Partial<Session>) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
  };

  const handleOpenFileInPanel = useCallback((path: string) => {
    setShowGitPanel(true);
    setGitPanelActiveTab('files');
    setGitPanelSelectedFile(path);
  }, []);

  const handleOpenDiffInPanel = useCallback((path: string) => {
    setShowGitPanel(true);
    setGitPanelActiveTab('changes');
    setGitPanelSelectedFile(path);
  }, []);

  const handleOpenDirectory = async () => {
    if (!isElectronApp) return;
    const aiBackend = (window as any).aiBackend;
    const dir = await aiBackend.openDirectory().catch(() => null);
    if (!dir) return;

    // Save current project state before switching
    if (currentProject) {
      await backend.updateProject({
        ...currentProject,
        view_mode: viewMode,
        canvas_x: canvasTransform.x,
        canvas_y: canvasTransform.y,
        canvas_zoom: canvasTransform.scale,
      }).catch(console.error);
      await flushSessionSaves(sessions, currentProject.id).catch(console.error);
    }

    const project = await backend.openProject(dir);
    if (project) {
      await applyProject(project);
    } else {
      // Fallback: just set the directory
      setProjectDir(dir);
    }
  };

  // Homepage: show when no project is open
  if (showHomePage) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-black text-white font-sans flex flex-col relative">
        {/* Atmospheric blurred background */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop)',
            opacity: 0.4,
            filter: 'blur(60px) saturate(120%)',
            transform: 'scale(1.2)'
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/20 to-black/60" />
        <HomePage
          projects={projects}
          onOpenDirectory={handleOpenDirectory}
          onSwitchProject={switchProject}
          onNewSession={() => { setShowHomePage(false); setIsNewModalOpen(true); }}
        />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#1A1A2E] text-white font-sans flex flex-col relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop)' }}
      />

      <TopBar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onNewSession={() => setIsNewModalOpen(true)}
        sessions={dedupedSessions}
        onLocateSession={handleLocateSession}
        searchInputRef={searchInputRef}
        showGitPanel={showGitPanel}
        onToggleGitPanel={() => setShowGitPanel((v) => !v)}
        showTerminal={showTerminal}
        onToggleTerminal={() => setShowTerminal(v => !v)}
        onOpenDirectory={handleOpenDirectory}
        projectDir={projectDir}
        currentProject={currentProject}
        projects={projects}
        onSwitchProject={switchProject}
        isSwitchingProject={isSwitchingProject}
        showIsland={showIsland}
        onToggleIsland={() => {
          const next = !showIsland
          setShowIsland(next)
          window.aiBackend?.island?.toggle(next)
        }}
      />

      <GitProvider projectDir={projectDir} overrideDir={(activeSession?.worktree && activeSession.worktree !== 'default') ? activeSession.worktree : null}>
        <div className="flex-1 min-h-0 relative z-10 flex flex-col overflow-hidden">
          {/* Upper area: content + Git sidebar */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 min-h-0">
              {viewMode === 'canvas' ? (
                <CanvasView
                  sessions={dedupedSessions}
                  setSessions={setSessions}
                  focusedSessionId={focusedSessionId}
                  projectDir={projectDir}
                  transform={canvasTransform}
                  onTransformChange={setCanvasTransform}
                  onCanvasResize={(w) => { canvasWidthRef.current = w; }}
                  onToggleGitPanel={() => setShowGitPanel(true)}
                  onCopySession={handleCopySession}
                  onActiveSessionChange={(id) => setActiveSessionId(id)}
                  onClearFocus={() => setFocusedSessionId(null)}
                  onNewSession={() => setIsNewModalOpen(true)}
                  harness={harness}
                  sessionRefs={sessionRefs}
                  onOpenFileInPanel={handleOpenFileInPanel}
                  onOpenDiffInPanel={handleOpenDiffInPanel}
                />
              ) : viewMode === 'board' ? (
                <BoardView
                  sessions={dedupedSessions}
                  setSessions={setSessions}
                  focusedSessionId={focusedSessionId}
                  projectDir={projectDir}
                  onToggleGitPanel={() => setShowGitPanel(true)}
                  onCopySession={handleCopySession}
                  onActiveSessionChange={(id) => setActiveSessionId(id)}
                  onClearFocus={() => setFocusedSessionId(null)}
                  onOpenFileInPanel={handleOpenFileInPanel}
                  onOpenDiffInPanel={handleOpenDiffInPanel}
                />
              ) : (
                <TabView
                  sessions={dedupedSessions}
                  setSessions={setSessions}
                  focusedSessionId={focusedSessionId}
                  projectDir={projectDir}
                  onToggleGitPanel={() => setShowGitPanel(true)}
                  onCopySession={handleCopySession}
                  onActiveSessionChange={(id) => setActiveSessionId(id)}
                  onClearFocus={() => setFocusedSessionId(null)}
                  onOpenFileInPanel={handleOpenFileInPanel}
                  onOpenDiffInPanel={handleOpenDiffInPanel}
                />
              )}
            </div>

            {/* Git Panel — side panel (only if git repo) */}
            {projectDir && isGitRepo && (
              <GitPanel
                isOpen={showGitPanel}
                onClose={() => setShowGitPanel(false)}
                onOpenDiff={(filePath) => setReviewFilePath(filePath)}
                activeTab={gitPanelActiveTab}
                selectedFile={gitPanelSelectedFile}
                onTabConsumed={() => { setGitPanelActiveTab(null); setGitPanelSelectedFile(null); }}
              />
            )}
          </div>

          {/* Lower area: Terminal panel */}
          {showTerminal && (
            <TerminalPanel
              onClose={() => setShowTerminal(false)}
              cwd={terminalCwd}
            />
          )}
        </div>

        <NewSessionModal
          isOpen={isNewModalOpen}
          onClose={() => { setIsNewModalOpen(false); setCopyTitle(''); }}
          onCreate={handleCreateSession}
          projectDir={projectDir}
          isGitRepo={isGitRepo}
          defaultTitle={copyTitle}
        />

        <GitReviewPanel
          isOpen={!!reviewFilePath}
          filePath={reviewFilePath}
          onClose={() => setReviewFilePath(null)}
        />
      </GitProvider>
    </div>
  );
}
