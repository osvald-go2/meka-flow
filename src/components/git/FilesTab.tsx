import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { useGit } from '../../contexts/GitProvider';
import { highlight } from '../../utils/syntaxHighlight';
import type { TreeNode } from '../../types/git';

function extToLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    rs: 'rust', go: 'go', py: 'python', rb: 'ruby',
    css: 'css', html: 'html', json: 'json',
    md: 'plaintext', txt: 'plaintext', toml: 'toml', yaml: 'yaml', yml: 'yaml',
    sh: 'bash', zsh: 'bash', bash: 'bash',
  };
  return map[ext] ?? 'text';
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const colors: Record<string, string> = {
    ts: 'text-blue-400', tsx: 'text-blue-400',
    js: 'text-yellow-400', jsx: 'text-yellow-400',
    css: 'text-purple-400', json: 'text-green-400',
    rs: 'text-orange-400', md: 'text-gray-400',
    toml: 'text-gray-400', html: 'text-red-400',
  };
  return <File size={14} className={colors[ext ?? ''] ?? 'text-gray-500'} />;
}

function TreeNodeItem({
  node,
  depth,
  changedPaths,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  changedPaths: Map<string, string>;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const changeStatus = changedPaths.get(node.path);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full px-2 py-0.5 hover:bg-white/5 text-left text-xs"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? <FolderOpen size={14} className="text-yellow-500" /> : <Folder size={14} className="text-yellow-500" />}
          <span className="text-white/80 truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <TreeNodeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            changedPaths={changedPaths}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      className="flex items-center gap-1 w-full px-2 py-0.5 hover:bg-white/5 text-left text-xs"
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
      onClick={() => onSelectFile(node.path)}
    >
      <FileIcon name={node.name} />
      <span className="text-white/70 truncate flex-1">{node.name}</span>
      {changeStatus && (
        <span className={`text-[10px] font-mono ${
          changeStatus === 'A' ? 'text-green-400' :
          changeStatus === 'D' ? 'text-red-400' : 'text-yellow-400'
        }`}>
          {changeStatus}
        </span>
      )}
    </button>
  );
}

export function FilesTab({ selectedFile: externalFile, onFileConsumed }: { selectedFile?: string | null; onFileConsumed?: () => void }) {
  const { fileTree, changes, getFileContent, refreshFileTree } = useGit();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fileTree.length === 0) {
      refreshFileTree();
    }
  }, []);

  useEffect(() => {
    if (externalFile) {
      handleSelectFile(externalFile);
      onFileConsumed?.();
    }
  }, [externalFile]);

  const changedPaths = new Map(changes.map(c => [c.path, c.status]));

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path);
    setLoading(true);
    try {
      const content = await getFileContent(path);
      setFileContent(content);
    } catch {
      setFileContent('// Failed to load file');
    }
    setLoading(false);
  };

  if (selectedFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <button
            onClick={() => setSelectedFile(null)}
            className="text-white/50 hover:text-white/80 text-xs"
          >
            &larr; Back
          </button>
          <span className="text-white/60 text-xs truncate">{selectedFile}</span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="text-white/30 text-xs">Loading...</div>
          ) : (() => {
            const lines = fileContent.split('\n');
            const lang = extToLanguage(selectedFile);
            return (
              <div className="flex text-xs font-mono leading-5">
                <div className="text-white/20 text-right select-none pr-3 shrink-0" style={{ minWidth: `${String(lines.length).length + 1}ch` }}>
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre className="flex-1 overflow-x-auto text-white/70 whitespace-pre-wrap break-all">
                  {lines.map((line, i) => (
                    <div key={i} dangerouslySetInnerHTML={{ __html: highlight(line, lang) || '\n' }} />
                  ))}
                </pre>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto py-1">
      {fileTree.length === 0 ? (
        <div className="text-white/30 text-xs text-center py-8">No files tracked</div>
      ) : (
        fileTree.map(node => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            changedPaths={changedPaths}
            onSelectFile={handleSelectFile}
          />
        ))
      )}
    </div>
  );
}
