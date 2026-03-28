import { Play, Pause, Square } from 'lucide-react';
import type { HarnessGroup } from '../../types';

interface HarnessControlBarProps {
  group: HarnessGroup;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-zinc-400',
  running: 'text-green-400',
  paused: 'text-yellow-400',
  completed: 'text-blue-400',
  failed: 'text-red-400',
};

export function HarnessControlBar({
  group, onStart, onPause, onResume, onStop,
}: HarnessControlBarProps) {
  const isRunning = group.status === 'running';
  const isPaused = group.status === 'paused';
  const isIdle = group.status === 'idle';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/95 border border-zinc-700 rounded-lg px-4 py-2 shadow-lg backdrop-blur-sm">
      <span className="text-sm font-medium text-zinc-200">{group.name}</span>
      <div className="w-px h-4 bg-zinc-700" />
      <span className={`text-xs font-medium ${STATUS_COLORS[group.status]}`}>
        {group.status.toUpperCase()}
      </span>
      {group.currentSprint > 0 && (
        <>
          <div className="w-px h-4 bg-zinc-700" />
          <span className="text-xs text-zinc-400">
            Sprint {group.currentSprint}
            {isRunning && ` | Round ${group.currentRound + 1}/${group.maxRetries}`}
          </span>
        </>
      )}
      <div className="w-px h-4 bg-zinc-700" />
      <div className="flex items-center gap-1">
        {(isIdle || group.status === 'completed' || group.status === 'failed') && (
          <button onClick={onStart}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 hover:text-green-400 transition-colors"
            title="Start pipeline">
            <Play size={14} />
          </button>
        )}
        {isRunning && (
          <button onClick={onPause}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 hover:text-yellow-400 transition-colors"
            title="Pause pipeline">
            <Pause size={14} />
          </button>
        )}
        {isPaused && (
          <button onClick={onResume}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 hover:text-green-400 transition-colors"
            title="Resume pipeline">
            <Play size={14} />
          </button>
        )}
        {(isRunning || isPaused) && (
          <button onClick={onStop}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 hover:text-red-400 transition-colors"
            title="Stop pipeline">
            <Square size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
