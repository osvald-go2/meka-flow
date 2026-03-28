import { app, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { hasHardwareNotch } from './notchDetector'
import { WindowManager } from './windowManager'
import { WsClient } from './wsClient'

let windowManager: WindowManager | null = null
let wsClient: WsClient | null = null
let lastSessionsSync: any = null

app.dock?.hide()

// Ensure clean exit when parent sends SIGTERM
process.on('SIGTERM', () => {
  app.quit()
})

app.whenReady().then(() => {
  console.log('[Island] App ready, checking hardware...')

  // Check hardware compatibility
  const notchSupported = hasHardwareNotch()
  console.log('[Island] Hardware notch supported:', notchSupported)

  if (!notchSupported) {
    dialog.showErrorBox(
      'Not Supported',
      'Dynamic Island requires a MacBook with a hardware notch (M1 Pro/Max or later).'
    )
    app.quit()
    return
  }

  const preloadPath = join(__dirname, '../preload/index.js')
  console.log('[Island] Preload path:', preloadPath)

  // Create windows
  windowManager = new WindowManager(preloadPath)
  windowManager.createWindows()

  if (process.env.ELECTRON_RENDERER_URL) {
    const baseURL = process.env.ELECTRON_RENDERER_URL
    const notchURL = `${baseURL}/resources/notch.html`
    console.log('[Island] Loading dev URL:', notchURL)
    windowManager.loadPages(notchURL)
  } else {
    const notchPath = join(__dirname, '../renderer/resources/notch.html')
    console.log('[Island] Loading file:', notchPath)
    windowManager.loadFiles(notchPath)
  }

  // Connect to AI Studio
  wsClient = new WsClient()

  wsClient.on('connected', () => {
    windowManager?.setConnectionStatus(true)
  })

  wsClient.on('disconnected', () => {
    windowManager?.setConnectionStatus(false)
  })

  wsClient.on('message', (data: any) => {
    // Cache sessions:sync so we can replay it when renderer mounts
    if (data.type === 'sessions:sync') {
      lastSessionsSync = data
    }

    windowManager?.broadcastToRenderers(data)

    // Auto-expand on notification
    if (data.type === 'notification') {
      windowManager?.expandForNotification()
    }
  })

  // Forward renderer WS sends to server
  ipcMain.on('ws:send', (_e, message) => {
    wsClient?.send(message)
  })

  // Renderer mounted and ready — replay cached sessions or request from server
  ipcMain.on('island:renderer-ready', () => {
    if (lastSessionsSync) {
      windowManager?.broadcastToRenderers(lastSessionsSync)
    } else if (wsClient?.connected) {
      wsClient.send({ type: 'sessions:fetch' })
    }
  })

  wsClient.connect()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  wsClient?.close()
  windowManager?.destroy()
})
