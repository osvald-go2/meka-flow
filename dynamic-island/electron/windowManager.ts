import { BrowserWindow, screen, ipcMain } from 'electron'
import { getInternalDisplay, getNotchHeight } from './notchDetector'

type NotchState = 'capsule' | 'cards'

const NOTCH_WIDTH = 600
const NOTCH_HEIGHT = 140
const HOVER_POLL_INTERVAL = 100
const HOVER_TRIGGER_WIDTH = 400
const HOVER_TRIGGER_HEIGHT = 80
const COLLAPSE_DELAY = 500

export class WindowManager {
  private notchWindow: BrowserWindow | null = null
  private notchState: NotchState = 'capsule'
  private hoverPollTimer: ReturnType<typeof setInterval> | null = null
  private collapseTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private preloadPath: string) {}

  createWindows(): void {
    const display = getInternalDisplay()
    if (!display) return

    const notchHeight = getNotchHeight(display)
    const centerX = display.bounds.x + Math.round((display.bounds.width - NOTCH_WIDTH) / 2)

    // Notch Window
    this.notchWindow = new BrowserWindow({
      width: NOTCH_WIDTH,
      height: NOTCH_HEIGHT,
      x: centerX,
      y: display.bounds.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      skipTaskbar: true,
      hiddenInMissionControl: true,
      fullscreenable: false,
      type: 'panel',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.notchWindow.setIgnoreMouseEvents(true)
    this.notchWindow.showInactive()

    this.setupIPC()
    this.startHoverPolling()
  }

  private setupIPC(): void {
    ipcMain.on('notch:mouse-enter', () => {
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer)
        this.collapseTimer = null
      }
    })

    ipcMain.on('notch:mouse-leave', () => {
      if (this.notchState === 'cards') {
        this.collapseTimer = setTimeout(() => {
          this.transitionTo('capsule')
        }, COLLAPSE_DELAY)
      }
    })

  }

  private startHoverPolling(): void {
    if (this.hoverPollTimer) return

    let logCount = 0
    this.hoverPollTimer = setInterval(() => {
      if (this.notchState !== 'capsule') return

      const cursor = screen.getCursorScreenPoint()
      const display = getInternalDisplay()
      if (!display) {
        if (logCount === 0) console.log('[Hover] No internal display found!')
        logCount++
        return
      }

      const centerX = display.bounds.x + display.bounds.width / 2
      const triggerLeft = centerX - HOVER_TRIGGER_WIDTH / 2
      const triggerRight = centerX + HOVER_TRIGGER_WIDTH / 2
      const triggerBottom = display.bounds.y + HOVER_TRIGGER_HEIGHT

      // Log once every 5 seconds for debugging
      if (logCount % 50 === 0) {
        console.log(`[Hover] cursor: (${cursor.x}, ${cursor.y}) trigger: x[${triggerLeft}-${triggerRight}] y[${display.bounds.y}-${triggerBottom}]`)
      }
      logCount++

      if (
        cursor.x >= triggerLeft &&
        cursor.x <= triggerRight &&
        cursor.y >= display.bounds.y &&
        cursor.y <= triggerBottom
      ) {
        console.log('[Hover] TRIGGERED! Switching to cards')
        this.transitionTo('cards')
      }
    }, HOVER_POLL_INTERVAL)
  }

  private stopHoverPolling(): void {
    if (this.hoverPollTimer) {
      clearInterval(this.hoverPollTimer)
      this.hoverPollTimer = null
    }
  }

  private transitionTo(state: NotchState): void {
    this.notchState = state

    if (state === 'cards') {
      this.stopHoverPolling()
      if (this.notchWindow && !this.notchWindow.isDestroyed()) {
        this.notchWindow.setIgnoreMouseEvents(false)
        this.notchWindow.setFocusable(true)
        this.notchWindow.focus()
      }
      this.safeSend(this.notchWindow, 'notch:state-change', 'cards')
    } else if (state === 'capsule') {
      if (this.notchWindow && !this.notchWindow.isDestroyed()) {
        this.notchWindow.setIgnoreMouseEvents(true)
        this.notchWindow.setFocusable(false)
      }
      this.safeSend(this.notchWindow, 'notch:state-change', 'capsule')
      this.startHoverPolling()
    }
  }

  /** Called when a new notification arrives — auto-expand from capsule */
  expandForNotification(): void {
    if (this.notchState === 'capsule') {
      this.transitionTo('cards')
      // Auto-collapse after 4 seconds if not interacted with
      setTimeout(() => {
        if (this.notchState === 'cards') {
          this.transitionTo('capsule')
        }
      }, 4000)
    }
  }

  private safeSend(win: BrowserWindow | null, channel: string, ...args: any[]): void {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  broadcastToRenderers(data: any): void {
    this.safeSend(this.notchWindow, 'ws:message', data)
  }

  setConnectionStatus(connected: boolean): void {
    this.safeSend(this.notchWindow, 'ws:connection-status', connected)
  }

  loadPages(notchURL: string): void {
    this.notchWindow?.loadURL(notchURL)
  }

  loadFiles(notchPath: string): void {
    this.notchWindow?.loadFile(notchPath)
  }

  destroy(): void {
    this.stopHoverPolling()
    if (this.collapseTimer) clearTimeout(this.collapseTimer)
    this.notchWindow?.destroy()
  }
}
