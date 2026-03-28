import React from 'react';
import { Circle, Loader2, CheckCircle2, ListTodo } from 'lucide-react';
import { TodoItem } from '../../types';

export function TodoListBlock({ items }: { items: TodoItem[] }) {
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <ListTodo size={14} className="text-violet-400" />
        <span className="text-xs font-medium text-gray-400">Tasks</span>
        <span className="text-xs text-gray-500 ml-auto">{doneCount}/{items.length}</span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 text-sm">
            {item.status === 'pending' && (
              <Circle size={16} className="text-gray-500 shrink-0" />
            )}
            {item.status === 'in_progress' && (
              <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
            )}
            {item.status === 'done' && (
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            )}
            <span className={`${
              item.status === 'done' ? 'line-through text-gray-500' :
              item.status === 'in_progress' ? 'text-blue-200' :
              'text-gray-300'
            }`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
