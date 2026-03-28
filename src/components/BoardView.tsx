import React, { useState, useRef, useEffect } from 'react';
import { Session, SessionStatus } from '../types';
import { getModelDisplayName } from '../models';
import { MessageSquare, MoreHorizontal, Circle, ZoomIn, ZoomOut, Maximize, GitBranch, GitFork, Trash2 } from 'lucide-react';
import { SessionWindow } from './SessionWindow';

const COLUMNS: { 
  id: SessionStatus; 
  title: string; 
  color: string;
  badgeBg: string;
  cardBorder: string;
  cardBgHover: string;
  dotColor: string;
}[] = [
  { id: 'inbox', title: 'Inbox', color: 'text-gray-300', badgeBg: 'bg-gray-500/20 text-gray-300', cardBorder: 'border-t-gray-500/50', cardBgHover: 'hover:bg-gray-500/10', dotColor: 'text-gray-400' },
  { id: 'inprocess', title: 'In Process', color: 'text-blue-300', badgeBg: 'bg-blue-500/20 text-blue-300', cardBorder: 'border-t-blue-500/50', cardBgHover: 'hover:bg-blue-500/10', dotColor: 'text-blue-400' },
  { id: 'review', title: 'Review', color: 'text-amber-300', badgeBg: 'bg-amber-500/20 text-amber-300', cardBorder: 'border-t-amber-500/50', cardBgHover: 'hover:bg-amber-500/10', dotColor: 'text-amber-400' },
  { id: 'done', title: 'Done', color: 'text-emerald-300', badgeBg: 'bg-emerald-500/20 text-emerald-300', cardBorder: 'border-t-emerald-500/50', cardBgHover: 'hover:bg-emerald-500/10', dotColor: 'text-emerald-400' },
];

export function BoardView({
  sessions,
  setSessions,
  focusedSessionId,
  projectDir,
  onToggleGitPanel,
  onCopySession,
  onActiveSessionChange,
  onClearFocus,
  onOpenFileInPanel,
  onOpenDiffInPanel,
}: {
  sessions: Session[],
  setSessions: any,
  focusedSessionId?: string | null,
  projectDir?: string | null,
  onToggleGitPanel?: () => void,
  onCopySession?: (title: string) => void,
  onActiveSessionChange?: (id: string | null) => void,
  onClearFocus?: () => void,
  onOpenFileInPanel?: (path: string) => void,
  onOpenDiffInPanel?: (path: string) => void,
}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [displaySession, setDisplaySession] = useState<Session | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Keep displaySession around for the exit animation
  useEffect(() => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (session) {
      setDisplaySession(session);
    } else {
      // Delay clearing the display session to allow slide-out animation
      const timer = setTimeout(() => setDisplaySession(null), 300);
      return () => clearTimeout(timer);
    }
  }, [activeSessionId, sessions]);

  // Notify parent of active session changes
  useEffect(() => {
    onActiveSessionChange?.(activeSessionId);
  }, [activeSessionId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [menuOpenId]);

  // Zoom & Pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Handle focusing on a specific session
  useEffect(() => {
    if (focusedSessionId) {
      setActiveSessionId(focusedSessionId);
      const cardElement = cardRefs.current[focusedSessionId];
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      const timer = setTimeout(() => onClearFocus?.(), 800);
      return () => clearTimeout(timer);
    }
  }, [focusedSessionId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      const isScrollable = (e.target as HTMLElement).closest('.custom-scrollbar');
      
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); 
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
        if (isScrollable) return;
        e.preventDefault(); 
        setTransform(prev => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || !(e.target as HTMLElement).closest('.no-pan')) {
      e.preventDefault();
      setIsDragging(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setTransform(p => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }));
  const handleZoomOut = () => setTransform(p => ({ ...p, scale: Math.max(p.scale / 1.2, 0.1) }));
  const handleResetZoom = () => setTransform({ x: 0, y: 0, scale: 1 });

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData('sessionId', sessionId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: SessionStatus) => {
    e.preventDefault();
    const sessionId = e.dataTransfer.getData('sessionId');
    if (sessionId) {
      setSessions((prev: Session[]) => prev.map(s => s.id === sessionId ? { ...s, status } : s));
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="w-full h-full flex overflow-hidden bg-black/20 backdrop-blur-sm">
      {/* Board Area - Canvas Container */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Transform Wrapper */}
        <div 
          className="absolute top-0 left-0 flex gap-6 p-8 h-full transition-transform duration-300 ease-out"
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {COLUMNS.map(col => (
            <div 
              key={col.id}
              className="flex-shrink-0 w-80 flex flex-col gap-4 no-pan"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Circle size={10} className={`${col.dotColor} fill-current`} />
                  <h2 className={`font-medium ${col.color}`}>{col.title}</h2>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${col.badgeBg}`}>
                  {sessions.filter(s => s.status === col.id).length}
                </span>
              </div>
              
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4 custom-scrollbar">
                {sessions.filter(s => s.status === col.id).map(session => (
                  <div 
                    key={session.id}
                    ref={el => {
                      cardRefs.current[session.id] = el;
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, session.id)}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`bg-white/5 ${col.cardBgHover} border border-white/5 border-t-2 ${col.cardBorder} ${activeSessionId === session.id ? 'ring-2 ring-blue-500/50 bg-white/10 shadow-blue-500/20' : ''} ${focusedSessionId === session.id ? 'animate-pulse' : ''} rounded-2xl p-4 cursor-pointer transition-all shadow-lg backdrop-blur-md`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="font-medium text-gray-100 truncate">{session.title}</h4>
                        {session.worktree && session.worktree !== 'default' && (
                          <GitFork size={12} className="text-amber-400 shrink-0" />
                        )}
                        {session.gitBranch && (
                          <div className="flex items-center gap-1 shrink-0">
                            <GitBranch size={11} className="text-orange-400" />
                            <span className="text-[11px] font-mono text-orange-300 truncate max-w-[100px]">{session.gitBranch}</span>
                          </div>
                        )}
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id); }}
                          className="text-gray-500 hover:text-gray-300"
                          aria-label="Session options"
                          aria-expanded={menuOpenId === session.id}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuOpenId === session.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-36 bg-surface-elevated border border-white/10 rounded-lg shadow-xl z-50 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(null);
                                if (window.confirm('确定要删除这个 session 吗？')) {
                                  if (activeSessionId === session.id) setActiveSessionId(null);
                                  setSessions((prev: Session[]) => prev.filter(s => s.id !== session.id));
                                }
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                            >
                              <Trash2 size={14} />
                              <span>删除</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-4">
                      {(() => {
                        for (let i = session.messages.length - 1; i >= 0; i--) {
                          const msg = session.messages[i];
                          if (msg.role !== 'assistant') continue;
                          if (msg.blocks) {
                            const textBlock = msg.blocks.find(
                              b => b.type === 'text' && 'content' in b && b.content && !b.content.startsWith('Connected:')
                            );
                            if (textBlock && 'content' in textBlock) return textBlock.content;
                          }
                          if (msg.content && !msg.content.startsWith('Connected:')) return msg.content;
                        }
                        return 'No messages yet.';
                      })()}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-md">
                        {getModelDisplayName(session.model)}
                      </span>
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <MessageSquare size={12} />
                        <span>{session.messages.length}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10 z-10 no-pan cursor-default">
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
        </div>
      </div>

      {/* Right Sidebar for Active Session */}
      <div
        className={`absolute right-0 top-0 h-full w-[500px] border-l border-white/10 bg-surface/80 backdrop-blur-3xl flex flex-col shadow-2xl z-20 transition-transform duration-300 ease-in-out ${
          activeSessionId ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {displaySession && (
          <div className="flex-1 overflow-hidden relative flex flex-col">
             <SessionWindow
               session={displaySession}
               onUpdate={(updated) => setSessions((prev: Session[]) => prev.map(s => s.id === updated.id ? updated : s))}
               onClose={() => setActiveSessionId(null)}
               onDelete={() => {
                 const id = displaySession.id;
                 setActiveSessionId(null);
                 setSessions((prev: Session[]) => prev.filter(s => s.id !== id));
               }}
               fullScreen={true}
               projectDir={projectDir}
               onToggleGitPanel={onToggleGitPanel}
               onCopySession={onCopySession}
               onOpenFileInPanel={onOpenFileInPanel}
               onOpenDiffInPanel={onOpenDiffInPanel}
             />
          </div>
        )}
      </div>
    </div>
  );
}
