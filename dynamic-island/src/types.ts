// ─── Session Status (matches AI Studio) ───
export type SessionStatus = 'inbox' | 'inprocess' | 'review' | 'done'

// ─── Island-specific types ───
export interface IslandSession {
  id: string
  title: string
  model: string
  status: SessionStatus
  lastMessage?: string
  messageCount: number
}

export interface TaskStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  detail?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

// ─── WebSocket Message Types ───

// AI Studio → Island
export type ServerMessage =
  | { type: 'sessions:sync'; sessions: IslandSession[] }
  | { type: 'session:update'; sessionId: string; status: SessionStatus; title?: string; lastMessage?: string }
  | { type: 'session:delete'; sessionId: string }
  | { type: 'message:new'; sessionId: string; message: Message }
  | { type: 'message:stream'; sessionId: string; messageId: string; chunk: string; done: boolean }
  | { type: 'task:progress'; sessionId: string; steps: TaskStep[] }
  | { type: 'notification'; sessionId: string; level: 'success' | 'error' | 'info'; text: string }
  | { type: 'messages:history'; sessionId: string; messages: Message[] }
  | { type: 'error'; requestType: string; sessionId: string; message: string }

// Island → AI Studio
export type ClientMessage =
  | { type: 'message:send'; sessionId: string; content: string }
  | { type: 'session:cancel'; sessionId: string }
  | { type: 'notification:dismiss'; sessionId: string }
  | { type: 'messages:fetch'; sessionId: string }
  | { type: 'chat:open'; sessionId: string }
  | { type: 'chat:close' }

// ─── Notch State Machine ───
export type NotchState = 'capsule' | 'cards' | 'chat'

// ─── Notification for cards ───
export interface IslandNotification {
  sessionId: string
  level: 'success' | 'error' | 'info'
  text: string
  timestamp: number
}

// ─── Preload API (window.island) ───
// on* methods return cleanup functions for useEffect teardown
export interface IslandAPI {
  onStateChange: (callback: (state: string) => void) => () => void
  notifyMouseEnter: () => void
  notifyMouseLeave: () => void
  onWsMessage: (callback: (data: any) => void) => () => void
  wsSend: (message: any) => void
  onConnectionStatus: (callback: (connected: boolean) => void) => () => void
  requestSync: () => void
}

declare global {
  interface Window {
    island: IslandAPI
  }
}
