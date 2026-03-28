import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { X, Clock, Plus, MessageSquare, Send, Copy, ThumbsUp, ThumbsDown, ArrowUp, Square, Minus, Check, Pencil, RotateCcw, GitBranch, GitFork, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { Session, Message, ContentBlock, SkillInfo } from '../types';
import type { SessionWindowHandle } from '../types';
import { MessageRenderer } from './message/MessageRenderer';
import { STRUCTURED_MOCK_RESPONSES } from '../utils/mockResponses';
import { backend } from '../services/backend';
import { gitService } from '../services/git';
import { getStatusDotClass } from '../utils/statusColors';
import { SkillPicker } from './SkillPicker';
import { SessionFilesSummary } from './message/SessionFilesSummary';
import { scanSkills } from '../services/skillScanner';
import { useGit } from '../contexts/GitProvider';
import { getAgentType, getModelDisplayName, getModelFullLabel, getSiblingVariants } from '../models';

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.aiBackend !== undefined;
}
let mockResponseIndex = 0;

type SessionWindowProps = {
  session: Session,
  onUpdate: (s: Session) => void,
  onClose?: () => void,
  onDelete?: () => void,
  fullScreen?: boolean,
  height?: number,
  animateHeight?: boolean,
  onHeaderDoubleClick?: (e: React.MouseEvent) => void,
  variant?: 'default' | 'tab' | 'popup',
  projectDir?: string | null,
  onToggleGitPanel?: () => void,
  onCopySession?: (title: string) => void,
  onOpenFileInPanel?: (path: string) => void,
  onOpenDiffInPanel?: (path: string) => void
};

export const SessionWindow = forwardRef<SessionWindowHandle, SessionWindowProps>(function SessionWindow({
  session,
  onUpdate,
  onClose,
  onDelete,
  fullScreen = false,
  height,
  animateHeight = false,
  onHeaderDoubleClick,
  variant = 'default',
  projectDir,
  onToggleGitPanel,
  onCopySession,
  onOpenFileInPanel,
  onOpenDiffInPanel
}, ref) {
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<SkillInfo[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  const emitIsland = useCallback((method: 'emitSessionUpdate' | 'emitMessageStream' | 'emitNotification', data: any) => {
    if (isElectron() && window.aiBackend[method]) {
      window.aiBackend[method](data)
    }
  }, [])

  const { info, changes, isRepo } = useGit();
  const [worktreeAdditions, setWorktreeAdditions] = useState(0);
  const [worktreeDeletions, setWorktreeDeletions] = useState(0);
  const hasWorktree = session.worktree && session.worktree !== 'default';

  useEffect(() => {
    if (!hasWorktree) return;
    let cancelled = false;
    gitService.changes(session.worktree!).then(wtChanges => {
      if (cancelled) return;
      setWorktreeAdditions(wtChanges.reduce((sum, c) => sum + c.additions, 0));
      setWorktreeDeletions(wtChanges.reduce((sum, c) => sum + c.deletions, 0));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [hasWorktree, session.worktree, session.hasChanges]);

  const globalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
  const globalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);
  const totalAdditions = hasWorktree ? worktreeAdditions : globalAdditions;
  const totalDeletions = hasWorktree ? worktreeDeletions : globalDeletions;

  const isStreamingRef = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const backendSessionIdRef = useRef<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const inputValueRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMsgLenRef = useRef(session.messages.length);
  const baselineChangesRef = useRef<Map<string, { status: string; additions: number; deletions: number }>>(new Map());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Snapshot current git changes as baseline before sending a message
  const captureGitBaseline = async () => {
    const wt = sessionRef.current.worktree;
    const workingDir = (wt && wt !== 'default') ? wt : (projectDir ?? null);
    if (!workingDir || !isElectron()) {
      baselineChangesRef.current = new Map();
      return;
    }
    try {
      const changes = await gitService.changes(workingDir);
      const map = new Map<string, { status: string; additions: number; deletions: number }>();
      for (const c of changes) {
        map.set(c.path, { status: c.status, additions: c.additions, deletions: c.deletions });
      }
      baselineChangesRef.current = map;
    } catch {
      baselineChangesRef.current = new Map();
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.messages, isStreaming]);

  // Close history popover on any click outside (using capture phase to bypass stopPropagation)
  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showHistory]);

  useEffect(() => {
    if (!showModelPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showModelPicker]);

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
  };

  // Deduplicate messages to prevent React duplicate key warnings from legacy data
  const dedupedMessages = useMemo(() => {
    const seen = new Set<string>();
    return session.messages.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [session.messages]);

  const recentUserMessages = dedupedMessages
    .filter(m => m.role === 'user')
    .slice(-5)
    .reverse();

  // Backend event listeners for Electron mode
  useEffect(() => {
    if (!isElectron()) return;

    const blockMap = new Map<number, ContentBlock>();

    const handleBlockStart = (data: { session_id: string; block_index: number; block: ContentBlock }) => {
      if (data.session_id !== backendSessionIdRef.current) return;
      blockMap.set(data.block_index, { ...data.block });
      updateAssistantBlocks(blockMap);
    };

    const handleBlockDelta = (data: { session_id: string; block_index: number; delta: any }) => {
      if (data.session_id !== backendSessionIdRef.current) return;
      const block = blockMap.get(data.block_index);
      if (!block) return;

      if (block.type === 'text' && data.delta.content) {
        (block as any).content += data.delta.content;
        emitIsland('emitMessageStream', {
          sessionId: session.id,
          messageId: streamingMessageIdRef.current || '',
          chunk: data.delta.content,
          done: false
        })
      } else if (block.type === 'code' && data.delta.content) {
        (block as any).code += data.delta.content;
      } else if (block.type === 'tool_call' && data.delta.args) {
        (block as any).args += data.delta.args;
      } else if (block.type === 'todolist' && data.delta.items) {
        (block as any).items = data.delta.items;
      }
      blockMap.set(data.block_index, { ...block });
      updateAssistantBlocks(blockMap);
    };

    const handleBlockStop = (data: { session_id: string; block_index: number; status?: 'done' | 'error' }) => {
      if (data.session_id !== backendSessionIdRef.current) return;
      const block = blockMap.get(data.block_index);
      if (!block) return;

      const resolvedStatus = data.status || 'done';

      if (block.type === 'tool_call') {
        (block as any).status = resolvedStatus;
      } else if (block.type === 'subagent') {
        (block as any).status = resolvedStatus;
      } else if (block.type === 'skill') {
        (block as any).status = resolvedStatus === 'error' ? 'error' : 'done';
      } else if (block.type === 'todolist') {
        (block as any).status = resolvedStatus;
      }

      blockMap.set(data.block_index, { ...block });
      updateAssistantBlocks(blockMap);
    };

    const handleMessageComplete = async (data: { session_id: string }) => {
      if (data.session_id !== backendSessionIdRef.current) return;

      // Extract text content from blocks BEFORE clearing
      const completedMsgId = streamingMessageIdRef.current
      const textContent = Array.from(blockMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([_, block]) => block)
        .filter(b => b.type === 'text' && !(b as any).content.startsWith('Connected:'))
        .map(b => (b as any).content)
        .join('')

      setIsStreaming(false);
      setStreamingMessageId(null);
      streamingMessageIdRef.current = null;
      isStreamingRef.current = false;
      blockMap.clear();

      // Detect git changes made DURING this message (delta from baseline)
      const wt = sessionRef.current.worktree;
      const workingDir = (wt && wt !== 'default') ? wt : (projectDir ?? null);
      let hasChanges = false;
      let changeCount = 0;
      let fileChangesBlock: ContentBlock | null = null;
      if (workingDir) {
        try {
          const allChanges = await gitService.changes(workingDir);
          const baseline = baselineChangesRef.current;
          // Only include files that are new or different compared to baseline
          const deltaChanges = allChanges.filter(c => {
            const prev = baseline.get(c.path);
            if (!prev) return true; // new file not in baseline
            return prev.status !== c.status || prev.additions !== c.additions || prev.deletions !== c.deletions;
          });
          hasChanges = deltaChanges.length > 0;
          changeCount = deltaChanges.length;
          if (deltaChanges.length > 0) {
            const statusMap: Record<string, 'new' | 'modified' | 'deleted' | 'renamed'> = {
              A: 'new', '?': 'new', M: 'modified', D: 'deleted', R: 'renamed',
            };
            fileChangesBlock = {
              type: 'file_changes',
              title: '文件变更',
              files: deltaChanges.map(c => ({
                path: c.path,
                status: statusMap[c.status] ?? 'modified',
                additions: c.additions,
                deletions: c.deletions,
              })),
            };
          }
        } catch {
          // Ignore git errors
        }
      }

      const updated = {
        ...sessionRef.current,
        status: 'review' as const,
        hasChanges,
        changeCount,
        messages: sessionRef.current.messages.map(m => {
          if (m.id !== completedMsgId) return m;
          const updatedMsg = { ...m, content: textContent || m.content };
          if (fileChangesBlock) {
            updatedMsg.blocks = [...(m.blocks || []), fileChangesBlock];
          }
          return updatedMsg;
        }),
      };
      sessionRef.current = updated;
      onUpdate(updated);

      // Notify Island — send full text as the final chunk so Island has
      // authoritative content even if some streaming deltas were missed.
      emitIsland('emitSessionUpdate', {
        sessionId: session.id,
        status: 'review',
        lastMessage: textContent.slice(0, 50)
      })
      emitIsland('emitMessageStream', {
        sessionId: session.id,
        messageId: completedMsgId || '',
        chunk: textContent,
        done: true
      })
      emitIsland('emitNotification', {
        sessionId: session.id,
        level: 'success',
        text: `${sessionRef.current.title} — 回复完成`
      })
    };

    const handleMessageError = (data: { session_id: string; error: { code: number; message: string } }) => {
      if (data.session_id !== backendSessionIdRef.current) return;
      const errorMsgId = streamingMessageIdRef.current;
      setIsStreaming(false);
      setStreamingMessageId(null);
      streamingMessageIdRef.current = null;
      isStreamingRef.current = false;
      blockMap.clear();
      console.error('[backend error]', data.error);
      // Notify Island so it exits streaming state and shows error
      emitIsland('emitSessionUpdate', {
        sessionId: session.id,
        status: 'review',
      })
      emitIsland('emitMessageStream', {
        sessionId: session.id,
        messageId: errorMsgId || '',
        chunk: `Error: ${data.error.message}`,
        done: true
      })
      emitIsland('emitNotification', {
        sessionId: session.id,
        level: 'error',
        text: `${sessionRef.current.title} — 请求失败`
      })
    };

    const updateAssistantBlocks = (blocks: Map<number, ContentBlock>) => {
      const sortedBlocks = Array.from(blocks.entries())
        .sort(([a], [b]) => a - b)
        .map(([_, block]) => block);

      const updated = {
        ...sessionRef.current,
        messages: sessionRef.current.messages.map(m =>
          m.id === streamingMessageIdRef.current
            ? { ...m, blocks: sortedBlocks }
            : m
        ),
      };
      sessionRef.current = updated;
      onUpdate(updated);
    };

    backend.onBlockStart(handleBlockStart);
    backend.onBlockDelta(handleBlockDelta);
    backend.onBlockStop(handleBlockStop);
    backend.onMessageComplete(handleMessageComplete);
    backend.onMessageError(handleMessageError);

    const handleSessionInit = (data: { session_id: string; claude_session_id?: string; codex_thread_id?: string; agent?: string }) => {
      if (data.session_id === backendSessionIdRef.current) {
        const updated = data.agent === 'codex'
          ? { ...sessionRef.current, codexThreadId: data.codex_thread_id, sidecarSessionId: data.session_id }
          : { ...sessionRef.current, claudeSessionId: data.claude_session_id, sidecarSessionId: data.session_id };
        sessionRef.current = updated;
        onUpdate(updated);
      }
    };
    backend.onSessionInit(handleSessionInit);

    const handleSidecarRestarted = () => {
      backendSessionIdRef.current = null;
      setBackendSessionId(null);
    };
    backend.onSidecarRestarted(handleSidecarRestarted);

    return () => {
      if (isElectron()) {
        window.aiBackend.off('block.start', handleBlockStart);
        window.aiBackend.off('block.delta', handleBlockDelta);
        window.aiBackend.off('block.stop', handleBlockStop);
        window.aiBackend.off('message.complete', handleMessageComplete);
        window.aiBackend.off('message.error', handleMessageError);
        window.aiBackend.off('session.init', handleSessionInit);
        window.aiBackend.off('sidecar.restarted', handleSidecarRestarted);
      }
    };
  }, []);

  useEffect(() => {
    // Auto-trigger AI response if the session was just created with an initial prompt
    if (session.messages.length === 1 && session.messages[0].role === 'user' && !isStreamingRef.current) {
      const triggerInitialResponse = async () => {
        await captureGitBaseline();
        const aiMsgId = crypto.randomUUID();
        const initialText = session.messages[0].content;

        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          type: 'text',
          blocks: []
        };

        const updatedMessages = [...session.messages, aiMsg];
        const updatedSession = {
          ...session,
          status: 'inprocess' as const,
          messages: updatedMessages
        };

        sessionRef.current = updatedSession;
        onUpdate(updatedSession);
        emitIsland('emitSessionUpdate', {
          sessionId: session.id,
          status: 'inprocess'
        })

        setIsStreaming(true);
        setStreamingMessageId(aiMsgId);
        streamingMessageIdRef.current = aiMsgId;
        isStreamingRef.current = true;

        if (isElectron()) {
          if (!backendSessionIdRef.current) {
            const sid = await backend.createSession(session.model,
              getAgentType(sessionRef.current.model) === 'codex'
                ? { codexThreadId: sessionRef.current.codexThreadId }
                : { claudeSessionId: sessionRef.current.claudeSessionId }
            );
            backendSessionIdRef.current = sid;
            setBackendSessionId(sid);
          }
          try {
            await backend.sendMessage(backendSessionIdRef.current, initialText);
          } catch (e) {
            setIsStreaming(false);
            setStreamingMessageId(null);
            streamingMessageIdRef.current = null;
            isStreamingRef.current = false;
            console.error('[initial send error]', e);
          }
        } else {
          const mockResponse = STRUCTURED_MOCK_RESPONSES[mockResponseIndex++ % STRUCTURED_MOCK_RESPONSES.length];
          await streamBlockResponse(aiMsgId, mockResponse.blocks);

          setIsStreaming(false);
          setStreamingMessageId(null);
          streamingMessageIdRef.current = null;
          isStreamingRef.current = false;
          onUpdate({
            ...sessionRef.current,
            status: 'review',
          });
        }
      };

      triggerInitialResponse();
    }
  }, []); // Run on mount

  // Auto-trigger AI response for externally added user messages (e.g., broadcast)
  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    const curLen = session.messages.length;
    prevMsgLenRef.current = curLen;

    if (curLen > prevLen && !isStreamingRef.current) {
      const lastMsg = session.messages[curLen - 1];
      if (lastMsg.role === 'user') {
        const triggerBroadcastResponse = async () => {
          await captureGitBaseline();
          const aiMsgId = crypto.randomUUID();
          const aiMsg: Message = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            type: 'text',
            blocks: []
          };

          const updatedMessages = [...sessionRef.current.messages, aiMsg];
          const updatedSession = {
            ...sessionRef.current,
            status: 'inprocess' as const,
            messages: updatedMessages
          };

          sessionRef.current = updatedSession;
          onUpdate(updatedSession);
          emitIsland('emitSessionUpdate', {
            sessionId: session.id,
            status: 'inprocess'
          })

          setIsStreaming(true);
          setStreamingMessageId(aiMsgId);
          streamingMessageIdRef.current = aiMsgId;
          isStreamingRef.current = true;

          if (isElectron()) {
            if (!backendSessionIdRef.current) {
              const sid = await backend.createSession(session.model,
              getAgentType(sessionRef.current.model) === 'codex'
                ? { codexThreadId: sessionRef.current.codexThreadId }
                : { claudeSessionId: sessionRef.current.claudeSessionId }
            );
              backendSessionIdRef.current = sid;
              setBackendSessionId(sid);
            }
            try {
              await backend.sendMessage(backendSessionIdRef.current!, lastMsg.content);
            } catch (e) {
              console.warn('[broadcast send error, attempting resume]', e);
              backendSessionIdRef.current = null;
              setBackendSessionId(null);
              try {
                const sid = await backend.createSession(session.model,
              getAgentType(sessionRef.current.model) === 'codex'
                ? { codexThreadId: sessionRef.current.codexThreadId }
                : { claudeSessionId: sessionRef.current.claudeSessionId }
            );
                backendSessionIdRef.current = sid;
                setBackendSessionId(sid);
                await backend.sendMessage(sid, lastMsg.content);
              } catch (retryError) {
                setIsStreaming(false);
                setStreamingMessageId(null);
                streamingMessageIdRef.current = null;
                isStreamingRef.current = false;
                console.error('[broadcast send retry failed]', retryError);
                const errorMsg = retryError instanceof Error ? retryError.message : 'Unknown error';
                const updated = {
                  ...sessionRef.current,
                  status: 'review' as const,
                  messages: sessionRef.current.messages.map(m =>
                    m.id === aiMsgId ? { ...m, blocks: [{ type: 'text' as const, content: `Connection failed: ${errorMsg}. Please try again.` }] } : m
                  ),
                };
                sessionRef.current = updated;
                onUpdate(updated);
              }
            }
          } else {
            const mockResponse = STRUCTURED_MOCK_RESPONSES[mockResponseIndex++ % STRUCTURED_MOCK_RESPONSES.length];
            await streamBlockResponse(aiMsgId, mockResponse.blocks);

            setIsStreaming(false);
            setStreamingMessageId(null);
            streamingMessageIdRef.current = null;
            isStreamingRef.current = false;
            onUpdate({
              ...sessionRef.current,
              status: 'review',
            });
          }
        };

        triggerBroadcastResponse();
      }
    }
  }, [session.messages.length]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    await captureGitBaseline();

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      type: 'text',
      timestamp: Date.now()
    };

    const aiMsgId = crypto.randomUUID();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      type: 'text',
      blocks: []
    };

    const updatedMessages = [...sessionRef.current.messages, userMsg, aiMsg];
    const updatedSession = {
      ...sessionRef.current,
      status: 'inprocess' as const,
      messages: updatedMessages
    };

    sessionRef.current = updatedSession;
    onUpdate(updatedSession);
    emitIsland('emitSessionUpdate', {
      sessionId: session.id,
      status: 'inprocess'
    })

    setIsStreaming(true);
    setStreamingMessageId(aiMsgId);
    streamingMessageIdRef.current = aiMsgId;
    isStreamingRef.current = true;

    if (isElectron()) {
      // Create backend session if not already created
      if (!backendSessionIdRef.current) {
        const sid = await backend.createSession(session.model,
              getAgentType(sessionRef.current.model) === 'codex'
                ? { codexThreadId: sessionRef.current.codexThreadId }
                : { claudeSessionId: sessionRef.current.claudeSessionId }
            );
        backendSessionIdRef.current = sid;
        setBackendSessionId(sid);
      }
      // Send to backend — events will update UI via the useEffect listeners
      try {
        await backend.sendMessage(backendSessionIdRef.current, text);
      } catch (e) {
        console.warn('[send error, attempting resume]', e);
        backendSessionIdRef.current = null;
        setBackendSessionId(null);
        try {
          const sid = await backend.createSession(session.model,
              getAgentType(sessionRef.current.model) === 'codex'
                ? { codexThreadId: sessionRef.current.codexThreadId }
                : { claudeSessionId: sessionRef.current.claudeSessionId }
            );
          backendSessionIdRef.current = sid;
          setBackendSessionId(sid);
          await backend.sendMessage(sid, text);
        } catch (retryError) {
          setIsStreaming(false);
          setStreamingMessageId(null);
          streamingMessageIdRef.current = null;
          isStreamingRef.current = false;
          console.error('[send retry failed]', retryError);
          // Show error to user via an error block in the assistant message
          const errorMsg = retryError instanceof Error ? retryError.message : 'Unknown error';
          const updated = {
            ...sessionRef.current,
            status: 'review' as const,
            messages: sessionRef.current.messages.map(m =>
              m.id === aiMsgId ? { ...m, blocks: [{ type: 'text' as const, content: `Connection failed: ${errorMsg}. Please try again.` }] } : m
            ),
          };
          sessionRef.current = updated;
          onUpdate(updated);
          // Notify Island so it exits streaming state
          emitIsland('emitSessionUpdate', { sessionId: session.id, status: 'review' })
          emitIsland('emitMessageStream', {
            sessionId: session.id,
            messageId: aiMsgId,
            chunk: `Connection failed: ${errorMsg}`,
            done: true
          })
        }
      }
    } else {
      // Mock fallback for browser dev
      const mockResponse = STRUCTURED_MOCK_RESPONSES[mockResponseIndex++ % STRUCTURED_MOCK_RESPONSES.length];
      await streamBlockResponse(aiMsgId, mockResponse.blocks);

      setIsStreaming(false);
      setStreamingMessageId(null);
      streamingMessageIdRef.current = null;
      isStreamingRef.current = false;
      onUpdate({
        ...sessionRef.current,
        status: 'review',
      });
    }
  };

  // Ref to latest sendMessage for stable imperative handle
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  useImperativeHandle(ref, () => ({
    async injectMessage(content: string) {
      console.log('[harness] injectMessage called for session:', session.id, 'content length:', content.length);
      await sendMessageRef.current(content);
    }
  }), [session.id]);

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;
    const text = inputValue;
    setInputValue('');
    inputValueRef.current = '';
    setSelectedSkill(null);
    setSkills([]);
    setPickerOpen(false);
    await sendMessage(text);
  };

  const streamBlockResponse = async (aiMsgId: string, blocks: ContentBlock[]) => {
    const builtBlocks: ContentBlock[] = [];
    let pendingFlush = false;

    const flushUpdate = () => {
      pendingFlush = false;
      const newBlocks = [...builtBlocks];
      const updated = {
        ...sessionRef.current,
        messages: sessionRef.current.messages.map(m =>
          m.id === aiMsgId ? { ...m, content: (newBlocks.find(b => b.type === 'text') as any)?.content || m.content, blocks: newBlocks } : m
        )
      };
      sessionRef.current = updated;
      onUpdate(updated);
    };

    const scheduleFlush = () => {
      if (!pendingFlush) {
        pendingFlush = true;
        requestAnimationFrame(flushUpdate);
      }
    };

    for (const block of blocks) {
      if (!isStreamingRef.current) break;

      if (block.type === 'text') {
        let currentText = '';
        const blockIndex = builtBlocks.length;
        builtBlocks.push({ type: 'text', content: '' });

        for (const char of block.content) {
          if (!isStreamingRef.current) break;
          currentText += char;
          builtBlocks[blockIndex] = { type: 'text', content: currentText };
          scheduleFlush();
          await new Promise(r => setTimeout(r, 15));
        }
        // Final flush to ensure last chars are rendered
        flushUpdate();
      } else {
        builtBlocks.push(block);
        flushUpdate();
        await new Promise(r => setTimeout(r, 300));
      }
    }
  };

  const handleStop = async () => {
    isStreamingRef.current = false;
    setIsStreaming(false);
    setStreamingMessageId(null);
    streamingMessageIdRef.current = null;

    // Electron 模式：interrupt 当前 backend session 以中断流
    if (isElectron() && backendSessionIdRef.current) {
      try {
        await backend.interruptSession(backendSessionIdRef.current);
      } catch (e) {
        console.error('[interrupt session error]', e);
      }
      // Do NOT clear backendSessionIdRef — process stays alive
    }

    // 更新状态为 review（已有部分回复）
    const updated = {
      ...sessionRef.current,
      status: 'review' as const,
    };
    sessionRef.current = updated;
    onUpdate(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (pickerOpen && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPickerIndex(i => (i + 1) % filteredSkills.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPickerIndex(i => (i - 1 + filteredSkills.length) % filteredSkills.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSkillSelect(filteredSkills[pickerIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPickerOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    inputValueRef.current = val;

    if (val.startsWith('/') && val.length >= 1) {
      let currentSkills = skills;
      if (currentSkills.length === 0) {
        currentSkills = await scanSkills(session.model, projectDir);
        if (!inputValueRef.current.startsWith('/')) return;
        setSkills(currentSkills);
      }

      const query = val.slice(1).split(' ')[0].toLowerCase();
      const hasSelectedAndComplete = selectedSkill && val.startsWith(`/${selectedSkill} `);

      if (!hasSelectedAndComplete) {
        const filtered = query
          ? currentSkills.filter(s => s.name.toLowerCase().includes(query))
          : currentSkills;
        setFilteredSkills(filtered);
        setPickerOpen(filtered.length > 0);
        setPickerIndex(0);

        const exactMatch = currentSkills.find(s => s.name === query);
        setSelectedSkill(exactMatch ? exactMatch.name : null);
      } else {
        setPickerOpen(false);
      }
    } else {
      setPickerOpen(false);
      if (!val.startsWith('/')) {
        setSelectedSkill(null);
        setSkills([]);
      }
    }
  };

  const handleSkillSelect = (skill: SkillInfo) => {
    const newValue = `/${skill.name} `;
    setInputValue(newValue);
    inputValueRef.current = newValue;
    setSelectedSkill(skill.name);
    setPickerOpen(false);
    setFilteredSkills([]);
    textareaRef.current?.focus();
  };

  const handleTitleSave = () => {
    const newTitle = editTitle.trim();
    if (newTitle && newTitle !== session.title) {
      onUpdate({ ...session, title: newTitle });
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
  };

  const handleSwitchModel = async (newModelId: string) => {
    if (newModelId === session.model) return;
    setShowModelPicker(false);

    if (backendSessionIdRef.current) {
      try {
        await backend.switchModel(backendSessionIdRef.current, newModelId);
      } catch (e) {
        console.warn('[model switch error]', e);
      }
    }

    const systemMsg: Message = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `模型已切换为 ${getModelDisplayName(newModelId)}`,
      timestamp: Date.now(),
    };

    const updated = {
      ...sessionRef.current,
      model: newModelId,
      messages: [...sessionRef.current.messages, systemMsg],
    };
    sessionRef.current = updated;
    onUpdate(updated);
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(session.title);
    setIsEditingTitle(true);
  };

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // ESC 键中断 streaming 或关闭 history popover
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistory) {
          setShowHistory(false);
          return;
        }
        if (isStreamingRef.current) {
          handleStop();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showHistory]);

  // Listen for messages sent from Island ChatPanel
  useEffect(() => {
    const handleIslandMessage = (e: Event) => {
      const { sessionId, content } = (e as CustomEvent).detail
      if (sessionId === session.id && content && !isStreamingRef.current) {
        sendMessage(content)
      }
    }
    window.addEventListener('island:send-message', handleIslandMessage)
    return () => window.removeEventListener('island:send-message', handleIslandMessage)
  }, [session.id])

  const isTab = variant === 'tab';
  const isPopup = variant === 'popup';

  return (
    <div className={`flex flex-col overflow-hidden text-sm text-gray-200 ${
      isPopup
        ? 'w-full h-full'
        : isTab
        ? 'w-full h-full bg-surface/80 backdrop-blur-3xl'
        : fullScreen
          ? 'w-full h-full bg-transparent'
          : 'bg-surface/80 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-2xl'
    }`}
    style={!fullScreen && !isTab && !isPopup ? {
      width: session.width ?? 600,
      ...(height ? { height } : {}),
      transition: animateHeight ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
    } : undefined}
    >
      {/* Header */}
      {isTab || isPopup ? (
        <div className={`flex items-center justify-between p-4 px-6 select-none shrink-0${isPopup ? ' [-webkit-app-region:drag] bg-[#1E1814]/90' : ''}`}>
          <div className="flex items-center gap-3 [-webkit-app-region:no-drag]">
            <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotClass(session.status, isStreaming)}`} />
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleTitleSave();
                  else if (e.key === 'Escape') handleTitleCancel();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                maxLength={100}
                className="bg-transparent border-b border-white/30 outline-none font-medium text-white text-sm max-w-[200px]"
              />
            ) : (
              <div className="group/title flex items-center gap-1.5">
                <span
                  onDoubleClick={handleTitleDoubleClick}
                  className="font-medium text-white text-sm truncate max-w-[200px] cursor-default"
                >
                  {session.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTitleDoubleClick(e); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover/title:opacity-100 text-gray-400 hover:text-white transition-opacity [-webkit-app-region:no-drag]"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            {(session.gitBranch || info.branch) && (
              <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-0.5 shrink-0">
                <GitBranch size={12} className="text-orange-400" />
                <span className="text-[11px] font-mono text-orange-300 truncate max-w-[120px]">{session.gitBranch || info.branch}</span>
              </div>
            )}
            {session.worktree && session.worktree !== 'default' && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 shrink-0">
                <GitFork size={12} className="text-amber-400" />
                <span className="text-[11px] font-mono text-amber-300">worktree</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-400 [-webkit-app-region:no-drag]">
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`hover:text-gray-200 transition-colors ${showHistory ? 'text-gray-200' : ''}`}
                title="最近消息"
                aria-label="Recent messages"
                aria-expanded={showHistory}
              >
                <Clock size={18} />
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-white/5 text-xs font-medium text-gray-500">最近发送的消息</div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {recentUserMessages.length > 0 ? recentUserMessages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          const ta = textareaRef.current;
                          const pos = ta?.selectionStart ?? inputValue.length;
                          const newVal = inputValue.slice(0, pos) + msg.content + inputValue.slice(pos);
                          setInputValue(newVal);
                          setShowHistory(false);
                          requestAnimationFrame(() => {
                            if (ta) {
                              ta.focus();
                              const cursor = pos + msg.content.length;
                              ta.setSelectionRange(cursor, cursor);
                            }
                          });
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 group"
                      >
                        <div className="text-sm text-gray-300 group-hover:text-white line-clamp-2">{msg.content}</div>
                        {msg.timestamp && <div className="text-[11px] text-gray-500 mt-1">{formatRelativeTime(msg.timestamp)}</div>}
                      </button>
                    )) : (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">暂无消息</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              className="hover:text-gray-200 transition-colors"
              title="复制 session"
              aria-label="Copy session"
              onClick={() => onCopySession?.(session.title)}
            >
              <Copy size={20} />
            </button>
            {isPopup && (
              <button
                onClick={onClose}
                className="hover:text-gray-200 transition-colors"
                title="关闭"
              >
                <X size={18} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { if (window.confirm('确定要删除这个 session 吗？')) onDelete(); }}
                className="hover:text-red-400 transition-colors"
                title="删除 session"
                aria-label="Delete session"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`session-header flex items-center justify-between p-4 px-6 select-none shrink-0 ${fullScreen ? 'border-b border-white/5 bg-black/20' : 'cursor-move bg-surface/90'}`} onDoubleClick={onHeaderDoubleClick}>
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={isStreaming ? handleStop : onClose}
                aria-label={isStreaming ? 'Stop generation' : 'Close session'}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isStreaming
                    ? 'bg-red-500/20 hover:bg-red-500/40 text-red-400'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <X size={16} className={isStreaming ? 'text-red-400' : 'text-gray-400'} />
              </button>
            )}
            <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotClass(session.status, isStreaming)}`} />
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    handleTitleSave();
                  } else if (e.key === 'Escape') {
                    handleTitleCancel();
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                maxLength={100}
                className={`bg-transparent border-b border-white/30 outline-none font-medium text-white ${
                  fullScreen ? 'text-lg' : 'text-sm max-w-[200px]'
                }`}
              />
            ) : (
              <div className="group/title flex items-center gap-1.5">
                <span
                  onDoubleClick={handleTitleDoubleClick}
                  className={`font-medium text-white truncate cursor-default ${
                    fullScreen ? 'text-lg' : 'text-sm max-w-[200px]'
                  }`}
                >
                  {session.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTitleDoubleClick(e); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label="Edit title"
                  className="opacity-0 group-hover/title:opacity-100 text-gray-400 hover:text-white transition-opacity"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            {(session.gitBranch || info.branch) && (
              <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-0.5 shrink-0">
                <GitBranch size={12} className="text-orange-400" />
                <span className="text-[11px] font-mono text-orange-300 truncate max-w-[120px]">{session.gitBranch || info.branch}</span>
              </div>
            )}
            {session.worktree && session.worktree !== 'default' && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 shrink-0">
                <GitFork size={12} className="text-amber-400" />
                <span className="text-[11px] font-mono text-amber-300">worktree</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <div className="relative" ref={!isTab ? historyRef : undefined}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
                onMouseDown={(e) => e.stopPropagation()}
                className={`hover:text-gray-200 transition-colors ${showHistory ? 'text-gray-200' : ''}`}
                title="最近消息"
                aria-label="Recent messages"
                aria-expanded={showHistory}
              >
                <Clock size={18} />
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-white/5 text-xs font-medium text-gray-500">最近发送的消息</div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {recentUserMessages.length > 0 ? recentUserMessages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const ta = textareaRef.current;
                          const pos = ta?.selectionStart ?? inputValue.length;
                          const newVal = inputValue.slice(0, pos) + msg.content + inputValue.slice(pos);
                          setInputValue(newVal);
                          setShowHistory(false);
                          requestAnimationFrame(() => {
                            if (ta) {
                              ta.focus();
                              const cursor = pos + msg.content.length;
                              ta.setSelectionRange(cursor, cursor);
                            }
                          });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 group"
                      >
                        <div className="text-sm text-gray-300 group-hover:text-white line-clamp-2">{msg.content}</div>
                        {msg.timestamp && <div className="text-[11px] text-gray-500 mt-1">{formatRelativeTime(msg.timestamp)}</div>}
                      </button>
                    )) : (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">暂无消息</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              className="hover:text-gray-200 transition-colors"
              title="复制 session"
              aria-label="Copy session"
              onClick={(e) => { e.stopPropagation(); onCopySession?.(session.title); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Copy size={20} />
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('确定要删除这个 session 吗？')) onDelete();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="hover:text-red-400 transition-colors"
                title="删除 session"
                aria-label="Delete session"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={scrollContainerRef}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${
          isTab || isPopup ? 'pt-2 px-6 pb-6'
          : fullScreen ? 'p-8'
          : `p-6 pt-2${height ? '' : ' max-h-[600px]'}`
        }`}
      >
        <div className={`space-y-6 ${fullScreen ? 'max-w-4xl mx-auto w-full' : ''}`}>
          {session.id === '1' ? (
            <ComplexMockContent />
          ) : (
            <div className="space-y-6">
              {dedupedMessages.map(msg => {
                const isMsgStreaming = isStreaming && streamingMessageId === msg.id;
                return (
                  <div key={msg.id} className={`group/msg flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      onDoubleClick={(e) => {
                        const target = e.currentTarget;
                        requestAnimationFrame(() => {
                          const sel = window.getSelection();
                          if (sel) {
                            const range = document.createRange();
                            range.selectNodeContents(target);
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }
                        });
                      }}
                      className={`msg-content ${
                        msg.role === 'user'
                          ? 'group/user relative max-w-[85%] bg-white/10 text-gray-200 rounded-3xl px-5 py-3.5'
                          : `text-gray-300 w-full${isTab ? ' pl-1' : ''}`
                      } cursor-text select-text`}>
                      {msg.role === 'user' ? (
                        <>
                          <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                            {msg.content}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(msg.content);
                              setCopiedMsgId(msg.id);
                              setTimeout(() => setCopiedMsgId(prev => prev === msg.id ? null : prev), 2000);
                            }}
                            aria-label="Copy message"
                            className={`absolute -left-9 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all cursor-pointer ${
                              copiedMsgId === msg.id
                                ? 'text-emerald-400 opacity-100'
                                : 'text-gray-500 hover:text-gray-200 hover:bg-white/10 opacity-0 group-hover/user:opacity-100'
                            }`}
                            title="复制"
                          >
                            {copiedMsgId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </>
                      ) : (
                        <>
                          <MessageRenderer
                            blocks={msg.blocks}
                            fallbackContent={msg.content}
                            isStreaming={isMsgStreaming}
                            onSendMessage={sendMessage}
                          />
                        </>
                      )}
                    </div>
                    {msg.role === 'assistant' && !isMsgStreaming && (msg.content || (msg.blocks && msg.blocks.length > 0)) && (
                      <MessageActions message={msg} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {isStreaming && (
            <div className="flex items-center gap-2 py-3 text-gray-400 text-sm">
              <Loader2 size={14} className="animate-spin" />
              <span>Running...</span>
            </div>
          )}
          <SessionFilesSummary
            messages={session.messages}
            onNavigateToFile={(path) => onOpenFileInPanel?.(path)}
            onNavigateToDiff={(path) => onOpenDiffInPanel?.(path)}
          />
        </div>
      </div>

      {/* Bottom Input */}
      {!(height && height <= 110) && <div className={`shrink-0 ${
        isTab || isPopup ? 'p-4 pb-6 w-full max-w-4xl mx-auto'
        : `p-4 pb-6 ${fullScreen ? 'w-full max-w-4xl mx-auto' : 'px-6'}`
      }`}>
        <div className="bg-white/[0.02] rounded-2xl p-2 flex flex-col gap-2 border border-white/[0.06] focus-within:border-white/10 transition-colors">
          <div className="relative">
            {pickerOpen && filteredSkills.length > 0 && (
              <SkillPicker
                skills={filteredSkills}
                query={inputValue.slice(1).split(' ')[0]}
                selectedIndex={pickerIndex}
                onSelect={handleSkillSelect}
              />
            )}
            {selectedSkill && inputValue.startsWith(`/${selectedSkill}`) && (
              <div
                className="absolute inset-0 px-4 py-3 pointer-events-none whitespace-pre-wrap text-sm leading-normal"
                aria-hidden
              >
                <span className="bg-amber-500/15 text-white rounded" style={{ boxDecorationBreak: 'clone', paddingBlock: '1px' }}>/{selectedSkill}</span>
                <span className="text-white">{inputValue.slice(selectedSkill.length + 1)}</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="随便问..."
              aria-label="Message input"
              rows={1}
              className={`bg-transparent border-none outline-none px-4 py-3 placeholder-gray-400 w-full resize-none min-h-[44px] max-h-[200px] relative z-10 text-sm ${
                selectedSkill && inputValue.startsWith(`/${selectedSkill}`)
                  ? 'text-transparent caret-white'
                  : 'text-white'
              }`}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
          </div>
          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-2">
              <button aria-label="Add attachment" className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/[0.06] text-gray-400 hover:text-white hover:bg-white/10">
                <Plus size={16} />
              </button>
              {/* Model variant switcher */}
              <div className="relative" ref={modelPickerRef}>
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  disabled={isStreaming}
                  className={`flex items-center gap-1.5 rounded-full font-medium transition-colors ${
                    isStreaming
                      ? 'opacity-40 cursor-not-allowed text-gray-500'
                      : isTab ? 'bg-white/[0.1] px-2 py-0.5 text-[11px] text-gray-300 hover:text-white hover:bg-white/20' : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white px-3 py-1 text-xs border border-white/5'
                  }`}
                  title={isStreaming ? '流式响应中无法切换模型' : '切换模型'}
                >
                  {getModelFullLabel(session.model)}
                  <ChevronDown size={12} className="text-gray-500" />
                </button>
                {showModelPicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-50 bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
                    <div className="px-3 py-2 border-b border-white/5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">切换模型</div>
                    {getSiblingVariants(session.model).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSwitchModel(v.id)}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                          v.id === session.model
                            ? 'text-white bg-white/10'
                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{v.name}</span>
                        {v.id === session.model && <Check size={12} className="text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isRepo && (totalAdditions > 0 || totalDeletions > 0) && (
                <button
                  onClick={onToggleGitPanel}
                  aria-label="View git changes"
                  className="flex items-center gap-0.5 bg-white/[0.06] border border-white/[0.06] rounded-full px-2.5 py-1 shrink-0 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-mono font-medium text-green-400/80">+{totalAdditions}</span>
                  <span className="text-white/15 mx-0.5">│</span>
                  <span className="text-[11px] font-mono font-medium text-red-400/80">−{totalDeletions}</span>
                </button>
              )}

              {/* Changes indicator */}
              {isRepo && session.status === 'review' && session.hasChanges && (
                <span className="flex items-center gap-1 bg-white/[0.06] px-2 py-1 rounded-lg text-[11px] font-mono border border-white/[0.06]">
                  <span className="text-amber-400">{session.changeCount ?? '~'} changes</span>
                </span>
              )}
            </div>
            {isStreaming ? (
              <button
                onClick={handleStop}
                aria-label="Stop generation"
                className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-red-400 transition-colors"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                aria-label="Send message"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:bg-white/[0.06] disabled:text-gray-500 bg-white text-black hover:bg-gray-200"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
});

/** Check if a message has any visible content (excluding system status blocks) */
function hasVisibleContent(msg: Message): boolean {
  if (msg.content) return true;
  if (!msg.blocks || msg.blocks.length === 0) return false;
  return msg.blocks.some(
    b => !(b.type === 'text' && b.content.startsWith('Connected:'))
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
    </div>
  );
}

function MessageActions({ message }: { message: Message }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedId, setLikedId] = useState<string | null>(null);
  const [dislikedId, setDislikedId] = useState<string | null>(null);

  const handleCopy = () => {
    // Extract text content from blocks or fallback to message content
    let text = message.content;
    if (message.blocks && message.blocks.length > 0) {
      text = message.blocks
        .map(b => {
          if (b.type === 'text') return b.content.startsWith('Connected:') ? '' : b.content;
          if (b.type === 'code') return b.code;
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }
    navigator.clipboard.writeText(text.trim());
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLike = () => {
    setLikedId(likedId === message.id ? null : message.id);
    setDislikedId(null);
  };

  const handleDislike = () => {
    setDislikedId(dislikedId === message.id ? null : message.id);
    setLikedId(null);
  };

  const isCopied = copiedId === message.id;
  const isLiked = likedId === message.id;
  const isDisliked = dislikedId === message.id;

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className={`p-1.5 rounded-md transition-colors ${isCopied ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
        title="Copy"
      >
        {isCopied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <button
        onClick={handleLike}
        className={`p-1.5 rounded-md transition-colors ${isLiked ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
        title="Good response"
      >
        <ThumbsUp size={15} />
      </button>
      <button
        onClick={handleDislike}
        className={`p-1.5 rounded-md transition-colors ${isDisliked ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
        title="Bad response"
      >
        <ThumbsDown size={15} />
      </button>
      <button
        className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
        title="Retry"
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}

function ComplexMockContent() {
  return (
    <div className="space-y-6 text-[15px] text-gray-300 leading-relaxed">
      {/* Previous AI Message Part */}
      <div className="space-y-4">
        <h3 className="text-white font-medium text-base">Project Setup Complete</h3>
        <p>I've initialized the project with the following structure:</p>
        <ul className="space-y-1.5 list-disc list-inside marker:text-gray-500">
          <li><span className="text-gray-400">Framework:</span> React 18 with TypeScript</li>
          <li><span className="text-gray-400">Styling:</span> Tailwind CSS v4 with custom theme</li>
          <li><span className="text-gray-400">Build tool:</span> Vite for blazing fast HMR</li>
        </ul>
        <div className="border-l-2 border-white/10 pl-4 py-1 text-gray-400 italic text-sm">
          Configuration follows best practices for production builds with tree-shaking and code splitting.
        </div>
        <p>Here's the main entry point:</p>

        <div className="bg-surface-panel rounded-xl overflow-hidden border border-white/5">
          <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-b border-white/5 text-xs text-gray-400">
            <span>TSX</span>
            <button className="flex items-center gap-1.5 hover:text-gray-200 transition-colors">
              <Copy size={12} />
              <span>Copy</span>
            </button>
          </div>
          <div className="p-4 font-mono text-sm text-gray-300 overflow-x-auto">
            <pre><code><span className="text-blue-400">import</span> <span className="text-blue-200">React</span> <span className="text-blue-400">from</span> <span className="text-green-300">'react'</span>;
<span className="text-blue-400">import</span> {'{'} <span className="text-blue-200">createRoot</span> {'}'} <span className="text-blue-400">from</span> <span className="text-green-300">'react-dom/client'</span>;
<span className="text-blue-400">import</span> <span className="text-blue-200">App</span> <span className="text-blue-400">from</span> <span className="text-green-300">'./App'</span>;
<span className="text-blue-400">import</span> <span className="text-green-300">'./styles/globals.css'</span>;

<span className="text-blue-400">const</span> <span className="text-blue-200">root</span> = <span className="text-yellow-200">createRoot</span>(document.<span className="text-yellow-200">getElementById</span>(<span className="text-green-300">'root'</span>)!);
root.<span className="text-yellow-200">render</span>(
  &lt;<span className="text-blue-300">React.StrictMode</span>&gt;
    &lt;<span className="text-blue-300">App</span> /&gt;
  &lt;/<span className="text-blue-300">React.StrictMode</span>&gt;
);</code></pre>
          </div>
        </div>
        <p>
          The <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm">tsconfig.json</code> has been configured with strict mode and path aliases for cleaner imports.
        </p>
        <div className="flex items-center gap-3 text-gray-500 pt-1">
          <button className="hover:text-gray-300 transition-colors"><Copy size={16} /></button>
          <button className="hover:text-gray-300 transition-colors"><ThumbsUp size={16} /></button>
          <button className="hover:text-gray-300 transition-colors"><ThumbsDown size={16} /></button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-full text-sm transition-colors">Add testing setup</button>
          <button className="bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-full text-sm transition-colors">Configure CI/CD</button>
          <button className="bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-full text-sm transition-colors">Add ESLint rules</button>
        </div>
      </div>

      {/* User Message */}
      <div className="flex justify-end pt-4">
        <div className="bg-white/10 text-gray-200 rounded-3xl px-5 py-3.5 max-w-[85%]">
          帮我重构用户认证模块，加上单元测试
        </div>
      </div>

      {/* AI Response with Tool Calls */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-4 h-4 rounded-full border-2 border-gray-500 border-t-transparent animate-spin"></div>
          <span>Thinking for 5s</span>
        </div>

        <div className="space-y-2.5 font-mono text-sm">
          <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                <Check size={10} strokeWidth={3} />
              </div>
              <span className="text-purple-400 font-medium">glob</span>
              <span className="text-gray-400">src/auth/**/*.{"{ts,tsx}"}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>0.3s</span>
              <span className="text-xs">&gt;</span>
            </div>
          </div>

          <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                <Check size={10} strokeWidth={3} />
              </div>
              <span className="text-blue-400 font-medium">read</span>
              <span className="text-gray-400">src/auth/AuthProvider.tsx</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>0.1s</span>
              <span className="text-xs">&gt;</span>
            </div>
          </div>

          <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                <Check size={10} strokeWidth={3} />
              </div>
              <span className="text-green-400 font-medium">bash</span>
              <span className="text-gray-400">npm test -- --coverage src/auth/</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>3.2s</span>
              <span className="text-xs">&gt;</span>
            </div>
          </div>

          <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                <Check size={10} strokeWidth={3} />
              </div>
              <span className="text-orange-400 font-medium">write</span>
              <span className="text-gray-400">src/auth/AuthProvider.tsx — refactored with useReducer</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>0.2s</span>
            </div>
          </div>

          <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                <Check size={10} strokeWidth={3} />
              </div>
              <span className="text-orange-400 font-medium">write</span>
              <span className="text-gray-400">src/auth/__tests__/auth.test.ts — added 6 new tests</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>0.1s</span>
            </div>
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <p>Refactored the auth module. Key changes:</p>
          <ol className="list-decimal list-inside space-y-2.5 text-gray-300 marker:text-gray-500">
            <li>Replaced <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm">useState</code> with <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm">useReducer</code> for cleaner state transitions</li>
            <li>Extracted token management into <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm">tokenService.ts</code></li>
            <li>Added <strong>6 new unit tests</strong> covering edge cases</li>
            <li>Test coverage improved from <em className="text-gray-400">72%</em> to <em className="text-gray-400">94.3%</em></li>
          </ol>
        </div>

        <div className="flex items-center gap-3 text-gray-500 pt-2">
          <button className="hover:text-gray-300 transition-colors"><Copy size={16} /></button>
          <button className="hover:text-gray-300 transition-colors"><ThumbsUp size={16} /></button>
          <button className="hover:text-gray-300 transition-colors"><ThumbsDown size={16} /></button>
        </div>
      </div>
    </div>
  );
}
