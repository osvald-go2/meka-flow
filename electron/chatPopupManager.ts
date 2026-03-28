import { BrowserWindow, screen } from 'electron'
import path from 'path'

let chatPopupWindow: BrowserWindow | null = null

export function createChatPopupWindow(sessionId: string): void {
  if (chatPopupWindow && !chatPopupWindow.isDestroyed()) {
    chatPopupWindow.webContents.send('chat-popup:switch-session', sessionId)
    chatPopupWindow.show()
    chatPopupWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const displayBounds = primaryDisplay.bounds
  const workArea = primaryDisplay.workArea
  const winW = 632
  const winH = 932
  const x = displayBounds.x + Math.round((displayBounds.width - winW) / 2)
  const y = workArea.y + Math.round((workArea.height - winH) / 2)

  chatPopupWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
    show: false,
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    chatPopupWindow.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/chat-popup.html?sessionId=${sessionId}`
    )
  } else {
    chatPopupWindow.loadFile(
      path.join(__dirname, '../renderer/chat-popup.html'),
      { query: { sessionId } }
    )
  }

  chatPopupWindow.once('ready-to-show', () => chatPopupWindow?.show())

  chatPopupWindow.on('closed', () => {
    chatPopupWindow = null
  })
}

export function hideChatPopup(): void {
  chatPopupWindow?.hide()
}

export function destroyChatPopup(): void {
  if (chatPopupWindow && !chatPopupWindow.isDestroyed()) {
    chatPopupWindow.destroy()
    chatPopupWindow = null
  }
}
