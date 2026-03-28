import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { highlight } from '../utils/syntaxHighlight';

export function CodeBlock({ code, language }: { code: string, language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <span className="text-xs font-medium text-gray-400">{language || 'text'}</span>
        <button onClick={handleCopy} className="text-gray-500 hover:text-gray-300 transition-colors">
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar text-xs font-mono leading-relaxed">
        <pre className="whitespace-pre" dangerouslySetInnerHTML={{ __html: highlight(code, language) }} />
      </div>
    </div>
  );
}
