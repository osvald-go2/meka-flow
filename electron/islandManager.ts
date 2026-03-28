import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import { getIslandPort } from './islandServer'

let islandProcess: ChildProcess | null = null

function broadcastStatus(running: boolean): void {
  BrowserWindow.getAllWindows().forEach(win => {
    try {
      if (!win.isDestroyed()) {
        win.webContents.send('island:status-changed', running)
      }
    } catch {
      // Window or webContents disposed during shutdown — ignore
    }
  })
}

export function spawnIsland(): void {
  if (islandProcess) return

  const islandMain = app.isPackaged
    ? path.join(process.resourcesPath, 'dynamic-island/out/main/index.js')
    : path.join(__dirname, '../../dynamic-island/out/main/index.js')

  if (!fs.existsSync(islandMain)) {
    console.warn('[islandManager] Island entry not found, skipping:', islandMain)
    broadcastStatus(false)
    return
  }

  islandProcess = spawn(process.execPath, [islandMain], {
    stdio: 'ignore',
    detached: false,
    env: {
      ...process.env,
      // Mark this process as the Island subprocess so main.ts skips app init
      MEKA_IS_ISLAND: '1',
      // Strip secrets and main app's dev server URL so Island loads its own renderer
      ANTHROPIC_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      ELECTRON_RENDERER_URL: undefined,
      // Pass the actual WS port (may differ from default if port was busy)
      ISLAND_WS_PORT: String(getIslandPort()),
    } as NodeJS.ProcessEnv
  })

  islandProcess.on('exit', () => {
    islandProcess = null
    broadcastStatus(false)
  })

  islandProcess.on('error', (err) => {
    console.error('[islandManager] spawn error:', err)
    islandProcess = null
    broadcastStatus(false)
  })

  broadcastStatus(true)
}

export function killIsland(): void {
  if (!islandProcess) return
  const proc = islandProcess
  proc.kill('SIGTERM')

  // If SIGTERM doesn't work within 2s, force kill
  const forceKillTimer = setTimeout(() => {
    try {
      if (proc.pid && !proc.killed) {
        process.kill(proc.pid, 'SIGKILL')
      }
    } catch {
      // already dead — ignore
    }
  }, 2000)

  proc.on('exit', () => {
    clearTimeout(forceKillTimer)
  })
}

export function isIslandRunning(): boolean {
  return islandProcess !== null
}
