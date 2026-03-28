import React, { useState } from 'react';
import { Check, File, Folder, ChevronDown, ChevronRight, GitCompareArrows } from 'lucide-react';
import { ContentBlock, FileChangeItem } from '../../types';

type FileChangesData = Extract<ContentBlock, { type: 'file_changes' }>;

const STATUS_BADGE: Record<FileChangeItem['status'], { label: string; className: string }> = {
  new:      { label: 'NEW', className: 'bg-emerald-500/15 text-emerald-400' },
  modified: { label: 'MOD', className: 'bg-amber-500/15 text-amber-400' },
  deleted:  { label: 'DEL', className: 'bg-red-500/15 text-red-400' },
  renamed:  { label: 'REN', className: 'bg-blue-500/15 text-blue-400' },
};

/** Group files by their parent directory */
function groupByDir(files: FileChangeItem[]) {
  const groups: Record<string, FileChangeItem[]> = {};
  for (const f of files) {
    const lastSlash = f.path.lastIndexOf('/');
    const dir = lastSlash > 0 ? f.path.slice(0, lastSlash) : '.';
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(f);
  }
  return groups;
}

export function FileChangesBlock({ title, files }: FileChangesData) {
  const groups = groupByDir(files);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02] cursor-pointer w-full text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <GitCompareArrows size={14} className="text-violet-400 shrink-0" />
        <span className="text-xs font-medium text-gray-400 flex-1">{title}</span>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button className="px-3 py-1 rounded-lg text-[12px] font-medium bg-white text-black hover:bg-gray-200 transition-colors">
            Accept
          </button>
          <button className="px-3 py-1 rounded-lg text-[12px] font-medium bg-white/10 text-gray-300 hover:bg-white/15 transition-colors">
            Reject
          </button>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
        />
      </button>

      {/* Collapsible file tree */}
      {expanded && (
        <div className="px-4 py-3 space-y-0.5">
          {Object.entries(groups).map(([dir, dirFiles]) => (
            <DirGroup key={dir} dir={dir} files={dirFiles} />
          ))}
        </div>
      )}
    </div>
  );
}

function DirGroup({ dir, files }: { dir: string; files: FileChangeItem[] }) {
  const [open, setOpen] = useState(true);

  if (dir === '.') {
    return (
      <>
        {files.map(f => <FileRow key={f.path} file={f} indent={false} />)}
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-2 py-2 cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition-colors w-full text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          size={14}
          className={`text-gray-500 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <Folder size={16} className="text-blue-400 shrink-0" />
        <span className="text-[14px] text-gray-300">{dir}</span>
      </button>
      {open && files.map(f => <FileRow key={f.path} file={f} indent />)}
    </div>
  );
}

function FileRow({ file, indent }: { file: FileChangeItem; indent: boolean }) {
  const fileName = file.path.split('/').pop() || file.path;
  const badge = STATUS_BADGE[file.status];

  return (
    <div className={`flex items-center gap-2 py-1.5 ${indent ? 'pl-7' : ''}`}>
      <File size={16} className="text-gray-500 shrink-0" />
      <span className="text-[14px] text-gray-300">{fileName}</span>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${badge.className}`}>
        {badge.label}
      </span>
    </div>
  );
}
