import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  IslandSession,
  TaskStep,
  Message,
  IslandNotification,
  NotchState,
  ServerMessage
} from '@/types'

interface IslandState {
  sessions: IslandSession[]
  notifications: IslandNotification[]
  messages: Record<string, Message[]>        // sessionId → messages
  streamingText: Record<string, string>      // sessionId → accumulated text
  taskSteps: Record<string, TaskStep[]>      // sessionId → steps
  connected: boolean
  notchState: NotchState
}

export function useIslandStore() {
  const [state, setState] = useState<IslandState>({
    sessions: [],
    notifications: [],
    messages: {},
    streamingText: {},
    taskSteps: {},
    connected: false,
    notchState: 'capsule'
  })

  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const handleWsMessage = (data: ServerMessage) => {
      switch (data.type) {
        case 'sessions:sync':
          setState(s => ({ ...s, sessions: data.sessions }))
          break

        case 'session:update':
          setState(s => ({
            ...s,
            sessions: s.sessions.map(ses =>
              ses.id === data.sessionId
                ? {
                    ...ses,
                    status: data.status,
                    title: data.title ?? ses.title,
                    lastMessage: data.lastMessage ?? ses.lastMessage
                  }
                : ses
            )
          }))
          break

        case 'session:delete':
          setState(s => {
            const { [data.sessionId]: _msgs, ...restMessages } = s.messages
            const { [data.sessionId]: _str, ...restStreaming } = s.streamingText
            const { [data.sessionId]: _steps, ...restSteps } = s.taskSteps
            return {
              ...s,
              sessions: s.sessions.filter(ses => ses.id !== data.sessionId),
              messages: restMessages,
              streamingText: restStreaming,
              taskSteps: restSteps,
              notifications: s.notifications.filter(n => n.sessionId !== data.sessionId)
            }
          })
          break

        case 'message:new':
          setState(s => ({
            ...s,
            messages: {
              ...s.messages,
              [data.sessionId]: [
                ...(s.messages[data.sessionId] || []),
                data.message
              ]
            }
          }))
          break

        case 'message:stream': {
          // Key streaming text by sessionId so ChatPanel can look up by active session
          const sid = data.sessionId
          setState(s => {
            if (data.done) {
              // Use chunk as authoritative final content when provided,
              // otherwise fall back to accumulated streaming text.
              const finalContent = data.chunk || s.streamingText[sid] || ''
              const msg: Message = {
                id: data.messageId,
                role: 'assistant',
                content: finalContent,
                timestamp: Date.now()
              }
              const { [sid]: _, ...restStreaming } = s.streamingText
              return {
                ...s,
                streamingText: restStreaming,
                messages: {
                  ...s.messages,
                  [sid]: [...(s.messages[sid] || []), msg]
                }
              }
            }
            const prev = s.streamingText[sid] || ''
            return {
              ...s,
              streamingText: { ...s.streamingText, [sid]: prev + data.chunk }
            }
          })
          break
        }

        case 'task:progress':
          setState(s => ({
            ...s,
            taskSteps: { ...s.taskSteps, [data.sessionId]: data.steps }
          }))
          break

        case 'notification':
          setState(s => ({
            ...s,
            notifications: [
              ...s.notifications,
              {
                sessionId: data.sessionId,
                level: data.level,
                text: data.text,
                timestamp: Date.now()
              }
            ]
          }))
          break

        case 'messages:history':
          setState(s => ({
            ...s,
            messages: { ...s.messages, [data.sessionId]: data.messages }
          }))
          break

        case 'error':
          setState(s => ({
            ...s,
            sessions: s.sessions.filter(ses => ses.id !== data.sessionId)
          }))
          break
      }
    }

    const handleConnectionStatus = (connected: boolean) => {
      setState(s => ({ ...s, connected }))
    }

    const handleStateChange = (notchState: string) => {
      setState(s => ({ ...s, notchState: notchState as NotchState }))
    }

    const cleanupWs = window.island.onWsMessage(handleWsMessage)
    const cleanupConn = window.island.onConnectionStatus(handleConnectionStatus)
    const cleanupState = window.island.onStateChange(handleStateChange)

    // Request current sessions now that handlers are registered.
    // Goes via IPC to main process which replays cached data or fetches from server.
    window.island.requestSync()

    return () => {
      cleanupWs()
      cleanupConn()
      cleanupState()
    }
  }, [])

  const sendMessage = useCallback((sessionId: string, content: string) => {
    // Optimistic update: add user message locally immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    }
    setState(s => ({
      ...s,
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), userMsg]
      }
    }))
    // Send to AI Studio via WebSocket
    window.island.wsSend({ type: 'message:send', sessionId, content })
  }, [])

  const cancelSession = useCallback((sessionId: string) => {
    window.island.wsSend({ type: 'session:cancel', sessionId })
  }, [])

  const dismissNotification = useCallback((sessionId: string) => {
    window.island.wsSend({ type: 'notification:dismiss', sessionId })
    setState(s => ({
      ...s,
      notifications: s.notifications.filter(n => n.sessionId !== sessionId)
    }))
  }, [])

  const fetchMessages = useCallback((sessionId: string) => {
    window.island.wsSend({ type: 'messages:fetch', sessionId })
  }, [])

  const openChat = useCallback((sessionId: string) => {
    window.island.wsSend({ type: 'chat:open', sessionId })
  }, [])

  const closeChat = useCallback(() => {
    window.island.wsSend({ type: 'chat:close' })
  }, [])

  return {
    ...state,
    sendMessage,
    cancelSession,
    dismissNotification,
    fetchMessages,
    openChat,
    closeChat
  }
}
