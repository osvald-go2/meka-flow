import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Maximize, Plus, ChevronDown, Check, FolderOpen, Search, Columns, GitBranch, Loader2, Terminal } from 'lucide-react';
import { Session, DbProject } from '../types';

function getProjectAbbr(name: string): string {
  const words = name.split(/[-_\s]+/);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const PROJECT_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-rose-500', 'bg-cyan-500'];

function getProjectColor(id: number): string {
  return PROJECT_COLORS[id % PROJECT_COLORS.length];
}

export function TopBar({
  viewMode,
  setViewMode,
  onNewSession,
  sessions,
  onLocateSession,
  searchInputRef,
  showGitPanel,
  onToggleGitPanel,
  showTerminal,
  onToggleTerminal,
  showIsland,
  onToggleIsland,
  onOpenDirectory,
  projectDir,
  currentProject,
  projects,
  onSwitchProject,
  isSwitchingProject,
}: {
  viewMode: 'canvas' | 'board' | 'tab',
  setViewMode: (mode: 'canvas' | 'board' | 'tab') => void,
  onNewSession: () => void,
  sessions: Session[],
  onLocateSession: (id: string) => void,
  searchInputRef?: React.RefObject<HTMLInputElement | null>,
  showGitPanel?: boolean,
  onToggleGitPanel?: () => void,
  showTerminal?: boolean,
  onToggleTerminal?: () => void,
  showIsland?: boolean,
  onToggleIsland?: () => void,
  onOpenDirectory?: () => void,
  projectDir?: string | null,
  currentProject?: DbProject | null,
  projects?: DbProject[],
  onSwitchProject?: (projectId: number) => void,
  isSwitchingProject?: boolean,
}) {
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).aiBackend?.onFullScreenChange?.((fs: boolean) => setIsFullScreen(fs));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isProjectDropdownOpen) setIsProjectDropdownOpen(false);
        if (isSearchOpen) setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProjectDropdownOpen, isSearchOpen]);

  const projectList = projects ?? [];

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleTitleBarDoubleClick = (e: React.MouseEvent) => {
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if ((el.style as any).webkitAppRegion === 'no-drag') return;
      el = el.parentElement;
    }
    (window as any).aiBackend?.toggleMaximize?.();
  };

  return (
    <header
      className="h-14 border-b border-white/10 bg-black/20 backdrop-blur-md z-50 relative"
      style={{ paddingLeft: isFullScreen ? '16px' : '86px', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="h-full flex items-center justify-between pr-6"
        onDoubleClick={handleTitleBarDoubleClick}
      >
      <div className="flex items-center gap-4">
        <h1 className="font-semibold text-lg bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
          Meka Flow
        </h1>

        {/* Project Switcher */}
        <div className="relative" ref={dropdownRef} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium text-gray-200"
            disabled={isSwitchingProject}
          >
            {isSwitchingProject ? (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            ) : currentProject ? (
              <>
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${getProjectColor(currentProject.id)} text-white`}>
                  {getProjectAbbr(currentProject.name)}
                </div>
                {currentProject.name}
              </>
            ) : (
              <span className="text-gray-400">No Project</span>
            )}
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProjectDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-[420px] bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              {projectList.length > 0 && (
                <div className="p-2">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-2">Recent Projects</div>
                  {projectList.map(project => {
                    const isActive = currentProject?.id === project.id;
                    return (
                      <button
                        key={project.id}
                        onClick={() => {
                          onSwitchProject?.(project.id);
                          setIsProjectDropdownOpen(false);
                        }}
                        disabled={isSwitchingProject}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left group disabled:opacity-50
                          ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white ${getProjectColor(project.id)}`}>
                          {getProjectAbbr(project.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate transition-colors ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                            {project.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">{project.path}</div>
                        </div>
                        {isActive && (
                          <Check size={15} className="text-orange-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={`${projectList.length > 0 ? 'border-t border-white/10' : ''} p-2`}>
                <button
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    onOpenDirectory?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition-colors text-left text-gray-400 hover:text-gray-200"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 shrink-0">
                    <FolderOpen size={16} />
                  </div>
                  <span className="text-sm font-medium">Open Folder...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-white/20 mx-2"></div>
        <div className="flex bg-white/5 rounded-lg p-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button 
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'canvas' ? 'bg-white/15 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Maximize size={16} />
            Canvas
          </button>
          <button 
            onClick={() => setViewMode('board')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'board' ? 'bg-white/15 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <LayoutDashboard size={16} />
            Board
          </button>
          <button 
            onClick={() => setViewMode('tab')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'tab' ? 'bg-white/15 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Columns size={16} />
            Tab
          </button>
        </div>
      </div>

      {/* 中间空白区 — 继承父级 drag，拖拽和双击由系统原生处理 */}
      <div className="flex-1 h-full" />

      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative" ref={searchRef} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search sessions...  ⌘K"
              aria-label="Search sessions"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-64 bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-white/10 transition-all"
            />
          </div>
          
          {isSearchOpen && searchQuery && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-surface-overlay/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 flex flex-col">
              <div className="p-2 overflow-y-auto custom-scrollbar">
                {filteredSessions.length > 0 ? (
                  filteredSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => {
                        onLocateSession(session.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/10 rounded-lg transition-colors group"
                    >
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white truncate">{session.title}</div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {session.messages[session.messages.length - 1]?.content || 'No messages'}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                    No sessions found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {onToggleIsland && (
          <button
            onClick={onToggleIsland}
            title="Toggle Island"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showIsland
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="4" rx="2"/>
              <rect x="6" y="3" width="12" height="8" rx="2"/>
            </svg>
          </button>
        )}
        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            title="Toggle Terminal (Ctrl+`)"
            aria-label="Toggle Terminal"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showTerminal
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <Terminal size={16} />
          </button>
        )}
        {onToggleGitPanel && (
          <button
            onClick={onToggleGitPanel}
            title="Toggle Git Panel"
            aria-label="Toggle Git Panel"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showGitPanel
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <GitBranch size={16} />
          </button>
        )}
        <button onClick={onNewSession} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus size={16} />
          New Session
        </button>
      </div>
      </div>
    </header>
  );
}
