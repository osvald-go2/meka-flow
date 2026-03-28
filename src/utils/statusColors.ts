import type { SessionStatus } from '../types';

export function getStatusDotClass(status: SessionStatus, isStreaming = false): string {
  if (status === 'inprocess' && isStreaming) {
    return 'bg-blue-400 animate-breathe';
  }
  switch (status) {
    case 'inbox': return 'bg-gray-400';
    case 'inprocess': return 'bg-blue-400';
    case 'review': return 'bg-amber-400';
    case 'done': return 'bg-emerald-400';
  }
}

export const STATUS_COLORS: Record<SessionStatus, { badgeBg: string; badgeText: string }> = {
  inbox:     { badgeBg: 'bg-gray-500/20', badgeText: 'text-gray-400' },
  inprocess: { badgeBg: 'bg-blue-500/20', badgeText: 'text-blue-400' },
  review:    { badgeBg: 'bg-amber-500/20', badgeText: 'text-amber-400' },
  done:      { badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-400' },
};
