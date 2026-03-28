import { StrictMode, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { motion } from 'motion/react'
import { SessionWindow } from './components/SessionWindow'
import { GitProvider } from './contexts/GitProvider'
import { Session } from './types'
import './index.css'

const SPRING_EXPAND = { type: 'spring' as const, stiffness: 400, damping: 35, mass: 0.8 }

function ChatPopupApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const params = new URLSearchParams(window.location.search)
  const initialSessionId = params.get('sessionId')

  const syncMessages = (s: Session) => {
    window.aiBackend.chatPopup.syncMessages(s.id, s.messages)
  }

  const loadSession = (sessionId: string) => {
    setSession(null)
    setError(null)
    window.aiBackend.chatPopup.getSession(sessionId)
      .then((data: Session | null) => {
        if (data) {
          setSession(data)
        } else {
          setError('Session not found')
        }
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load session')
      })
  }

  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId)
    }
  }, [initialSessionId])

  // Listen for session switch (when popup is reused for a different session)
  useEffect(() => {
    const cleanup = window.aiBackend.chatPopup.onSwitchSession((newId: string) => {
      loadSession(newId)
    })
    return cleanup
  }, [])

  const pillLabel = session?.title || (error ? 'Error' : 'Chat')

  // Build content for the expanded card
  let content: React.ReactNode
  if (error) {
    content = (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="mb-4">{error}</p>
          <button
            onClick={() => window.aiBackend.chatPopup.close()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  } else if (!session) {
    content = (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    )
  } else {
    content = (
      <GitProvider projectDir={null}>
        <SessionWindow
          session={session}
          variant="popup"
          onUpdate={(s) => {
            sessionRef.current = s
            const prevStatus = prevStatusRef.current
            prevStatusRef.current = s.status
            setSession(s)

            // Always sync metadata
            window.aiBackend.chatPopup.syncMetadata({
              id: s.id,
              title: s.title,
              status: s.status,
              claudeSessionId: s.claudeSessionId,
              codexThreadId: s.codexThreadId,
            })

            // Sync messages on status change immediately
            if (s.status !== prevStatus) {
              syncMessages(s)
              if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
              syncTimerRef.current = null
            } else if (s.status === 'inprocess') {
              // During streaming, debounce 3s
              if (!syncTimerRef.current) {
                syncTimerRef.current = setTimeout(() => {
                  syncTimerRef.current = null
                  if (sessionRef.current) syncMessages(sessionRef.current)
                }, 3000)
              }
            }
          }}
          onClose={() => {
            if (sessionRef.current) syncMessages(sessionRef.current)
            window.aiBackend.chatPopup.close()
          }}
        />
      </GitProvider>
    )
  }

  return (
    <div className="h-full w-full p-4 flex justify-center items-start">
      {/* Morphing container: pill → full card */}
      <motion.div
        className="overflow-hidden border border-white/10 shadow-2xl bg-[#1E1814] relative"
        initial={{ width: 300, height: 56, borderRadius: 28 }}
        animate={{ width: 600, height: 900, borderRadius: 32 }}
        transition={SPRING_EXPAND}
        style={{ willChange: 'width, height' }}
      >
        {/* Pill content — fades out during expansion */}
        <motion.div
          className="absolute inset-0 flex items-center gap-3 px-5 z-10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ pointerEvents: 'none' }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-breathe" />
          <span className="text-white text-sm font-medium truncate">{pillLabel}</span>
        </motion.div>

        {/* Expanded content — fades in with upward float */}
        <motion.div
          className="w-full h-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {content}
        </motion.div>
      </motion.div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChatPopupApp />
  </StrictMode>
)
