import { motion } from 'motion/react'
import { Check, X, Loader2 } from 'lucide-react'
import type { IslandSession } from '@/types'

interface TaskCardProps {
  session: IslandSession
  index: number
  onOpenChat: (sessionId: string) => void
  onCancel: (sessionId: string) => void
  onDismiss: (sessionId: string) => void
}

export function TaskCard({ session, index, onOpenChat, onCancel, onDismiss }: TaskCardProps) {
  const isDone = session.status === 'done' || session.status === 'review'
  const isActive = session.status === 'inprocess'

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="w-[240px] flex-shrink-0 relative rounded-[16px] flex flex-col justify-between"
      style={{
        background: isDone
          ? 'linear-gradient(160deg, #1a4a1a 0%, #0d2a0d 100%)'
          : 'rgba(255,255,255,0.08)',
        border: isDone
          ? '1px solid rgba(74, 222, 128, 0.15)'
          : '1px solid rgba(255,255,255,0.08)',
        padding: '10px 12px 8px',
        height: '100%',
      }}
    >
      {/* Close button */}
      <button
        onClick={() => onDismiss(session.id)}
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
        style={{ background: isDone ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.15)' }}
      >
        <X size={10} color={isDone ? '#4ade80' : '#888'} />
      </button>

      {/* Top section: icon + title + subtitle */}
      <div>
        {/* Status icon + title */}
        <div className="flex items-center gap-1.5 mb-0.5">
          {isDone ? (
            <div className="w-[18px] h-[18px] rounded-full bg-[#4ade80] flex items-center justify-center shrink-0">
              <Check size={11} color="#000" strokeWidth={3} />
            </div>
          ) : isActive ? (
            <Loader2 size={16} color="#999" className="animate-spin shrink-0" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[#666] shrink-0 ml-1.5 mr-0.5" />
          )}
          <span className="text-[12px] font-bold text-white truncate max-w-[170px]">
            {session.title}
          </span>
        </div>

        {/* Subtitle / last message */}
        <div
          className="text-[10px] truncate mt-0.5"
          style={{
            color: isDone ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)',
            paddingLeft: isDone || isActive ? '26px' : '18px',
          }}
        >
          {session.lastMessage || (isDone ? 'Task has been completed' : isActive ? 'In progress...' : '')}
        </div>
      </div>

      {/* Bottom: action buttons */}
      <div className="flex gap-2 mt-auto pt-1">
        {isActive && (
          <button
            onClick={() => onCancel(session.id)}
            className="text-[10px] text-white/80 font-semibold px-3 py-1 rounded-[10px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => onOpenChat(session.id)}
          className="text-[10px] text-white font-semibold px-3 py-1 rounded-[10px] cursor-pointer"
          style={{
            background: isDone ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.12)',
          }}
        >
          Open in chat
        </button>
      </div>
    </motion.div>
  )
}
