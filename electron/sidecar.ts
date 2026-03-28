import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

export class SidecarManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private lineReader: Interface | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private binaryPath: string;

  constructor(binaryPath?: string) {
    super();
    this.binaryPath = binaryPath || this.getDefaultBinaryPath();
  }

  private getDefaultBinaryPath(): string {
    const isDev = !app.isPackaged;
    if (isDev) {
      // In dev, app.getAppPath() points to the project root
      return path.join(app.getAppPath(), 'ai-backend', 'target', 'debug', 'ai-backend');
    }
    return path.join(process.resourcesPath!, 'ai-backend');
  }

  spawn(env?: Record<string, string>): void {
    if (this.process) {
      return;
    }

    this.process = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    this.lineReader = createInterface({
      input: this.process.stdout!,
      crlfDelay: Infinity,
    });

    this.lineReader.on('line', (line: string) => {
      this.handleLine(line);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[sidecar stderr]', data.toString());
    });

    this.process.on('close', (code: number | null) => {
      console.log(`[sidecar] exited with code ${code}`);
      this.process = null;
      this.lineReader = null;

      for (const [_, pending] of this.pendingRequests) {
        pending.reject(new Error('sidecar crashed'));
      }
      this.pendingRequests.clear();

      this.emit('crashed', code);
    });
  }

  private handleLine(line: string): void {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    if (msg.id && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }
    } else if (msg.event) {
      this.emit('event', msg.event, msg.data);
    }
  }

  async invoke(method: string, params: any = {}, timeoutMs = 15000): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('sidecar not running');
    }

    const id = `req_${++this.requestCounter}`;
    const request = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`sidecar invoke '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (result: any) => { clearTimeout(timer); resolve(result); },
        reject: (error: any) => { clearTimeout(timer); reject(error); },
      });
      this.process!.stdin!.write(request + '\n');
    });
  }

  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}
