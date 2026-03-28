import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Session } from '../types';
import { SessionWindow } from './SessionWindow';
import { ZoomIn, ZoomOut, Maximize, Hand, MousePointer2, Send, Map, LayoutGrid, Plus, Mic, ArrowUp, Settings2, Trash2 } from 'lucide-react';
import { SESSION_WIDTH, SESSION_MIN_WIDTH, SESSION_MAX_WIDTH, SESSION_DEFAULT_HEIGHT, SESSION_MIN_HEIGHT, SESSION_GAP, START_X, START_Y } from '@/constants';
import { getAgentType } from '../models';
import { ConnectionLine } from './harness/ConnectionLine';
import { RoleBadge } from './harness/RoleBadge';
import { RolePickerModal } from './harness/RolePickerModal';
import { HarnessControlBar } from './harness/HarnessControlBar';
import type { HarnessRole, SessionWindowHandle } from '../types';
import type { UseHarnessController } from '../services/harnessController';

export function CanvasView({
  sessions,
  setSessions,
  focusedSessionId,
  projectDir,
  transform,
  onTransformChange,
  onCanvasResize,
  onToggleGitPanel,
  onCopySession,
  onActiveSessionChange,
  onClearFocus,
  onNewSession,
  harness,
  sessionRefs,
  onOpenFileInPanel,
  onOpenDiffInPanel,
}: {
  sessions: Session[],
  setSessions: any,
  focusedSessionId?: string | null,
  projectDir?: string | null,
  transform: { x: number; y: number; scale: number },
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number }>>,
  onCanvasResize?: (width: number) => void,
  onToggleGitPanel?: () => void,
  onCopySession?: (title: string) => void,
  onActiveSessionChange?: (id: string | null) => void,
  onClearFocus?: () => void,
  onNewSession?: () => void,
  harness?: UseHarnessController,
  sessionRefs?: React.RefObject<Map<string, SessionWindowHandle>>,
  onOpenFileInPanel?: (path: string) => void,
  onOpenDiffInPanel?: (path: string) => void,
}) {
  const setTransform = onTransformChange;
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Tool and Selection State
  const [toolMode, setToolMode] = useState<'hand' | 'select'>('select');
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [showMinimap, setShowMinimap] = useState(true);
  const [isArranging, setIsArranging] = useState(false);
  const arrangingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Harness connection state
  const [connectingFrom, setConnectingFrom] = useState<{ sessionId: string; x: number; y: number } | null>(null);
  const [connectingMouse, setConnectingMouse] = useState<{ x: number; y: number } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ fromId: string; toId: string } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Notify parent of active session changes
  useEffect(() => {
    onActiveSessionChange?.(selectedSessionIds[selectedSessionIds.length - 1] ?? null);
  }, [selectedSessionIds]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  // Cleanup arranging timeout on unmount
  useEffect(() => {
    return () => {
      if (arrangingTimeoutRef.current) {
        clearTimeout(arrangingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !onCanvasResize) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        onCanvasResize(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [onCanvasResize]);

  // Refs for group drag (avoid stale closures)
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const selectedIdsRef = useRef(selectedSessionIds);
  selectedIdsRef.current = selectedSessionIds;
  const groupDragInitialPositionsRef = useRef<Record<string, { x: number; y: number }>>({});

  // Delete/Backspace to delete selected sessions
  const deleteSelectedRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIdsRef.current.length === 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGroupDragStart = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const s of sessionsRef.current) {
      if (selectedIdsRef.current.includes(s.id)) {
        positions[s.id] = { x: s.position.x, y: s.position.y };
      }
    }
    groupDragInitialPositionsRef.current = positions;
  }, []);

  const handleGroupDragMove = useCallback((deltaX: number, deltaY: number) => {
    const initials = groupDragInitialPositionsRef.current;
    if (Object.keys(initials).length === 0) return;
    setSessions((prev: Session[]) => prev.map(s => {
      const init = initials[s.id];
      if (init) {
        return { ...s, position: { x: init.x + deltaX, y: init.y + deltaY } };
      }
      return s;
    }));
  }, [setSessions]);

  // Handle focusing on a specific session
  useEffect(() => {
    if (focusedSessionId && containerRef.current) {
      const session = sessions.find(s => s.id === focusedSessionId);
      if (session) {
        const container = containerRef.current.getBoundingClientRect();
        const sessionWidth = session.width ?? SESSION_WIDTH;
        const sessionHeight = session.height ?? SESSION_DEFAULT_HEIGHT;

        // Calculate new transform to center the session
        const newScale = 1; // Reset scale to 1 for better visibility
        const newX = (container.width / 2) - (session.position.x * newScale) - (sessionWidth / 2);
        const newY = (container.height / 2) - (session.position.y * newScale) - (sessionHeight / 2);

        setTransform({ x: newX, y: newY, scale: newScale });
      }
      // Clear focus after panning so the highlight doesn't persist
      const timer = setTimeout(() => onClearFocus?.(), 800);
      return () => clearTimeout(timer);
    }
  }, [focusedSessionId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let wheelRafId: number | null = null;
    let pendingWheelEvent: WheelEvent | null = null;

    const processWheel = () => {
      wheelRafId = null;
      const e = pendingWheelEvent;
      if (!e) return;
      pendingWheelEvent = null;

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setTransform(prev => {
          const newScale = Math.max(0.1, Math.min(prev.scale * zoomFactor, 3));
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
          const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);

          return { x: newX, y: newY, scale: newScale };
        });
      } else {
        setTransform(prev => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };

    const handleNativeWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const isInsideSession = target.closest('.session-container');
      if (isInsideSession) return;
      e.preventDefault();

      pendingWheelEvent = e;
      if (wheelRafId === null) {
        wheelRafId = requestAnimationFrame(processWheel);
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      if (wheelRafId !== null) cancelAnimationFrame(wheelRafId);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.session-container') || target.closest('.ui-overlay')) {
      return;
    }

    (document.activeElement as HTMLElement)?.blur();

    if (toolMode === 'hand') {
      e.preventDefault();
      setIsDraggingCanvas(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    } else if (toolMode === 'select') {
      e.preventDefault();
      const rect = containerRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;
      setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        setSelectedSessionIds([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Harness connection dragging
    if (connectingFrom) {
      const canvasRect = containerRef.current?.getBoundingClientRect();
      if (canvasRect) {
        const x = (e.clientX - canvasRect.left - transform.x) / transform.scale;
        const y = (e.clientY - canvasRect.top - transform.y) / transform.scale;
        setConnectingMouse({ x, y });
      }
    }

    if (toolMode === 'hand' && isDraggingCanvas) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.clientX, y: e.clientY });
    } else if (toolMode === 'select' && selectionBox) {
      const rect = containerRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      setSelectionBox(prev => ({ ...prev!, currentX: x, currentY: y }));

      const minX = Math.min(selectionBox.startX, x);
      const maxX = Math.max(selectionBox.startX, x);
      const minY = Math.min(selectionBox.startY, y);
      const maxY = Math.max(selectionBox.startY, y);

      const newSelectedIds = sessions.filter(session => {
        const sessionWidth = session.width ?? SESSION_WIDTH;
        const sessionHeight = session.height ?? SESSION_DEFAULT_HEIGHT;
        const sMinX = session.position.x;
        const sMaxX = session.position.x + sessionWidth;
        const sMinY = session.position.y;
        const sMaxY = session.position.y + sessionHeight;

        return sMinX < maxX && sMaxX > minX && sMinY < maxY && sMaxY > minY;
      }).map(s => s.id);

      setSelectedSessionIds(newSelectedIds);
    }
  };

  const handleMouseUp = () => {
    // Cancel harness connection if dragging on empty canvas
    if (connectingFrom) {
      setConnectingFrom(null);
      setConnectingMouse(null);
    }

    if (toolMode === 'hand') {
      setIsDraggingCanvas(false);
    } else if (toolMode === 'select') {
      setSelectionBox(null);
    }
  };

  const handleZoomIn = () => setTransform(p => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }));
  const handleZoomOut = () => setTransform(p => ({ ...p, scale: Math.max(p.scale / 1.2, 0.1) }));
  const handleResetZoom = () => setTransform({ x: 0, y: 0, scale: 1 });

  const handleDeleteSelected = () => {
    if (selectedSessionIds.length === 0) return;
    const count = selectedSessionIds.length;
    if (!window.confirm(`确定要删除选中的 ${count} 个 session 吗？`)) return;
    setSessions((prev: Session[]) => prev.filter(s => !selectedSessionIds.includes(s.id)));
    setSelectedSessionIds([]);
  };
  deleteSelectedRef.current = handleDeleteSelected;

  const handleBroadcast = () => {
    if (!broadcastMessage.trim() || selectedSessionIds.length < 2) return;
    
    setSessions((prev: Session[]) => prev.map(session => {
      if (selectedSessionIds.includes(session.id)) {
        return {
          ...session,
          messages: [
            ...session.messages,
            {
              id: crypto.randomUUID(),
              role: 'user',
              content: broadcastMessage,
              type: 'text',
              timestamp: Date.now()
            }
          ]
        };
      }
      return session;
    }));
    
    setBroadcastMessage('');
    setSelectedSessionIds([]);
  };

  const handleArrangeSessions = useCallback(() => {
    if (sessions.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const viewportWidth = container.getBoundingClientRect().width;
    const columns = Math.max(1, Math.floor(viewportWidth / (SESSION_WIDTH + SESSION_GAP)));
    const columnHeights = new Array(columns).fill(START_Y);

    const sorted = [...sessions].sort((a, b) => a.id.localeCompare(b.id));
    const updates: Record<string, { x: number; y: number }> = {};

    for (const session of sorted) {
      const minCol = columnHeights.indexOf(Math.min(...columnHeights));
      updates[session.id] = {
        x: START_X + minCol * (SESSION_WIDTH + SESSION_GAP),
        y: columnHeights[minCol],
      };
      columnHeights[minCol] += SESSION_DEFAULT_HEIGHT + SESSION_GAP;
    }

    if (arrangingTimeoutRef.current) {
      clearTimeout(arrangingTimeoutRef.current);
    }

    setIsArranging(true);
    setSessions((prev: Session[]) =>
      prev.map(s => updates[s.id]
        ? { ...s, position: updates[s.id], height: SESSION_DEFAULT_HEIGHT, prevHeight: undefined }
        : s)
    );
    setTransform(prev => ({ ...prev, x: 0, y: 0 }));

    arrangingTimeoutRef.current = setTimeout(() => {
      setIsArranging(false);
      arrangingTimeoutRef.current = null;
    }, 400);
  }, [sessions, setSessions, setTransform]);

  const handleArrangeCancel = useCallback(() => {
    if (arrangingTimeoutRef.current) {
      clearTimeout(arrangingTimeoutRef.current);
      arrangingTimeoutRef.current = null;
    }
    setIsArranging(false);
  }, []);

  // Harness connection handlers
  const handleAnchorDragStart = useCallback((sessionId: string, anchorX: number, anchorY: number) => {
    setConnectingFrom({ sessionId, x: anchorX, y: anchorY });
  }, []);

  const handleAnchorDragEnd = useCallback((targetSessionId: string) => {
    if (connectingFrom && connectingFrom.sessionId !== targetSessionId) {
      setPendingConnection({ fromId: connectingFrom.sessionId, toId: targetSessionId });
    }
    setConnectingFrom(null);
    setConnectingMouse(null);
  }, [connectingFrom]);

  const handleConnectionConfirm = useCallback((fromRole: HarnessRole, toRole: HarnessRole, groupName: string) => {
    if (!pendingConnection || !harness) return;
    let group = harness.groups.find(g => g.name === groupName);
    if (!group) {
      group = harness.createGroup(groupName);
    }
    harness.addConnection(group.id, pendingConnection.fromId, pendingConnection.toId, fromRole, toRole);
    setSelectedGroupId(group.id);
    setPendingConnection(null);
  }, [pendingConnection, harness]);

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full overflow-hidden relative canvas-bg ${isDraggingCanvas || connectingFrom || selectionBox ? 'select-none' : ''} ${toolMode === 'hand' ? (isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className="absolute top-0 left-0 w-full h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('.session-container')) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }
        }}
      >
        {/* Harness connection lines */}
        {harness && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {harness.getAllConnections().map(conn => {
              const fromSession = sessions.find(s => s.id === conn.fromSessionId);
              const toSession = sessions.find(s => s.id === conn.toSessionId);
              if (!fromSession || !toSession) return null;

              // Calculate edge connection points using actual constants
              const fw = fromSession.width ?? SESSION_WIDTH;
              const fh = fromSession.height ?? SESSION_DEFAULT_HEIGHT;
              const tw = toSession.width ?? SESSION_WIDTH;
              const th = toSession.height ?? SESSION_DEFAULT_HEIGHT;
              const fcx = fromSession.position.x + fw / 2;
              const fcy = fromSession.position.y + fh / 2;
              const tcx = toSession.position.x + tw / 2;
              const tcy = toSession.position.y + th / 2;

              // Determine which edge to connect from/to based on relative position
              const dx = tcx - fcx;
              const dy = tcy - fcy;
              let fromX: number, fromY: number, toX: number, toY: number;

              if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal: connect right→left or left→right
                if (dx > 0) {
                  fromX = fromSession.position.x + fw; fromY = fcy;
                  toX = toSession.position.x; toY = tcy;
                } else {
                  fromX = fromSession.position.x; fromY = fcy;
                  toX = toSession.position.x + tw; toY = tcy;
                }
              } else {
                // Vertical: connect bottom→top or top→bottom
                if (dy > 0) {
                  fromX = fcx; fromY = fromSession.position.y + fh;
                  toX = tcx; toY = toSession.position.y;
                } else {
                  fromX = fcx; fromY = fromSession.position.y;
                  toX = tcx; toY = toSession.position.y + th;
                }
              }

              const group = harness.groups.find(g => g.connections.some(c => c.id === conn.id));
              return (
                <ConnectionLine key={conn.id} fromX={fromX} fromY={fromY} toX={toX} toY={toY}
                  fromRole={conn.fromRole} toRole={conn.toRole} groupStatus={group?.status || 'idle'} />
              );
            })}
            {connectingFrom && connectingMouse && (
              <line x1={connectingFrom.x} y1={connectingFrom.y} x2={connectingMouse.x} y2={connectingMouse.y}
                stroke="#6b7280" strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
            )}
          </svg>
        )}

        {sessions.map(session => (
          <DraggableSession
            key={session.id}
            session={session}
            transformScale={transform.scale}
            isFocused={focusedSessionId === session.id}
            isSelected={selectedSessionIds.includes(session.id)}
            toolMode={toolMode}
            isGroupDrag={selectedSessionIds.includes(session.id) && selectedSessionIds.length > 1}
            onGroupDragStart={handleGroupDragStart}
            onGroupDragMove={handleGroupDragMove}
            onSelect={(multi) => {
              if (toolMode === 'select') {
                if (multi) {
                  setSelectedSessionIds(prev => prev.includes(session.id) ? prev.filter(id => id !== session.id) : [...prev, session.id]);
                } else {
                  setSelectedSessionIds([session.id]);
                }
              }
            }}
            updateSession={(updated) => {
              setSessions((prev: Session[]) => prev.map(s => s.id === updated.id ? updated : s));
            }}
            onDelete={() => setSessions((prev: Session[]) => prev.filter(s => s.id !== session.id))}
            projectDir={projectDir}
            onToggleGitPanel={onToggleGitPanel}
            onCopySession={onCopySession}
            isArranging={isArranging}
            onArrangeCancel={handleArrangeCancel}
            harness={harness}
            connectingFrom={connectingFrom}
            onAnchorDragStart={handleAnchorDragStart}
            onAnchorDragEnd={handleAnchorDragEnd}
            sessionRefs={sessionRefs}
            onOpenFileInPanel={onOpenFileInPanel}
            onOpenDiffInPanel={onOpenDiffInPanel}
          />
        ))}

        {/* Selection Box */}
        {selectionBox && (
          <div 
            className="absolute border border-blue-400 bg-blue-500/20 pointer-events-none z-40"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
            }}
          />
        )}
      </div>

      {/* Tools */}
      <div 
        className="absolute top-6 left-6 flex flex-col gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 z-50 ui-overlay"
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={() => setToolMode('select')}
          className={`p-2 rounded-lg transition-colors ${toolMode === 'select' ? 'bg-blue-500/50 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
          title="Select Tool"
          aria-label="Select tool"
        >
          <MousePointer2 size={20} />
        </button>
        <button
          onClick={() => setToolMode('hand')}
          className={`p-2 rounded-lg transition-colors ${toolMode === 'hand' ? 'bg-blue-500/50 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
          title="Pan Tool"
          aria-label="Pan tool"
        >
          <Hand size={20} />
        </button>
      </div>

      {/* Broadcast Input Box */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[660px] z-50 transition-all duration-300 ease-out ui-overlay ${
          selectedSessionIds.length >= 2
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Ambient glow behind the card */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-orange-400/20 via-orange-300/35 to-orange-400/20 blur-sm" />
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-orange-400/15 via-orange-300/25 to-orange-400/15" />

        {/* Main card */}
        <div className="relative bg-[#1E1E2E]/70 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden">
          {/* Header bar */}
          <div className="flex justify-between items-center px-4 pt-3 pb-1">
            <span className="text-xs font-medium text-orange-300/80">
              Broadcasting to {selectedSessionIds.length} sessions
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors"
                title="删除选中的 sessions"
              >
                <Trash2 size={12} />
                Delete
              </button>
              <button onClick={() => setSelectedSessionIds([])} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="px-4 pt-1">
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Message selected sessions..."
              aria-label="Broadcast message"
              className="w-full bg-transparent text-sm text-white/90 placeholder-gray-500 focus:outline-none resize-none leading-relaxed"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleBroadcast();
                }
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <button aria-label="Add attachment" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors border border-white/5">
                <Plus size={16} />
              </button>
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors border border-white/5 text-xs font-medium">
                <Settings2 size={14} />
                Tools
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button aria-label="Voice input" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 transition-colors hover:bg-white/5">
                <Mic size={16} />
              </button>
              <button
                onClick={handleBroadcast}
                disabled={!broadcastMessage.trim() || selectedSessionIds.length < 2}
                aria-label="Send broadcast"
                className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 flex items-center justify-center transition-colors border border-white/5"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimap */}
      {showMinimap && sessions.length > 0 && (
        <CanvasMinimap
          sessions={sessions}
          selectedSessionIds={selectedSessionIds}
          transform={transform}
          containerRef={containerRef}
          onNavigate={setTransform}
        />
      )}

      {/* Zoom Controls */}
      <div
        className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10 z-50 cursor-default ui-overlay"
        onMouseDown={e => e.stopPropagation()}
      >
        <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors" title="Zoom In" aria-label="Zoom in">
          <ZoomIn size={18} />
        </button>
        <span className="text-xs font-mono text-gray-400 w-12 text-center select-none">
          {Math.round(transform.scale * 100)}%
        </span>
        <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors" title="Zoom Out" aria-label="Zoom out">
          <ZoomOut size={18} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={handleResetZoom} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors" title="Reset View" aria-label="Reset view">
          <Maximize size={18} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={handleArrangeSessions}
          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors"
          title="整理画布"
          aria-label="Arrange canvas"
        >
          <LayoutGrid size={18} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={() => setShowMinimap(v => !v)}
          className={`p-1.5 rounded-lg transition-colors ${showMinimap ? 'bg-blue-500/30 text-blue-300' : 'text-gray-300 hover:bg-white/10'}`}
          title="Toggle Minimap"
          aria-label="Toggle minimap"
        >
          <Map size={18} />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[59]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-[60] bg-black/40 backdrop-blur-md rounded-xl border border-white/10 py-1.5 shadow-2xl"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 60),
            }}
          >
            <button
              onClick={() => {
                onNewSession?.();
                setContextMenu(null);
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 w-full transition-colors"
            >
              <Plus size={16} />
              新建会话
            </button>
            <button
              onClick={() => {
                handleArrangeSessions();
                setContextMenu(null);
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 w-full transition-colors"
            >
              <LayoutGrid size={16} />
              整理画布
            </button>
          </div>
        </>
      )}

      {/* Harness Control Bar — show for selected group, or first group if none selected */}
      {harness && harness.groups.length > 0 && (() => {
        const group = (selectedGroupId && harness.groups.find(g => g.id === selectedGroupId))
          || harness.groups[0];
        if (!group) return null;
        return (
          <HarnessControlBar group={group}
            onStart={() => harness.startPipeline(group.id)}
            onPause={() => harness.pausePipeline(group.id)}
            onResume={() => harness.resumePipeline(group.id)}
            onStop={() => harness.stopPipeline(group.id)} />
        );
      })()}

      {/* Role Picker Modal */}
      {pendingConnection && (
        <RolePickerModal
          fromSessionTitle={sessions.find(s => s.id === pendingConnection.fromId)?.title || ''}
          toSessionTitle={sessions.find(s => s.id === pendingConnection.toId)?.title || ''}
          onConfirm={handleConnectionConfirm}
          onCancel={() => setPendingConnection(null)}
          existingGroupNames={harness?.groups.map(g => g.name) || []}
        />
      )}
    </div>
  );
}

// --- Minimap ---

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
const MINIMAP_PADDING = 60;
const NAVIGATION_MARGIN = 300;

const MODEL_COLORS: Record<string, string> = {
  claude: '#a78bfa',
  codex: '#34d399',
  gemini: '#60a5fa',
};

function CanvasMinimap({
  sessions,
  selectedSessionIds,
  transform,
  containerRef,
  onNavigate,
}: {
  sessions: Session[];
  selectedSessionIds: string[];
  transform: { x: number; y: number; scale: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNavigate: React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number }>>;
}) {
  const minimapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Compute content bounds (bounding box of all sessions)
  const contentBounds = useMemo(() => {
    if (sessions.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of sessions) {
      minX = Math.min(minX, s.position.x);
      minY = Math.min(minY, s.position.y);
      maxX = Math.max(maxX, s.position.x + (s.width ?? SESSION_WIDTH));
      maxY = Math.max(maxY, s.position.y + (s.height ?? SESSION_DEFAULT_HEIGHT));
    }
    return {
      minX: minX - MINIMAP_PADDING,
      minY: minY - MINIMAP_PADDING,
      maxX: maxX + MINIMAP_PADDING,
      maxY: maxY + MINIMAP_PADDING,
    };
  }, [sessions]);

  const worldW = contentBounds.maxX - contentBounds.minX;
  const worldH = contentBounds.maxY - contentBounds.minY;

  // Fit into minimap keeping aspect ratio
  const minimapScale = Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH);
  const drawW = worldW * minimapScale;
  const drawH = worldH * minimapScale;

  // Map canvas coords to minimap coords
  const toMinimap = useCallback(
    (cx: number, cy: number) => ({
      x: (cx - contentBounds.minX) * minimapScale,
      y: (cy - contentBounds.minY) * minimapScale,
    }),
    [contentBounds, minimapScale]
  );

  // Viewport rect in minimap
  const viewportRect = useMemo(() => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const vpLeft = -transform.x / transform.scale;
    const vpTop = -transform.y / transform.scale;
    const vpW = rect.width / transform.scale;
    const vpH = rect.height / transform.scale;
    const tl = toMinimap(vpLeft, vpTop);
    return {
      x: tl.x,
      y: tl.y,
      width: vpW * minimapScale,
      height: vpH * minimapScale,
    };
  }, [transform, containerRef, toMinimap, minimapScale]);

  // Clamp canvas center point to content area + margin
  const clampCanvas = useCallback(
    (cx: number, cy: number) => ({
      x: Math.max(contentBounds.minX - NAVIGATION_MARGIN, Math.min(cx, contentBounds.maxX + NAVIGATION_MARGIN)),
      y: Math.max(contentBounds.minY - NAVIGATION_MARGIN, Math.min(cy, contentBounds.maxY + NAVIGATION_MARGIN)),
    }),
    [contentBounds]
  );

  // Navigate: center viewport on a canvas-space point (clamped)
  const navigateTo = useCallback(
    (canvasX: number, canvasY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clamped = clampCanvas(canvasX, canvasY);
      const scale = transformRef.current.scale;
      const newX = -(clamped.x * scale) + rect.width / 2;
      const newY = -(clamped.y * scale) + rect.height / 2;
      onNavigate({ x: newX, y: newY, scale });
    },
    [containerRef, clampCanvas, onNavigate]
  );

  // Click-to-jump: convert minimap pixel to canvas coords and navigate
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const el = minimapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const offsetX = (MINIMAP_WIDTH - drawW) / 2;
      const offsetY = (MINIMAP_HEIGHT - drawH) / 2;
      const canvasX = (mx - offsetX) / minimapScale + contentBounds.minX;
      const canvasY = (my - offsetY) / minimapScale + contentBounds.minY;
      navigateTo(canvasX, canvasY);
    },
    [navigateTo, drawW, drawH, minimapScale, contentBounds]
  );

  // Drag handling — incremental delta mode
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const prev = dragStartRef.current;
      if (!prev) {
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      // Convert minimap pixel delta to canvas-space delta
      const canvasDx = dx / minimapScale;
      const canvasDy = dy / minimapScale;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const t = transformRef.current;

      // Current viewport center in canvas space
      const centerX = (-t.x + rect.width / 2) / t.scale;
      const centerY = (-t.y + rect.height / 2) / t.scale;

      navigateTo(centerX + canvasDx, centerY + canvasDy);
    };
    const onUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, minimapScale, containerRef, navigateTo]);

  const offsetX = (MINIMAP_WIDTH - drawW) / 2;
  const offsetY = (MINIMAP_HEIGHT - drawH) / 2;

  return (
    <div
      ref={minimapRef}
      className="absolute bottom-16 right-6 z-50 ui-overlay rounded-xl overflow-hidden border border-white/10 bg-black/50 backdrop-blur-md cursor-crosshair select-none"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        handleMinimapClick(e);
      }}
    >
      {/* Session rectangles */}
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="absolute inset-0"
      >
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          {sessions.map((s) => {
            const pos = toMinimap(s.position.x, s.position.y);
            const w = (s.width ?? SESSION_WIDTH) * minimapScale;
            const h = (s.height ?? SESSION_DEFAULT_HEIGHT) * minimapScale;
            const isSelected = selectedSessionIds.includes(s.id);
            const color = isSelected ? '#3b82f6' : (MODEL_COLORS[getAgentType(s.model)] || '#94a3b8');
            return (
              <rect
                key={s.id}
                x={pos.x}
                y={pos.y}
                width={w}
                height={h}
                rx={2}
                fill={color}
                fillOpacity={isSelected ? 0.7 : 0.5}
                stroke={color}
                strokeOpacity={isSelected ? 1 : 0.8}
                strokeWidth={isSelected ? 1.5 : 1}
              />
            );
          })}
          {/* Viewport indicator */}
          {viewportRect && (
            <rect
              x={viewportRect.x}
              y={viewportRect.y}
              width={viewportRect.width}
              height={viewportRect.height}
              rx={2}
              fill="white"
              fillOpacity={0.08}
              stroke="white"
              strokeOpacity={0.6}
              strokeWidth={1.5}
            />
          )}
        </g>
      </svg>
    </div>
  );
}

const DraggableSession = React.memo(function DraggableSession({
  session,
  transformScale,
  isFocused,
  isSelected,
  toolMode,
  isGroupDrag,
  onGroupDragStart,
  onGroupDragMove,
  onSelect,
  updateSession,
  onDelete,
  projectDir,
  onToggleGitPanel,
  onCopySession,
  isArranging,
  onArrangeCancel,
  harness,
  connectingFrom,
  onAnchorDragStart,
  onAnchorDragEnd,
  sessionRefs,
  onOpenFileInPanel,
  onOpenDiffInPanel,
}: {
  session: Session,
  transformScale: number,
  isFocused?: boolean,
  isSelected?: boolean,
  toolMode: 'hand' | 'select',
  isGroupDrag: boolean,
  onGroupDragStart: () => void,
  onGroupDragMove: (dx: number, dy: number) => void,
  onSelect?: (multi: boolean) => void,
  updateSession: (s: Session) => void,
  onDelete: () => void,
  projectDir?: string | null,
  onToggleGitPanel?: () => void,
  onCopySession?: (title: string) => void,
  isArranging?: boolean,
  onArrangeCancel?: () => void,
  harness?: UseHarnessController,
  connectingFrom?: { sessionId: string; x: number; y: number } | null,
  onAnchorDragStart?: (sessionId: string, anchorX: number, anchorY: number) => void,
  onAnchorDragEnd?: (targetSessionId: string) => void,
  sessionRefs?: React.RefObject<Map<string, SessionWindowHandle>>,
  onOpenFileInPanel?: (path: string) => void,
  onOpenDiffInPanel?: (path: string) => void,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Group drag refs
  const dragStartPointRef = useRef({ x: 0, y: 0 });
  const isGroupDragActiveRef = useRef(false);

  // Capture-phase selection tracking
  const selectionHandledRef = useRef(false);
  const INTERACTIVE_SELECTOR = 'button, input, textarea, a, select, [contenteditable]';

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);
  const [animateHeight, setAnimateHeight] = useState(false);

  // Horizontal resize state
  const [isResizingX, setIsResizingX] = useState<'left' | 'right' | false>(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartPosX, setResizeStartPosX] = useState(0);

  // Capture phase: runs before child stopPropagation can block bubble phase
  const handleMouseDownCapture = (e: React.MouseEvent) => {
    selectionHandledRef.current = false;
    const target = e.target as HTMLElement;
    const isInteractive = !!target.closest(INTERACTIVE_SELECTOR);

    if (toolMode === 'select') {
      // Handle selection in capture phase so content area clicks also trigger selection
      if (!isInteractive && !isGroupDrag) {
        onSelect?.(e.shiftKey || e.metaKey || e.ctrlKey);
        selectionHandledRef.current = true;
      }
      // Don't stopPropagation — let children work normally (scroll, text selection, etc.)
    } else if (toolMode === 'hand') {
      // Hand mode + group drag: initiate group drag from anywhere
      if (isGroupDrag && !isInteractive) {
        if (isArranging) {
          onArrangeCancel?.();
        }
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        onGroupDragStart();
        dragStartPointRef.current = {
          x: e.clientX / transformScale,
          y: e.clientY / transformScale,
        };
        isGroupDragActiveRef.current = true;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isHeader = !!target.closest('.session-header');
    const isHandModeDrag = toolMode === 'hand' && !target.closest('button, input, textarea, a, select, [contenteditable], .msg-content');
    const canDrag = isHeader || isHandModeDrag;

    if (canDrag) {
      if (isArranging) {
        onArrangeCancel?.();
      }
      e.stopPropagation();
      // Don't reset selection when starting a group drag
      if (!isGroupDrag) {
        if (!selectionHandledRef.current) {
          onSelect?.(e.shiftKey || e.metaKey || e.ctrlKey);
        }
      }
      setIsDragging(true);

      if (isGroupDrag && !isGroupDragActiveRef.current) {
        onGroupDragStart();
        dragStartPointRef.current = {
          x: e.clientX / transformScale,
          y: e.clientY / transformScale
        };
        isGroupDragActiveRef.current = true;
      } else if (!isGroupDrag) {
        setDragOffset({
          x: e.clientX / transformScale - session.position.x,
          y: e.clientY / transformScale - session.position.y
        });
        isGroupDragActiveRef.current = false;
      }
    } else {
      if (!selectionHandledRef.current) {
        onSelect?.(e.shiftKey || e.metaKey || e.ctrlKey);
      }
    }
  };

  // Refs for drag/resize handlers to avoid stale closures
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;
  const updateSessionRef = useRef(updateSession);
  updateSessionRef.current = updateSession;
  const dragOffsetRef = useRef(dragOffset);
  dragOffsetRef.current = dragOffset;
  const onGroupDragMoveRef = useRef(onGroupDragMove);
  onGroupDragMoveRef.current = onGroupDragMove;

  // Drag movement
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isGroupDragActiveRef.current) {
        const deltaX = e.clientX / transformScaleRef.current - dragStartPointRef.current.x;
        const deltaY = e.clientY / transformScaleRef.current - dragStartPointRef.current.y;
        onGroupDragMoveRef.current(deltaX, deltaY);
      } else {
        updateSessionRef.current({
          ...sessionRef.current,
          position: {
            x: e.clientX / transformScaleRef.current - dragOffsetRef.current.x,
            y: e.clientY / transformScaleRef.current - dragOffsetRef.current.y
          }
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      isGroupDragActiveRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStartY(e.clientY / transformScale);
    setResizeStartHeight(session.height ?? SESSION_DEFAULT_HEIGHT);
  };

  const resizeStartYRef = useRef(resizeStartY);
  resizeStartYRef.current = resizeStartY;
  const resizeStartHeightRef = useRef(resizeStartHeight);
  resizeStartHeightRef.current = resizeStartHeight;

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY / transformScaleRef.current - resizeStartYRef.current;
      const newHeight = Math.max(SESSION_MIN_HEIGHT, resizeStartHeightRef.current + deltaY);
      updateSessionRef.current({ ...sessionRef.current, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Horizontal resize handlers
  const handleResizeXMouseDown = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingX(side);
    setResizeStartX(e.clientX / transformScale);
    setResizeStartWidth(session.width ?? SESSION_WIDTH);
    setResizeStartPosX(session.position.x);
  };

  const resizeStartXRef = useRef(resizeStartX);
  resizeStartXRef.current = resizeStartX;
  const resizeStartWidthRef = useRef(resizeStartWidth);
  resizeStartWidthRef.current = resizeStartWidth;
  const resizeStartPosXRef = useRef(resizeStartPosX);
  resizeStartPosXRef.current = resizeStartPosX;
  const isResizingXRef = useRef(isResizingX);
  isResizingXRef.current = isResizingX;

  useEffect(() => {
    if (!isResizingX) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX / transformScaleRef.current - resizeStartXRef.current;
      if (isResizingXRef.current === 'right') {
        const newWidth = Math.min(SESSION_MAX_WIDTH, Math.max(SESSION_MIN_WIDTH, resizeStartWidthRef.current + deltaX));
        updateSessionRef.current({ ...sessionRef.current, width: newWidth });
      } else {
        const newWidth = Math.min(SESSION_MAX_WIDTH, Math.max(SESSION_MIN_WIDTH, resizeStartWidthRef.current - deltaX));
        const actualDelta = resizeStartWidthRef.current - newWidth;
        updateSessionRef.current({
          ...sessionRef.current,
          width: newWidth,
          position: { ...sessionRef.current.position, x: resizeStartPosXRef.current + actualDelta },
        });
      }
    };

    const handleMouseUp = () => setIsResizingX(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingX]);

  // Header double-click: toggle collapse/expand
  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    const currentHeight = session.height ?? SESSION_DEFAULT_HEIGHT;
    const fullHeight = session.prevHeight ?? SESSION_DEFAULT_HEIGHT;
    const halfHeight = Math.max(SESSION_MIN_HEIGHT, Math.round(fullHeight / 2));
    setAnimateHeight(true);
    if (session.prevHeight && currentHeight <= halfHeight + 10) {
      updateSession({ ...session, height: session.prevHeight, prevHeight: undefined });
    } else {
      updateSession({ ...session, height: halfHeight, prevHeight: currentHeight });
    }
    setTimeout(() => setAnimateHeight(false), 350);
  };

  const currentHeight = session.height ?? SESSION_DEFAULT_HEIGHT;

  return (
    <div
      className={`session-container absolute transition-shadow duration-300 ${isDragging ? 'select-none' : ''} ${isFocused ? 'ring-4 ring-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/20' : ''} ${isSelected ? 'ring-2 ring-blue-400 rounded-2xl shadow-lg shadow-blue-500/20' : ''} ${toolMode === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      style={{
        left: session.position.x,
        top: session.position.y,
        zIndex: isDragging || isResizing || isResizingX ? 30 : isSelected || isFocused ? 20 : 1,
        transition: isArranging && !isDragging ? 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1), top 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
      }}
      onContextMenu={(e) => e.stopPropagation()}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseDown={handleMouseDown}
    >
      <SessionWindow
        ref={(handle) => {
          if (handle) {
            sessionRefs?.current?.set(session.id, handle);
          } else {
            sessionRefs?.current?.delete(session.id);
          }
        }}
        session={session}
        onUpdate={updateSession}
        onDelete={onDelete}
        height={currentHeight}
        animateHeight={animateHeight}
        onHeaderDoubleClick={handleHeaderDoubleClick}
        projectDir={projectDir}
        onToggleGitPanel={onToggleGitPanel}
        onCopySession={onCopySession}
        onOpenFileInPanel={onOpenFileInPanel}
        onOpenDiffInPanel={onOpenDiffInPanel}
      />
      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize group z-10"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors" />
      </div>
      {/* Left resize handle */}
      <div
        className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-10 group"
        onMouseDown={handleResizeXMouseDown('left')}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-12 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors" />
      </div>
      {/* Right resize handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize z-10 group"
        onMouseDown={handleResizeXMouseDown('right')}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-12 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors" />
      </div>

      {/* Harness role badge */}
      {harness && (() => {
        const roleInfo = harness.getSessionRole(session.id);
        return roleInfo ? (
          <div className="absolute -top-2 -right-2 z-20">
            <RoleBadge role={roleInfo.role} />
          </div>
        ) : null;
      })()}

      {/* Harness connection anchors — 4 sides (top, right, bottom, left) */}
      {harness && (() => {
        const w = session.width ?? SESSION_WIDTH;
        const h = currentHeight;
        const anchors = [
          { id: 'top',    cls: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', ax: session.position.x + w / 2, ay: session.position.y },
          { id: 'right',  cls: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', ax: session.position.x + w, ay: session.position.y + h / 2 },
          { id: 'bottom', cls: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', ax: session.position.x + w / 2, ay: session.position.y + h },
          { id: 'left',   cls: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2', ax: session.position.x, ay: session.position.y + h / 2 },
        ];
        const isTarget = connectingFrom && connectingFrom.sessionId !== session.id;
        return anchors.map(a => (
          <div
            key={a.id}
            className={`absolute ${a.cls} group z-20 cursor-crosshair`}
            style={{ width: 32, height: 32 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onAnchorDragStart?.(session.id, a.ax, a.ay);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              if (connectingFrom) onAnchorDragEnd?.(session.id);
            }}
          >
            <div className={`absolute inset-0 m-auto rounded-full border-2 transition-all duration-200 ${
              isTarget
                ? 'w-5 h-5 bg-blue-500/60 border-blue-400 opacity-100 animate-pulse shadow-lg shadow-blue-500/50'
                : 'w-3.5 h-3.5 bg-blue-500/80 border-blue-300 opacity-0 group-hover:opacity-100 shadow-md shadow-blue-500/30'
            }`} />
          </div>
        ));
      })()}
    </div>
  );
});
