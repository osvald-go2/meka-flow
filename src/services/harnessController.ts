import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Session,
  HarnessGroup,
  HarnessConnection,
  HarnessRole,
  HarnessRunState,
  SessionWindowHandle,
} from '../types';
import { writeHarnessFile, readHarnessFile } from './harnessFiles';
import {
  buildGeneratorPrompt,
  buildEvaluatorPrompt,
  buildRevisionPrompt,
  parseVerdict,
} from './harnessPrompts';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface UseHarnessController {
  groups: HarnessGroup[];
  createGroup(name: string): HarnessGroup;
  deleteGroup(groupId: string): void;
  addConnection(
    groupId: string,
    fromSessionId: string,
    toSessionId: string,
    fromRole: HarnessRole,
    toRole: HarnessRole
  ): void;
  removeConnection(connectionId: string): void;
  startPipeline(groupId: string): void;
  pausePipeline(groupId: string): void;
  resumePipeline(groupId: string): void;
  stopPipeline(groupId: string): void;
  getSessionRole(sessionId: string): { role: HarnessRole; groupId: string } | null;
  getAllConnections(): HarnessConnection[];
}

export function useHarnessController(
  sessions: Session[],
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
  projectDir: string | null,
  sessionRefs: React.RefObject<Map<string, SessionWindowHandle>>,
  initialGroups?: HarnessGroup[]
): UseHarnessController {
  const [groups, setGroups] = useState<HarnessGroup[]>(initialGroups ?? []);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  // Reset groups when initialGroups changes (project switch)
  const initialGroupsRef = useRef(initialGroups);
  useEffect(() => {
    if (initialGroups && initialGroups !== initialGroupsRef.current) {
      setGroups(initialGroups);
      initialGroupsRef.current = initialGroups;
    }
  }, [initialGroups]);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const projectDirRef = useRef(projectDir);
  projectDirRef.current = projectDir;

  // Runtime-only pipeline state, separate from persistent HarnessGroup
  const runStateRef = useRef<Map<string, HarnessRunState>>(new Map());

  const getRunState = (groupId: string): HarnessRunState => {
    if (!runStateRef.current.has(groupId)) {
      runStateRef.current.set(groupId, { pendingGenerators: [], pendingStep: null, deferredCompletion: null });
    }
    return runStateRef.current.get(groupId)!;
  };

  const setRunState = (groupId: string, updates: Partial<HarnessRunState>) => {
    const current = getRunState(groupId);
    runStateRef.current.set(groupId, { ...current, ...updates });
  };

  const clearRunState = (groupId: string) => {
    runStateRef.current.delete(groupId);
  };

  // Clean up connections when sessions are deleted
  useEffect(() => {
    const sessionIds = new Set(sessions.map(s => s.id));
    setGroups(prev => {
      let changed = false;
      const updated = prev.map(g => {
        const filtered = g.connections.filter(
          c => sessionIds.has(c.fromSessionId) && sessionIds.has(c.toSessionId)
        );
        if (filtered.length !== g.connections.length) {
          changed = true;
          return { ...g, connections: filtered };
        }
        return g;
      });
      return changed ? updated : prev;
    });
  }, [sessions]);

  // --- Group Management ---

  const createGroup = useCallback((name: string): HarnessGroup => {
    const group: HarnessGroup = {
      id: generateId(),
      name,
      connections: [],
      maxRetries: 3,
      status: 'idle',
      currentSprint: 0,
      currentRound: 0,
      harnessDir: `.harness/${generateId()}`,
    };
    setGroups(prev => [...prev, group]);
    return group;
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    clearRunState(groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }, []);

  const updateGroup = useCallback((groupId: string, updates: Partial<HarnessGroup>) => {
    setGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, ...updates } : g))
    );
  }, []);

  const addConnection = useCallback((
    groupId: string,
    fromSessionId: string,
    toSessionId: string,
    fromRole: HarnessRole,
    toRole: HarnessRole
  ) => {
    const conn: HarnessConnection = {
      id: generateId(),
      fromSessionId,
      toSessionId,
      fromRole,
      toRole,
    };
    setGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, connections: [...g.connections, conn] }
          : g
      )
    );
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        connections: g.connections.filter(c => c.id !== connectionId),
      }))
    );
  }, []);

  // --- Helper: find sessions by role in a group ---

  const getSessionsByRole = useCallback((group: HarnessGroup, role: HarnessRole): string[] => {
    const ids = new Set<string>();
    for (const conn of group.connections) {
      if (conn.fromRole === role) ids.add(conn.fromSessionId);
      if (conn.toRole === role) ids.add(conn.toSessionId);
    }
    return [...ids];
  }, []);

  // --- Helper: extract last assistant message text ---

  const getLastAssistantText = useCallback((sessionId: string): string => {
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (!session) return '';
    const assistantMsgs = session.messages.filter(m => m.role === 'assistant');
    if (assistantMsgs.length === 0) return '';
    const lastMsg = assistantMsgs[assistantMsgs.length - 1];
    if (lastMsg.blocks) {
      return lastMsg.blocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.content)
        .join('\n');
    }
    return lastMsg.content || '';
  }, []);

  // --- Pipeline Orchestration ---

  const dispatchGenerators = useCallback(async (
    groupId: string,
    group: HarnessGroup,
    generators: string[],
    prompt: string
  ) => {
    setRunState(groupId, {
      pendingGenerators: [...generators],
      pendingStep: 'generator',
    });
    for (const genId of generators) {
      sessionRefs.current?.get(genId)?.injectMessage(prompt);
    }
  }, [sessionRefs]);

  const dispatchEvaluators = useCallback(async (
    groupId: string,
    evaluators: string[],
    prompt: string
  ) => {
    setRunState(groupId, {
      pendingGenerators: [],
      pendingStep: 'evaluator',
    });
    for (const evalId of evaluators) {
      sessionRefs.current?.get(evalId)?.injectMessage(prompt);
    }
  }, [sessionRefs]);

  const advancePipeline = useCallback(async (groupId: string, completedSessionId: string) => {
    console.log('[harness] advancePipeline called:', { groupId, completedSessionId });
    const group = groupsRef.current.find(g => g.id === groupId);
    const dir = projectDirRef.current;
    if (!group || !dir) {
      console.log('[harness] advancePipeline bail: group=', !!group, 'projectDir=', dir);
      return;
    }

    // If paused, store the completion for replay on resume
    if (group.status === 'paused') {
      setRunState(groupId, { deferredCompletion: completedSessionId });
      return;
    }
    if (group.status !== 'running') return;

    const planners = getSessionsByRole(group, 'planner');
    const generators = getSessionsByRole(group, 'generator');
    const evaluators = getSessionsByRole(group, 'evaluator');
    const runState = getRunState(groupId);

    // --- Planner completed ---
    if (planners.includes(completedSessionId)) {
      const planContent = getLastAssistantText(completedSessionId);
      if (!planContent) return;

      await writeHarnessFile(
        dir, group.id, group.currentSprint, 'plan.md', planContent
      );

      const prompt = buildGeneratorPrompt(group.currentSprint, planContent);
      await dispatchGenerators(groupId, group, generators, prompt);
      return;
    }

    // --- Generator completed ---
    if (generators.includes(completedSessionId)) {
      const resultContent = getLastAssistantText(completedSessionId);

      const filename = group.currentRound > 0
        ? `result-${group.currentRound + 1}.md`
        : 'result.md';

      await writeHarnessFile(
        dir, group.id, group.currentSprint, filename, resultContent
      );

      const pending = runState.pendingGenerators.filter(id => id !== completedSessionId);
      setRunState(groupId, { pendingGenerators: pending });

      if (pending.length > 0) {
        return;
      }

      const planContent = await readHarnessFile(
        dir, group.id, group.currentSprint, 'plan.md'
      );

      const evalPrompt = buildEvaluatorPrompt(
        group.currentSprint,
        group.currentRound + 1,
        planContent,
        resultContent
      );

      await dispatchEvaluators(groupId, evaluators, evalPrompt);
      return;
    }

    // --- Evaluator completed ---
    if (evaluators.includes(completedSessionId)) {
      const reviewContent = getLastAssistantText(completedSessionId);
      const reviewFilename = `review-${group.currentRound + 1}.md`;

      await writeHarnessFile(
        dir, group.id, group.currentSprint, reviewFilename, reviewContent
      );

      const verdict = parseVerdict(reviewContent);

      if (verdict === 'PASS') {
        updateGroup(groupId, { status: 'completed' });
        clearRunState(groupId);
        return;
      }

      const nextRound = group.currentRound + 1;
      if (nextRound >= group.maxRetries) {
        updateGroup(groupId, { status: 'failed', currentRound: nextRound });
        clearRunState(groupId);
        return;
      }

      const planContent = await readHarnessFile(
        dir, group.id, group.currentSprint, 'plan.md'
      );
      const resultFilename = group.currentRound > 0
        ? `result-${group.currentRound + 1}.md`
        : 'result.md';
      const resultContent = await readHarnessFile(
        dir, group.id, group.currentSprint, resultFilename
      );

      const revisionPrompt = buildRevisionPrompt(
        group.currentSprint,
        nextRound,
        planContent,
        resultContent,
        reviewContent
      );

      updateGroup(groupId, { currentRound: nextRound });
      await dispatchGenerators(groupId, group, generators, revisionPrompt);
      return;
    }
  }, [getSessionsByRole, getLastAssistantText, updateGroup,
      dispatchGenerators, dispatchEvaluators]);

  // --- Completion Detection ---
  // Use ref for advancePipeline to avoid re-registering listener on every render
  const advancePipelineRef = useRef(advancePipeline);
  advancePipelineRef.current = advancePipeline;

  useEffect(() => {
    const handleComplete = (event: any) => {
      console.log('[harness] message.complete event:', JSON.stringify(event));
      console.log('[harness] groups:', groupsRef.current.map(g => ({ id: g.id, status: g.status, conns: g.connections.length })));

      const backendSessionId = event?.session_id;
      if (!backendSessionId) return;

      const session = sessionsRef.current.find(
        s => s.sidecarSessionId === backendSessionId ||
             s.claudeSessionId === backendSessionId ||
             s.codexThreadId === backendSessionId
      );
      if (!session) {
        console.log('[harness] no matching session for:', backendSessionId);
        return;
      }
      console.log('[harness] matched session:', session.id, session.title);

      const group = groupsRef.current.find(
        g => (g.status === 'running' || g.status === 'paused') &&
          g.connections.some(
            c => c.fromSessionId === session.id || c.toSessionId === session.id
          )
      );
      if (!group) {
        console.log('[harness] no running/paused group for session:', session.id);
        return;
      }
      console.log('[harness] advancing pipeline for group:', group.id, 'session:', session.id);

      setTimeout(() => advancePipelineRef.current(group.id, session.id), 500);
    };

    if (typeof window !== 'undefined' && window.aiBackend) {
      window.aiBackend.on('message.complete', handleComplete);
      console.log('[harness] registered message.complete listener');
    }
    return () => {
      if (typeof window !== 'undefined' && window.aiBackend) {
        window.aiBackend.off('message.complete', handleComplete);
      }
    };
  }, []); // Empty deps — refs always have latest values

  // --- Pipeline Control ---

  const startPipeline = useCallback((groupId: string) => {
    const group = groupsRef.current.find(g => g.id === groupId);
    if (!group || group.status === 'running') return;

    clearRunState(groupId);
    updateGroup(groupId, {
      status: 'running',
      currentSprint: group.currentSprint + 1,
      currentRound: 0,
    });
  }, [updateGroup]);

  const pausePipeline = useCallback((groupId: string) => {
    updateGroup(groupId, { status: 'paused' });
  }, [updateGroup]);

  const resumePipeline = useCallback((groupId: string) => {
    const group = groupsRef.current.find(g => g.id === groupId);
    if (!group || group.status !== 'paused') return;

    updateGroup(groupId, { status: 'running' });

    const runState = getRunState(groupId);
    if (runState.deferredCompletion) {
      const deferredId = runState.deferredCompletion;
      setRunState(groupId, { deferredCompletion: null });
      setTimeout(() => advancePipeline(groupId, deferredId), 100);
    }
  }, [updateGroup, advancePipeline]);

  const stopPipeline = useCallback((groupId: string) => {
    clearRunState(groupId);
    updateGroup(groupId, {
      status: 'idle',
      currentRound: 0,
    });
  }, [updateGroup]);

  // --- Queries ---

  const getSessionRole = useCallback((sessionId: string): { role: HarnessRole; groupId: string } | null => {
    for (const group of groupsRef.current) {
      for (const conn of group.connections) {
        if (conn.fromSessionId === sessionId) return { role: conn.fromRole, groupId: group.id };
        if (conn.toSessionId === sessionId) return { role: conn.toRole, groupId: group.id };
      }
    }
    return null;
  }, []);

  const getAllConnections = useCallback((): HarnessConnection[] => {
    return groupsRef.current.flatMap(g => g.connections);
  }, []);

  return {
    groups,
    createGroup,
    deleteGroup,
    addConnection,
    removeConnection,
    startPipeline,
    pausePipeline,
    resumePipeline,
    stopPipeline,
    getSessionRole,
    getAllConnections,
  };
}
