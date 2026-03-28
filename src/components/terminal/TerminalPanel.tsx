import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Terminal as TerminalIcon } from 'lucide-react';
import { TerminalTab } from './TerminalTab';
import { TerminalTabBar, TerminalInfo } from './TerminalTabBar';

const MIN_HEIGHT = 150;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 300;

export interface TerminalPanelProps {
  onClose: () => void;
  cwd: string;
}

export function TerminalPanel({ onClose, cwd }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;
  const activePtyIds = useRef<Set<number>>(new Set());

  const handleNewTab = useCallback(async () => {
    const aiBackend = (window as any).aiBackend;
    if (!aiBackend?.ptySpawn) {
      setError('Terminal not available (requires Electron)');
      return;
    }

    try {
      setError(null);
      const dir = cwdRef.current || '/';
      const id = await aiBackend.ptySpawn(dir);
      activePtyIds.current.add(id);
      const title = dir.split('/').pop() || 'terminal';
      setTabs((prev) => [...prev, { id, title, cwd: dir }]);
      setActiveTabId(id);
    } catch (err) {
      setError(`Failed to create terminal: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const handleCloseTab = useCallback(
    async (id: number) => {
      const aiBackend = (window as any).aiBackend;
      try {
        await aiBackend?.ptyKill(id);
      } catch {
        // Terminal may already be dead
      }
      activePtyIds.current.delete(id);

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          const closedIdx = prev.findIndex((t) => t.id === id);
          const newActive = next[Math.min(closedIdx, next.length - 1)];
          setActiveTabId(newActive?.id ?? null);
        }
        if (next.length === 0) {
          onClose();
        }
        return next;
      });
    },
    [activeTabId, onClose],
  );

  // Mount: auto-create first tab; Unmount: kill all PTYs
  useEffect(() => {
    handleNewTab();
    return () => {
      const aiBackend = (window as any).aiBackend;
      activePtyIds.current.forEach((id) => aiBackend?.ptyKill(id).catch(() => {}));
      activePtyIds.current.clear();
    };
  }, [handleNewTab]);

  // Drag-to-resize
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: panelHeight };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - ev.clientY;
        const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta));
        setPanelHeight(newH);
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [panelHeight],
  );

  return (
    <div
      className="flex flex-col shrink-0 bg-surface/60 backdrop-blur-3xl border-t border-white/10 relative"
      style={{ height: panelHeight }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="absolute left-0 right-0 top-0 h-1.5 cursor-row-resize z-10 hover:bg-amber-400/25 transition-colors"
      />

      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={13} className="text-amber-400" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Terminal
          </h2>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          title="Close Terminal"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <TerminalTabBar
        tabs={tabs}
        activeId={activeTabId}
        onSelect={setActiveTabId}
        onClose={handleCloseTab}
        onNew={handleNewTab}
      />

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-[12px] text-red-400 bg-red-500/10 border-b border-red-500/20 shrink-0">
          {error}
        </div>
      )}

      {/* Terminal instances */}
      <div className="flex-1 relative overflow-hidden bg-black/60 rounded-lg m-1 mt-0">
        {tabs.map((t) => (
          <TerminalTab key={t.id} terminalId={t.id} visible={t.id === activeTabId} />
        ))}
      </div>
    </div>
  );
}
