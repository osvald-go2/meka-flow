import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Notch state changes (returns cleanup function)
  onStateChange: (callback: (state: string) => void) => {
    const handler = (_e: any, state: string) => callback(state)
    ipcRenderer.on('notch:state-change', handler)
    return () => ipcRenderer.removeListener('notch:state-change', handler)
  },

  // Mouse events from renderer to main
  notifyMouseEnter: () => ipcRenderer.send('notch:mouse-enter'),
  notifyMouseLeave: () => ipcRenderer.send('notch:mouse-leave'),

  // WebSocket data forwarding (main → renderer, returns cleanup)
  onWsMessage: (callback: (data: any) => void) => {
    const handler = (_e: any, data: any) => callback(data)
    ipcRenderer.on('ws:message', handler)
    return () => ipcRenderer.removeListener('ws:message', handler)
  },

  // WebSocket send (renderer → main → server)
  wsSend: (message: any) => ipcRenderer.send('ws:send', message),

  // Connection status (returns cleanup)
  onConnectionStatus: (callback: (connected: boolean) => void) => {
    const handler = (_e: any, connected: boolean) => callback(connected)
    ipcRenderer.on('ws:connection-status', handler)
    return () => ipcRenderer.removeListener('ws:connection-status', handler)
  },

  // Signal that renderer has mounted and is ready to receive data
  requestSync: () => ipcRenderer.send('island:renderer-ready')
}

contextBridge.exposeInMainWorld('island', api)
