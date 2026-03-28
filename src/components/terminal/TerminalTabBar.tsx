import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';

export interface TerminalInfo {
  id: number;
  title: string;
  cwd: string;
}

interface TerminalTabBarProps {
  tabs: TerminalInfo[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}

export function TerminalTabBar({ tabs, activeId, onSelect, onClose, onNew }: TerminalTabBarProps) {
  return (
    <div className="flex items-center shrink-0 h-[33px] border-b border-white/10 px-1 gap-0.5 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            className={`flex items-center gap-1.5 cursor-pointer group h-[27px] px-2.5 rounded-md transition-colors shrink-0 ${
              isActive
                ? 'bg-white/[0.08] text-zinc-100'
                : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
            }`}
            onClick={() => onSelect(t.id)}
          >
            <TerminalIcon size={12} className={isActive ? 'text-amber-400' : 'text-zinc-600'} />
            <span className="text-[12px] max-w-[120px] truncate font-medium">
              {t.title}
            </span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              className="flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
            >
              <X size={10} className="text-zinc-500" />
            </span>
          </button>
        );
      })}

      <button
        onClick={onNew}
        className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 transition-colors ml-0.5 shrink-0 text-zinc-500 hover:text-zinc-300"
        title="New Terminal"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
