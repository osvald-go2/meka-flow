import React, { useState, useEffect } from 'react';
import { Session } from '../types';
import { SessionWindow } from './SessionWindow';
import { MessageSquare, GitBranch, FolderGit2, Search, MoreHorizontal, Trash2 } from 'lucide-react';
import { STATUS_COLORS } from '../utils/statusColors';

export function TabView({
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  // Handle focusing on a specific session from global search
  useEffect(() => {
    if (focusedSessionId) {
      setActiveSessionId(focusedSessionId);
      const timer = setTimeout(() => onClearFocus?.(), 800);
      return () => clearTimeout(timer);
    }
  }, [focusedSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => {
    const lastTs = (s: Session) => {
      if (s.messages.length === 0) return Infinity; // new sessions first
      const last = s.messages[s.messages.length - 1];
      return last.timestamp ?? 0;
    };
    return lastTs(b) - lastTs(a);
  });

  return (
    <div className="w-full h-full flex">
      {/* Left Sidebar - Session List */}
      <div className="w-80 flex flex-col bg-surface/80">
        <div className="p-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-0.5">
          {filteredSessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`w-full text-left rounded-lg transition-all duration-200 group px-4 py-2.5 ${
                activeSessionId === session.id
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white truncate">
                  {session.title}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide ${
                    STATUS_COLORS[session.status].badgeBg} ${STATUS_COLORS[session.status].badgeText
                  }`}>
                    {session.status === 'inprocess' ? 'IN PROCESS' : session.status}
                  </span>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id); }}
                      aria-label="Session options"
                      aria-expanded={menuOpenId === session.id}
                      className="p-0.5 rounded text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal size={14} />
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
                              const id = session.id;
                              if (activeSessionId === id) {
                                const idx = sessions.findIndex(s => s.id === id);
                                const next = sessions[idx + 1] ?? sessions[idx - 1] ?? null;
                                setActiveSessionId(next?.id ?? null);
                              }
                              setSessions((prev: Session[]) => prev.filter(s => s.id !== id));
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
              </div>

              {activeSessionId === session.id && (
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <div className="flex items-center gap-1">
                    <GitBranch size={12} />
                    <span className="truncate max-w-[80px]">{session.gitBranch || 'main'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FolderGit2 size={12} />
                    <span className="truncate max-w-[80px]">{session.worktree || 'default'}</span>
                  </div>
                </div>
              )}
            </button>
          ))}

          {filteredSessions.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No sessions found
            </div>
          )}
        </div>
      </div>

      {/* Right Content - Full Screen Session */}
      <div className="flex-1 relative overflow-hidden flex bg-[#14100E]">
        {activeSession ? (
          <SessionWindow
            session={activeSession}
            onUpdate={(updated) => {
              setSessions((prev: Session[]) => prev.map(s => s.id === updated.id ? updated : s));
            }}
            onClose={() => setActiveSessionId(null)}
            onDelete={() => {
              const id = activeSession.id;
              const idx = sessions.findIndex(s => s.id === id);
              const next = sessions[idx + 1] ?? sessions[idx - 1] ?? null;
              setActiveSessionId(next?.id ?? null);
              setSessions((prev: Session[]) => prev.filter(s => s.id !== id));
            }}
            fullScreen={true}
            variant="tab"
            projectDir={projectDir}
            onToggleGitPanel={onToggleGitPanel}
            onCopySession={onCopySession}
            onOpenFileInPanel={onOpenFileInPanel}
            onOpenDiffInPanel={onOpenDiffInPanel}
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-gray-500 gap-4">
            <MessageSquare size={48} className="opacity-20" />
            <p>Select a session from the sidebar to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
