import { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, FileChangeItem } from '../../types';

interface SessionFilesSummaryProps {
  messages: Message[];
  onNavigateToFile: (path: string) => void;
  onNavigateToDiff: (path: string) => void;
}

const STATUS_DOT: Record<FileChangeItem['status'], string> = {
  new: 'bg-emerald-400',
  modified: 'bg-amber-400',
  deleted: 'bg-red-400',
  renamed: 'bg-blue-400',
};

export function SessionFilesSummary({ messages, onNavigateToFile, onNavigateToDiff }: SessionFilesSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const files = useMemo(() => {
    const fileMap = new Map<string, FileChangeItem>();
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.blocks) continue;
      for (const block of msg.blocks) {
        if (block.type === 'file_changes') {
          for (const file of block.files) {
            fileMap.set(file.path, file);
          }
        }
      }
    }
    return Array.from(fileMap.values());
  }, [messages]);

  if (files.length === 0) return null;

  return (
    <div className="mx-1 mb-2 rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
        aria-expanded={expanded}
      >
        <FileText size={14} className="text-zinc-400 shrink-0" />
        <span className="text-xs font-medium text-zinc-400 flex-1">
          {files.length} 个文件已修改
        </span>
        {expanded
          ? <ChevronDown size={14} className="text-zinc-500" />
          : <ChevronRight size={14} className="text-zinc-500" />
        }
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-0.5">
              {files.map((file) => (
                <div key={file.path} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[file.status]}`} />

                  <button
                    type="button"
                    onClick={() => onNavigateToFile(file.path)}
                    className="text-[13px] text-zinc-300 hover:text-white truncate text-left min-w-0 flex-1 cursor-pointer transition-colors"
                    title={file.path}
                  >
                    {file.path}
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToDiff(file.path)}
                    className="flex items-center gap-1.5 shrink-0 font-mono text-[12px] cursor-pointer hover:bg-white/[0.06] rounded px-1.5 py-0.5 transition-colors"
                  >
                    {(file.additions ?? 0) > 0 && (
                      <span className="text-emerald-400 font-medium">+{file.additions}</span>
                    )}
                    {(file.deletions ?? 0) > 0 && (
                      <span className="text-red-400 font-medium">-{file.deletions}</span>
                    )}
                    {(file.additions ?? 0) === 0 && (file.deletions ?? 0) === 0 && (
                      <span className="text-zinc-500">0</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
