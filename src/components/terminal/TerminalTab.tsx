import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalTabProps {
  terminalId: number;
  visible: boolean;
}

export function TerminalTab({ terminalId, visible }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  // Initialize xterm instance once per terminalId
  useEffect(() => {
    if (!containerRef.current) return;
    const aiBackend = (window as any).aiBackend;
    if (!aiBackend) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.3,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", monospace',
      allowTransparency: true,
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        foreground: '#D4D4D8',
        cursor: '#F59E0B',
        cursorAccent: '#0D0B09',
        selectionBackground: '#F59E0B30',
        selectionForeground: '#FAFAFA',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // Send keyboard input to PTY
    term.onData((data: string) => {
      aiBackend.ptyWrite(terminalId, data);
    });

    // Listen for PTY output
    const removeDataListener = aiBackend.onPtyData((payload: { id: number; data: string }) => {
      if (payload.id === terminalId) {
        term.write(payload.data);
      }
    });

    // Listen for PTY exit
    const removeExitListener = aiBackend.onPtyExit((payload: { id: number; code: number }) => {
      if (payload.id === terminalId) {
        term.write(`\r\n\x1b[90m[Process exited with code ${payload.code}]\x1b[0m\r\n`);
      }
    });

    // Send initial resize
    aiBackend.ptyResize(terminalId, term.cols, term.rows);

    // ResizeObserver to auto-fit
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        aiBackend.ptyResize(terminalId, term.cols, term.rows);
      } catch {}
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      removeDataListener?.();
      removeExitListener?.();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [terminalId]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitRef.current) {
      const timer = setTimeout(() => {
        fitRef.current?.fit();
        const term = termRef.current;
        const aiBackend = (window as any).aiBackend;
        if (term && aiBackend) {
          aiBackend.ptyResize(terminalId, term.cols, term.rows);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, terminalId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        padding: '4px 8px',
      }}
    />
  );
}
