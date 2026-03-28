import React, { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { FormTableColumn } from '../../types';

export function FormTableBlock({
  title,
  columns,
  rows: initialRows,
  submitLabel = '提交',
}: {
  title?: string;
  columns: FormTableColumn[];
  rows: Record<string, string>[];
  submitLabel?: string;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>(initialRows);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (rowIndex: number, key: string, value: string) => {
    setRows(prev => prev.map((row, i) => i === rowIndex ? { ...row, [key]: value } : row));
  };

  const handleAddRow = () => {
    const emptyRow: Record<string, string> = {};
    columns.forEach(col => { emptyRow[col.key] = ''; });
    setRows(prev => [...prev, emptyRow]);
  };

  const handleDeleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
      {title && (
        <div className="px-4 py-2.5 border-b border-white/10 text-sm font-medium text-gray-300">
          {title}
        </div>
      )}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04]">
              {columns.map(col => (
                <th key={col.key} className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-white/10">
                  {col.label}
                </th>
              ))}
              {!submitted && (
                <th className="w-10 border-b border-white/10" />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="group border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-1.5">
                    {submitted ? (
                      <span className="text-gray-300 px-1">{row[col.key]}</span>
                    ) : col.type === 'select' ? (
                      <select
                        value={row[col.key] || ''}
                        onChange={e => handleChange(rowIndex, col.key, e.target.value)}
                        className="w-full bg-transparent text-gray-200 px-2 py-1.5 rounded-lg border border-transparent focus:border-white/20 focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-zinc-900">选择...</option>
                        {col.options?.map(opt => (
                          <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={col.type || 'text'}
                        value={row[col.key] || ''}
                        onChange={e => handleChange(rowIndex, col.key, e.target.value)}
                        placeholder={col.label}
                        className="w-full bg-transparent text-gray-200 px-2 py-1.5 rounded-lg border border-transparent focus:border-white/20 focus:outline-none transition-colors placeholder:text-gray-600"
                      />
                    )}
                  </td>
                ))}
                {!submitted && (
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!submitted && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Plus size={14} />
            添加行
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Check size={14} />
            {submitLabel}
          </button>
        </div>
      )}
      {submitted && (
        <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-2 text-xs text-green-400">
          <Check size={14} />
          已提交
        </div>
      )}
    </div>
  );
}
