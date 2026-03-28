interface AiBackend {
  invoke(method: string, params?: any): Promise<any>;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: (data: any) => void): void;
  onAll(callback: (event: string, data: any) => void): void;
  getWorkingDir(): Promise<string>;
  openDirectory(): Promise<string | null>;
  getLastProjectDir(): Promise<string | null>;
  scanSkills(platform: string, projectDir: string): Promise<any>;

  // Island integration
  notifyIsland(event: string, data: any): void;
  onIslandMessage(callback: (data: { sessionId: string; content: string }) => void): void;
  onIslandCancel(callback: (data: { sessionId: string }) => void): void;
  onIslandFetchMessages(callback: (data: { sessionId: string }) => void): void;
  onIslandRequestSessions(callback: () => void): void;
  sendIslandSessionsResponse(sessions: any[]): void;
  sendIslandMessagesHistory(sessionId: string, messages: any[]): void;
  emitSessionUpdate(data: { sessionId: string; status: string; title?: string; model?: string; lastMessage?: string }): void;
  emitMessageStream(data: { sessionId: string; messageId: string; chunk: string; done: boolean }): void;
  emitNotification(data: { sessionId: string; level: 'success' | 'error' | 'info'; text: string }): void;
  emitSessionDeleted(sessionId: string): void;

  // Island Toggle
  island: {
    toggle(enabled: boolean): Promise<void>;
    getStatus(): Promise<boolean>;
    onStatusChanged(callback: (running: boolean) => void): () => void;
  };

  // Chat Popup
  chatPopup: {
    getSession(sessionId: string): Promise<any>;
    close(): Promise<void>;
    syncMetadata(metadata: { id: string; title: string; status: string; claudeSessionId?: string; codexThreadId?: string }): void;
    syncMessages(sessionId: string, messages: any[]): void;
    onSwitchSession(cb: (sessionId: string) => void): () => void;
  };

  // Scoped IPC (chat-popup: prefix only)
  ipcOn(channel: string, callback: (...args: any[]) => void): void;
  ipcOff(channel: string, callback: (...args: any[]) => void): void;
  ipcSend(channel: string, ...args: any[]): void;

  // Harness file I/O
  harness: {
    writeFile: (filePath: string, content: string) => Promise<void>;
    readFile: (filePath: string) => Promise<string>;
    mkdir: (dirPath: string) => Promise<void>;
  };
}

interface Window {
  aiBackend: AiBackend;
}
