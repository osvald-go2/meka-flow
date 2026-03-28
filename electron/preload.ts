import { contextBridge, ipcRenderer } from 'electron';

export type EventCallback = (data: any) => void;

contextBridge.exposeInMainWorld('aiBackend', {
  invoke: (method: string, params?: any): Promise<any> => {
    return ipcRenderer.invoke('sidecar:invoke', method, params);
  },

  on: (event: string, callback: EventCallback): void => {
    const handler = (_: any, eventName: string, data: any) => {
      if (eventName === event) {
        callback(data);
      }
    };
    ipcRenderer.on('sidecar:event', handler);
    (callback as any).__handler = handler;
  },

  off: (event: string, callback: EventCallback): void => {
    const handler = (callback as any).__handler;
    if (handler) {
      ipcRenderer.removeListener('sidecar:event', handler);
    }
  },

  onAll: (callback: (event: string, data: any) => void): void => {
    ipcRenderer.on('sidecar:event', (_, eventName, data) => {
      callback(eventName, data);
    });
  },

  toggleMaximize: (): Promise<void> => {
    return ipcRenderer.invoke('window:toggleMaximize');
  },

  startWindowDrag: (screenX: number, screenY: number): void => {
    ipcRenderer.send('window:startDrag', screenX, screenY);
  },

  windowDragging: (screenX: number, screenY: number): void => {
    ipcRenderer.send('window:dragging', screenX, screenY);
  },

  getWorkingDir: (): Promise<string> => {
    return ipcRenderer.invoke('get-working-dir');
  },

  openDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:openDirectory');
  },

  getLastProjectDir: (): Promise<string | null> => {
    return ipcRenderer.invoke('config:getLastProjectDir');
  },

  onFullScreenChange: (callback: (isFullScreen: boolean) => void): void => {
    ipcRenderer.on('window:fullscreen-changed', (_, isFullScreen) => {
      callback(isFullScreen);
    });
  },

  onBeforeQuit: (callback: () => void): void => {
    ipcRenderer.on('app:before-quit', () => callback());
  },

  notifyFlushComplete: (): void => {
    ipcRenderer.send('app:flush-complete');
  },

  scanSkills: (platform: string, projectDir: string): Promise<any> => {
    return ipcRenderer.invoke('scan-skills', platform, projectDir);
  },

  // PTY API
  ptySpawn: (cwd: string): Promise<number> => ipcRenderer.invoke('pty:spawn', cwd),
  ptyWrite: (id: number, data: string): void => { ipcRenderer.send('pty:write', id, data); },
  ptyResize: (id: number, cols: number, rows: number): void => { ipcRenderer.send('pty:resize', id, cols, rows); },
  ptyKill: (id: number): Promise<void> => ipcRenderer.invoke('pty:kill', id),
  onPtyData: (callback: (data: { id: number; data: string }) => void): (() => void) => {
    const handler = (_: any, payload: any) => callback(payload);
    ipcRenderer.on('pty:data', handler);
    return () => ipcRenderer.removeListener('pty:data', handler);
  },
  onPtyExit: (callback: (data: { id: number; code: number }) => void): (() => void) => {
    const handler = (_: any, payload: any) => callback(payload);
    ipcRenderer.on('pty:exit', handler);
    return () => ipcRenderer.removeListener('pty:exit', handler);
  },

  // Island integration
  notifyIsland: (event: string, data: any) => {
    ipcRenderer.send(`island:${event}`, data)
  },
  onIslandMessage: (callback: (data: { sessionId: string; content: string }) => void) => {
    ipcRenderer.on('island:send-message', (_e, data) => callback(data))
  },
  onIslandCancel: (callback: (data: { sessionId: string }) => void) => {
    ipcRenderer.on('island:cancel-session', (_e, data) => callback(data))
  },
  onIslandFetchMessages: (callback: (data: { sessionId: string }) => void) => {
    ipcRenderer.on('island:fetch-messages', (_e, data) => callback(data))
  },
  onIslandRequestSessions: (callback: () => void) => {
    ipcRenderer.on('island:request-sessions', () => callback())
  },
  sendIslandSessionsResponse: (sessions: any[]) => {
    ipcRenderer.send('island:sessions-response', sessions)
  },
  sendIslandMessagesHistory: (sessionId: string, messages: any[]) => {
    ipcRenderer.send('island:messages-history', { sessionId, messages })
  },
  emitSessionUpdate: (data: { sessionId: string; status: string; title?: string; model?: string; lastMessage?: string }) => {
    ipcRenderer.send('island:session-updated', data)
  },
  emitMessageStream: (data: { sessionId: string; messageId: string; chunk: string; done: boolean }) => {
    ipcRenderer.send('island:message-stream', data)
  },
  emitNotification: (data: { sessionId: string; level: 'success' | 'error' | 'info'; text: string }) => {
    ipcRenderer.send('island:notification', data)
  },
  emitSessionDeleted: (sessionId: string) => {
    ipcRenderer.send('island:session-deleted', { sessionId })
  },

  // ── Island Toggle API ──
  island: {
    toggle: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('island:toggle', enabled),
    getStatus: (): Promise<boolean> =>
      ipcRenderer.invoke('island:get-status'),
    onStatusChanged: (callback: (running: boolean) => void): (() => void) => {
      const handler = (_: any, running: boolean) => callback(running)
      ipcRenderer.on('island:status-changed', handler)
      return () => ipcRenderer.removeListener('island:status-changed', handler)
    },
  },

  // ── Chat Popup API ──
  chatPopup: {
    getSession: (sessionId: string): Promise<any> =>
      ipcRenderer.invoke('chat-popup:get-session', { sessionId }),
    close: (): Promise<void> =>
      ipcRenderer.invoke('chat-popup:close'),
    syncMetadata: (metadata: { id: string; title: string; status: string; claudeSessionId?: string; codexThreadId?: string }) =>
      ipcRenderer.send('chat-popup:sync-metadata', metadata),
    syncMessages: (sessionId: string, messages: any[]) =>
      ipcRenderer.send('chat-popup:sync-messages', { sessionId, messages }),
    onSwitchSession: (cb: (sessionId: string) => void) => {
      const handler = (_e: any, sessionId: string) => cb(sessionId)
      ipcRenderer.on('chat-popup:switch-session', handler)
      return () => ipcRenderer.removeListener('chat-popup:switch-session', handler)
    },
  },

  // Harness file I/O
  harness: {
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('harness:write-file', filePath, content),
    readFile: (filePath: string) => ipcRenderer.invoke('harness:read-file', filePath) as Promise<string>,
    mkdir: (dirPath: string) => ipcRenderer.invoke('harness:mkdir', dirPath),
  },

  // Scoped IPC — only allows chat-popup: prefixed channels
  ipcOn: (channel: string, callback: (...args: any[]) => void) => {
    if (!channel.startsWith('chat-popup:')) throw new Error(`ipcOn: channel "${channel}" not allowed`)
    ipcRenderer.on(channel, callback)
  },
  ipcOff: (channel: string, callback: (...args: any[]) => void) => {
    if (!channel.startsWith('chat-popup:')) throw new Error(`ipcOff: channel "${channel}" not allowed`)
    ipcRenderer.removeListener(channel, callback)
  },
  ipcSend: (channel: string, ...args: any[]) => {
    if (!channel.startsWith('chat-popup:')) throw new Error(`ipcSend: channel "${channel}" not allowed`)
    ipcRenderer.send(channel, ...args)
  },
});
