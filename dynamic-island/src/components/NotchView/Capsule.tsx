import { Loader2 } from 'lucide-react'

interface CapsuleProps {
  connected: boolean
  sessionCount: number
  hasActiveTask: boolean
}

export function Capsule({ connected, sessionCount, hasActiveTask }: CapsuleProps) {
  return (
    <>
      {/* Left: spinner or status dot */}
      <div className="flex items-center justify-center w-5 h-5">
        {hasActiveTask ? (
          <Loader2
            size={14}
            color="#60a5fa"
            className="animate-spin"
          />
        ) : (
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: connected ? '#4ade80' : '#666',
              boxShadow: connected ? '0 0 6px rgba(74, 222, 128, 0.5)' : 'none',
            }}
          />
        )}
      </div>

      {/* Center: blue ring indicator */}
      <div className="flex items-center justify-center">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            border: '2px solid rgba(96, 165, 250, 0.6)',
            boxShadow: '0 0 8px rgba(96, 165, 250, 0.3)',
          }}
        />
      </div>

      {/* Right: session count */}
      <div className="flex items-center justify-center">
        <span
          className="text-[12px] font-bold tabular-nums"
          style={{ color: 'rgba(255, 255, 255, 0.8)' }}
        >
          {sessionCount}
        </span>
      </div>
    </>
  )
}
