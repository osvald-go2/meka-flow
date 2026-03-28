import { ContentBlock, DbHarnessGroup, DbProject, DbSession } from '../types';

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.aiBackend !== undefined;
}

export const backend = {
  async createSession(model: string, opts?: { claudeSessionId?: string; codexThreadId?: string }): Promise<string> {
    if (!isElectron()) {
      return `mock-${Date.now()}`;
    }
    const result = await window.aiBackend.invoke('session.create', {
      model,
      claude_session_id: opts?.claudeSessionId,
      codex_thread_id: opts?.codexThreadId,
    });
    return result.session_id;
  },

  async sendMessage(sessionId: string, text: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.send', {
      session_id: sessionId,
      text,
    });
  },

  async listSessions(): Promise<any[]> {
    if (!isElectron()) return [];
    const result = await window.aiBackend.invoke('session.list');
    return result.sessions;
  },

  async killSession(sessionId: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.kill', {
      session_id: sessionId,
    });
  },

  async interruptSession(sessionId: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.interrupt', {
      session_id: sessionId,
    });
  },

  async switchModel(sessionId: string, model: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.switch_model', {
      session_id: sessionId,
      model,
    });
  },

  async setApiKey(apiKey: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('config.set_api_key', {
      api_key: apiKey,
    });
  },

  async ping(): Promise<boolean> {
    if (!isElectron()) return true;
    try {
      await window.aiBackend.invoke('ping');
      return true;
    } catch {
      return false;
    }
  },

  onBlockStart(callback: (data: { session_id: string; block_index: number; block: ContentBlock }) => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('block.start', callback);
  },

  onBlockDelta(callback: (data: { session_id: string; block_index: number; delta: any }) => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('block.delta', callback);
  },

  onBlockStop(callback: (data: { session_id: string; block_index: number; status?: 'done' | 'error' }) => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('block.stop', callback);
  },

  onMessageComplete(callback: (data: { session_id: string; usage?: any }) => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('message.complete', callback);
  },

  onMessageError(callback: (data: { session_id: string; error: { code: number; message: string } }) => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('message.error', callback);
  },

  onSessionInit(callback: (data: { session_id: string; claude_session_id?: string; codex_thread_id?: string; agent?: string }) => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('session.init', callback);
  },

  onSidecarRestarted(callback: () => void): void {
    if (!isElectron()) return;
    window.aiBackend.on('sidecar.restarted', callback);
  },

  // Project methods
  async openProject(path: string): Promise<DbProject | null> {
    if (!isElectron()) return null;
    return await window.aiBackend.invoke('project.open', { path });
  },

  async listProjects(): Promise<DbProject[]> {
    if (!isElectron()) return [];
    const result = await window.aiBackend.invoke('project.list', {});
    return result.projects;
  },

  async updateProject(project: DbProject): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('project.update', project);
  },

  async deleteProject(id: number): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('project.delete', { id });
  },

  // Session persistence methods
  async saveSession(session: DbSession): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.save', session);
  },

  async loadSessions(projectId: number): Promise<DbSession[]> {
    if (!isElectron()) return [];
    const result = await window.aiBackend.invoke('session.load', { project_id: projectId });
    return result.sessions;
  },

  async persistDeleteSession(sessionId: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.delete', { session_id: sessionId });
  },

  async updateMessages(sessionId: string, messages: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.update_messages', { session_id: sessionId, messages });
  },

  async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.update_status', { session_id: sessionId, status });
  },

  async updateSessionPosition(sessionId: string, x: number, y: number, height?: number): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('session.update_position', { session_id: sessionId, x, y, height });
  },

  // Harness group persistence methods
  async saveHarnessGroup(group: DbHarnessGroup): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('harness.save', group);
  },

  async loadHarnessGroups(projectId: number): Promise<DbHarnessGroup[]> {
    if (!isElectron()) return [];
    const result = await window.aiBackend.invoke('harness.load', { project_id: projectId });
    return result.groups;
  },

  async deleteHarnessGroup(groupId: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('harness.delete', { group_id: groupId });
  },

  // Settings methods
  async getSetting(key: string): Promise<string | null> {
    if (!isElectron()) return null;
    const result = await window.aiBackend.invoke('settings.get', { key });
    return result.value;
  },

  async setSetting(key: string, value: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('settings.set', { key, value });
  },

  async deleteSetting(key: string): Promise<void> {
    if (!isElectron()) return;
    await window.aiBackend.invoke('settings.delete', { key });
  },

  async listSettings(prefix: string): Promise<Record<string, string>> {
    if (!isElectron()) return {};
    const result = await window.aiBackend.invoke('settings.list', { prefix });
    return result.settings;
  },
};
