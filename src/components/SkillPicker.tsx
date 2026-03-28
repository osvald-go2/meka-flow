import React, { useEffect, useRef } from 'react';
import { SkillInfo } from '../types';
import { Command } from 'lucide-react';

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-amber-300">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SkillPicker({
  skills,
  query,
  selectedIndex,
  onSelect,
}: {
  skills: SkillInfo[];
  query: string;
  selectedIndex: number;
  onSelect: (skill: SkillInfo) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-surface-elevated border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[240px] overflow-y-auto custom-scrollbar z-50"
    >
      {skills.map((skill, i) => (
        <button
          key={skill.filePath + skill.name}
          onClick={() => onSelect(skill)}
          className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
            i === selectedIndex
              ? 'bg-white/10'
              : 'hover:bg-white/5'
          }`}
        >
          <Command size={14} className="text-gray-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              /{highlightMatch(skill.name, query)}
            </div>
            {skill.description && (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {skill.description}
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-600 ml-auto shrink-0 mt-0.5">
            {skill.pluginName || (skill.source === 'project' ? 'project' : 'user')}
          </span>
        </button>
      ))}
    </div>
  );
}
