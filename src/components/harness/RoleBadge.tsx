import type { HarnessRole } from '../../types';

const BADGE_CONFIG: Record<HarnessRole, { label: string; bg: string; text: string }> = {
  planner:   { label: 'P', bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  generator: { label: 'G', bg: 'bg-green-500/20',  text: 'text-green-400' },
  evaluator: { label: 'E', bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

interface RoleBadgeProps {
  role: HarnessRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = BADGE_CONFIG[role];
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${config.bg} ${config.text}`}
      title={role.charAt(0).toUpperCase() + role.slice(1)}
    >
      {config.label}
    </span>
  );
}
