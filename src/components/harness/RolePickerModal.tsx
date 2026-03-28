import { useState } from 'react';
import { X } from 'lucide-react';
import type { HarnessRole } from '../../types';

interface RolePickerModalProps {
  fromSessionTitle: string;
  toSessionTitle: string;
  onConfirm: (fromRole: HarnessRole, toRole: HarnessRole, groupName: string) => void;
  onCancel: () => void;
  existingGroupNames: string[];
}

const ROLE_OPTIONS: { value: HarnessRole; label: string; description: string }[] = [
  { value: 'planner', label: 'Planner', description: 'Creates plans and delegates tasks' },
  { value: 'generator', label: 'Generator', description: 'Implements features based on plans' },
  { value: 'evaluator', label: 'Evaluator', description: 'Reviews and grades implementations' },
];

export function RolePickerModal({
  fromSessionTitle,
  toSessionTitle,
  onConfirm,
  onCancel,
  existingGroupNames,
}: RolePickerModalProps) {
  const [fromRole, setFromRole] = useState<HarnessRole>('planner');
  const [toRole, setToRole] = useState<HarnessRole>('generator');
  // Default to first existing group if available
  const [groupName, setGroupName] = useState(existingGroupNames[0] || '');

  const handleConfirm = () => {
    const name = groupName.trim() || `harness-${Date.now().toString(36)}`;
    onConfirm(fromRole, toRole, name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[420px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-100">Create Connection</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {/* Group selection: dropdown for existing, input for new */}
        <div className="mb-4">
          {existingGroupNames.length > 0 ? (
            <>
              <label className="block text-xs text-zinc-400 mb-1">Group</label>
              <select
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                {existingGroupNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value="">+ New group</option>
              </select>
              {groupName === '' && (
                <input
                  type="text"
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="New group name"
                  className="w-full mt-2 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              )}
            </>
          ) : (
            <>
              <label className="block text-xs text-zinc-400 mb-1">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. feature-login"
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </>
          )}
        </div>

        <div className="mb-3">
          <label className="block text-xs text-zinc-400 mb-1">
            {fromSessionTitle} <span className="text-zinc-500">role</span>
          </label>
          <div className="flex gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFromRole(opt.value)}
                className={`flex-1 px-3 py-2 rounded text-xs font-medium border transition-colors ${
                  fromRole === opt.value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-zinc-500 text-xs my-2">↓</div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1">
            {toSessionTitle} <span className="text-zinc-500">role</span>
          </label>
          <div className="flex gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setToRole(opt.value)}
                className={`flex-1 px-3 py-2 rounded text-xs font-medium border transition-colors ${
                  toRole === opt.value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-500"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
