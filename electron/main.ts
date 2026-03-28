import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import Store from 'electron-store';
import * as pty from 'node-pty';
import { SidecarManager } from './sidecar';
import { startIslandServer, stopIslandServer } from './islandServer';
import { destroyChatPopup, hideChatPopup } from './chatPopupManager';
import { spawnIsland, killIsland, isIslandRunning } from './islandManager';

// ── Island subprocess early exit ──
// When spawned as the Dynamic Island child process, load the island entry
// and skip all main app initialization.
if (process.env.MEKA_IS_ISLAND === '1') {
  const islandEntry = app.isPackaged
    ? path.join(process.resourcesPath, 'dynamic-island/out/main/index.js')
    : path.join(__dirname, '../../dynamic-island/out/main/index.js');
  if (fs.existsSync(islandEntry)) {
    require(islandEntry);
  } else {
    console.warn('[main] Island entry not found, quitting subprocess:', islandEntry);
    app.quit();
  }
} else {

// ── Single instance lock ──
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const store = new Store<{ anthropicApiKey?: string; lastProjectDir?: string; islandEnabled?: boolean }>({
  defaults: { islandEnabled: false },
});

let mainWindow: BrowserWindow | null = null;
let sidecar: SidecarManager | null = null;
let isQuitting = false;

// PTY management
const ptyProcesses = new Map<number, pty.IPty>();
let nextPtyId = 1;

function getIconPath(): string {
  const iconFile = process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, iconFile);
  }
  return path.join(__dirname, '../../resources', iconFile);
}

function createWindow(): void {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#1A1A2E',
  });

  mainWindow.maximize();

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    destroyChatPopup();
  });
}

function getShellPath(): string {
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    return execSync(`${shell} -ilc 'echo $PATH'`, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return process.env.PATH || '';
  }
}

// On macOS, GUI apps launched from Finder have a minimal PATH.
// Fix it once at startup by sourcing the user's login shell.
if (process.platform === 'darwin' && app.isPackaged) {
  process.env.PATH = getShellPath();
}

function getSidecarEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const storedKey = store.get('anthropicApiKey');
  const envKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = storedKey || envKey;
  if (apiKey) {
    env.ANTHROPIC_API_KEY = apiKey;
  }
  return env;
}

function startSidecar(): void {
  sidecar = new SidecarManager();

  sidecar.spawn(getSidecarEnv());

  sidecar.on('event', (eventName: string, data: any) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('sidecar:event', eventName, data);
      }
    }
  });

  sidecar.on('crashed', (code: number | null) => {
    if (isQuitting) return;
    console.log(`[main] sidecar crashed with code ${code}, restarting...`);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('sidecar:event', 'sidecar.restarted', {});
      }
    }
    setTimeout(() => {
      if (sidecar && !isQuitting) {
        sidecar.spawn(getSidecarEnv());
      }
    }, 1000);
  });
}

const SLOW_METHOD_TIMEOUTS: Record<string, number> = {
  'git.changes': 60000,
  'git.file_tree': 60000,
  'git.log': 30000,
  'git.diff': 30000,
  'git.commit': 30000,
  'git.generate_commit_msg': 120000,
  'session.send': 120000,
};

ipcMain.handle('sidecar:invoke', async (_, method: string, params: any) => {
  if (isQuitting) return null;
  if (!sidecar || !sidecar.isRunning()) {
    throw new Error('sidecar not running');
  }

  if (method === 'config.set_api_key' && params?.api_key) {
    store.set('anthropicApiKey', params.api_key);
  }

  const timeout = SLOW_METHOD_TIMEOUTS[method] ?? 15000;
  try {
    return await sidecar.invoke(method, params, timeout);
  } catch (err: any) {
    const message = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
    throw new Error(message);
  }
});

ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

let dragStartMouse = { x: 0, y: 0 };
let dragStartWin = { x: 0, y: 0 };

ipcMain.on('window:startDrag', (_, screenX: number, screenY: number) => {
  if (!mainWindow) return;
  dragStartMouse = { x: screenX, y: screenY };
  const [wx, wy] = mainWindow.getPosition();
  dragStartWin = { x: wx, y: wy };
});

ipcMain.on('window:dragging', (_, screenX: number, screenY: number) => {
  if (!mainWindow) return;
  const dx = screenX - dragStartMouse.x;
  const dy = screenY - dragStartMouse.y;
  mainWindow.setPosition(dragStartWin.x + dx, dragStartWin.y + dy);
});

// ── Chat Popup IPC handlers ──

ipcMain.handle('chat-popup:close', () => {
  hideChatPopup();
});

ipcMain.handle('chat-popup:get-session', async (_e, { sessionId }: { sessionId: string }) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window not available');
  }
  const requestId = `${sessionId}-${Date.now()}`;
  mainWindow.webContents.send('chat-popup:request-session', { sessionId, requestId });

  const responseChannel = `chat-popup:session-response:${requestId}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ipcMain.removeAllListeners(responseChannel);
      reject(new Error('Session data request timed out'));
    }, 5000);

    ipcMain.once(responseChannel, (_e, data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
});

ipcMain.on('chat-popup:sync-metadata', (_e, metadata: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat-popup:metadata-updated', metadata);
  }
});

ipcMain.on('chat-popup:sync-messages', (_e, payload: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat-popup:messages-updated', payload);
  }
});

ipcMain.handle('get-working-dir', () => {
  return process.cwd();
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '选择项目目录',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  store.set('lastProjectDir', result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle('config:getLastProjectDir', () => {
  return store.get('lastProjectDir', null);
});

// ── Island Toggle IPC ──

ipcMain.handle('island:toggle', (_, enabled: boolean) => {
  store.set('islandEnabled', enabled);
  if (enabled) {
    spawnIsland();
  } else {
    killIsland();
  }
});

ipcMain.handle('island:get-status', () => {
  return isIslandRunning();
});

ipcMain.handle('scan-skills', async (_, platform: string, projectDir: string) => {
  console.log(`[scan-skills] handler called: platform=${platform}, projectDir=${projectDir}`);
  const results: Array<{ name: string; description: string; filePath: string; source: 'project' | 'user'; pluginName?: string }> = [];

  const walkDir = async (dir: string, source: 'project' | 'user', pluginName?: string) => {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath, source, pluginName);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = parseSkillFrontmatter(content);
          if (parsed) {
            results.push({ ...parsed, filePath: fullPath, source, pluginName });
          }
        } catch (e) {
          console.warn(`[scan-skills] Failed to read ${fullPath}:`, e);
        }
      }
    }
  };

  const projectSkillsDir = path.join(projectDir, `.${platform}`, 'skills');
  const userSkillsDir = path.join(os.homedir(), `.${platform}`, 'skills');

  await walkDir(projectSkillsDir, 'project');
  console.log(`[scan-skills] after project skills: ${results.length} results`);
  await walkDir(userSkillsDir, 'user');
  console.log(`[scan-skills] after user skills: ${results.length} results`);

  // Scan plugin skills (Claude only)
  if (platform === 'claude') {
    const pluginEntries = await getPluginSkillEntries(projectDir);
    console.log(`[scan-skills] plugin entries: ${pluginEntries.length}`, pluginEntries.map(e => e.pluginName));
    for (const entry of pluginEntries) {
      await walkDir(entry.skillsDir, entry.source, entry.pluginName);
    }
  }

  console.log(`[scan-skills] total results: ${results.length}`);

  const seen = new Set<string>();
  return results.filter(s => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
});

function parseSkillFrontmatter(content: string): { name: string; description: string } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const nameMatch = frontmatter.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  if (!nameMatch) return null;

  const descMatch = frontmatter.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);

  return {
    name: nameMatch[1].trim(),
    description: descMatch ? descMatch[1].trim() : '',
  };
}

interface PluginSkillEntry {
  pluginName: string;
  skillsDir: string;
  source: 'project' | 'user';
}

async function getPluginSkillEntries(projectDir: string): Promise<PluginSkillEntry[]> {
  const claudeDir = path.join(os.homedir(), '.claude');

  let installedData: any;
  try {
    const raw = await fs.promises.readFile(path.join(claudeDir, 'plugins', 'installed_plugins.json'), 'utf-8');
    installedData = JSON.parse(raw);
  } catch {
    return [];
  }

  let enabledPlugins: Record<string, boolean> = {};
  try {
    const raw = await fs.promises.readFile(path.join(claudeDir, 'settings.json'), 'utf-8');
    const settings = JSON.parse(raw);
    enabledPlugins = settings.enabledPlugins || {};
  } catch {
    return [];
  }

  const plugins = installedData?.plugins;
  if (!plugins || typeof plugins !== 'object') return [];

  const entries: PluginSkillEntry[] = [];

  for (const [pluginKey, installations] of Object.entries(plugins)) {
    if (!enabledPlugins[pluginKey]) continue;

    const pluginName = pluginKey.split('@')[0];

    if (!Array.isArray(installations)) continue;

    for (const inst of installations as any[]) {
      const { scope, installPath, projectPath } = inst;
      if (!installPath) continue;

      if (scope === 'project') {
        if (projectPath !== projectDir) continue;
      } else if (scope !== 'user') {
        continue;
      }

      // Resolve skills directory from plugin.json
      let skillsDir = path.join(installPath, 'skills');
      try {
        const pluginJsonRaw = await fs.promises.readFile(path.join(installPath, '.claude-plugin', 'plugin.json'), 'utf-8');
        const pluginJson = JSON.parse(pluginJsonRaw);
        if (pluginJson.skills && typeof pluginJson.skills === 'string') {
          skillsDir = path.resolve(installPath, pluginJson.skills);
        }
      } catch {
        // plugin.json missing or invalid — use default skills/ dir
      }

      entries.push({
        pluginName,
        skillsDir,
        source: scope === 'project' ? 'project' : 'user',
      });
    }
  }

  // Ensure project-scoped entries come before user-scoped for correct dedup priority
  entries.sort((a, b) => (a.source === 'project' ? 0 : 1) - (b.source === 'project' ? 0 : 1));

  return entries;
}

// ── PTY IPC handlers ──

ipcMain.handle('pty:spawn', (_, cwd: string) => {
  const id = nextPtyId++;

  // Resolve shell — Electron GUI apps may not inherit SHELL from the terminal
  let shell: string;
  if (process.platform === 'win32') {
    shell = 'powershell.exe';
  } else {
    const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'];
    shell = candidates.find(s => s && fs.existsSync(s)) || '/bin/sh';
  }

  // Ensure cwd exists, fall back to home dir
  const safeCwd = (cwd && fs.existsSync(cwd)) ? cwd : os.homedir();

  const p = pty.spawn(shell, ['-l'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: safeCwd });
  ptyProcesses.set(id, p);
  p.onData(data => mainWindow?.webContents.send('pty:data', { id, data }));
  p.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('pty:exit', { id, code: exitCode });
    ptyProcesses.delete(id);
  });
  return id;
});

ipcMain.on('pty:write', (_, id: number, data: string) => {
  ptyProcesses.get(id)?.write(data);
});

ipcMain.on('pty:resize', (_, id: number, cols: number, rows: number) => {
  ptyProcesses.get(id)?.resize(cols, rows);
});

ipcMain.handle('pty:kill', (_, id: number) => {
  ptyProcesses.get(id)?.kill();
  ptyProcesses.delete(id);
});

// Harness file operations
ipcMain.handle('harness:write-file', async (_, filePath: string, content: string) => {
  const fs = await import('fs/promises');
  await fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('harness:read-file', async (_, filePath: string) => {
  const fs = await import('fs/promises');
  return await fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('harness:mkdir', async (_, dirPath: string) => {
  const fs = await import('fs/promises');
  await fs.mkdir(dirPath, { recursive: true });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(getIconPath()));
  }
  startSidecar();
  createWindow();
  startIslandServer(mainWindow!);
  if (store.get('islandEnabled')) {
    spawnIsland();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async (event) => {
  stopIslandServer();
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('app:before-quit');
      await Promise.race([
        new Promise<void>(resolve => ipcMain.once('app:flush-complete', () => resolve())),
        new Promise<void>(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch { /* proceed to quit */ }
  }

  ptyProcesses.forEach(p => p.kill());
  ptyProcesses.clear();
  sidecar?.kill();
  killIsland();
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});

} // end of main app else block
