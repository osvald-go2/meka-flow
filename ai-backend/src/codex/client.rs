use std::sync::Mutex;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

use super::types::{self, CodexEvent};

pub struct CodexProcess {
    pid: u32,
    child: Mutex<Option<Child>>,
}

impl CodexProcess {
    /// Spawn `codex exec --json --full-auto "prompt"`
    /// or    `codex exec resume <SESSION_ID> "prompt" --json --full-auto`
    pub fn spawn(
        working_dir: &str,
        prompt: &str,
        resume_thread_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<(Self, mpsc::UnboundedReceiver<CodexEvent>, mpsc::UnboundedReceiver<String>), String>
    {
        let mut cmd = Command::new("codex");

        // -m must come before exec subcommand
        if let Some(m) = model {
            cmd.args(["-m", m]);
        }

        if let Some(thread_id) = resume_thread_id {
            // codex exec resume <SESSION_ID> <PROMPT> --json --full-auto
            cmd.args(["exec", "resume", thread_id, prompt, "--json", "--full-auto"]);
        } else {
            // codex exec --json --full-auto <PROMPT>
            cmd.args(["exec", "--json", "--full-auto", prompt]);
        }

        cmd.current_dir(working_dir)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("failed to spawn codex: {e}"))?;
        let pid = child.id().ok_or("failed to get codex PID")?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "failed to capture codex stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "failed to capture codex stderr".to_string())?;

        let (tx, rx) = mpsc::unbounded_channel::<CodexEvent>();
        let (stderr_tx, stderr_rx) = mpsc::unbounded_channel::<String>();

        // Spawn stdout reader — parse JSONL events
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if let Some(event) = types::parse_line(&line) {
                    let _ = tx.send(event);
                }
            }
        });

        // Spawn stderr reader — collect for error reporting
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[codex stderr] {}", line);
                let _ = stderr_tx.send(line);
            }
        });

        Ok((
            CodexProcess {
                pid,
                child: Mutex::new(Some(child)),
            },
            rx,
            stderr_rx,
        ))
    }

    /// Send SIGINT to interrupt the codex process
    pub fn interrupt(&self) -> Result<(), String> {
        unsafe {
            if libc::kill(self.pid as i32, libc::SIGINT) != 0 {
                return Err("failed to send SIGINT to codex process".to_string());
            }
        }
        Ok(())
    }

    /// Kill the codex process (safe to call via Arc)
    pub fn kill(&self) -> Result<(), String> {
        if let Some(ref mut child) = *self.child.lock().unwrap() {
            child
                .start_kill()
                .map_err(|e| format!("failed to kill codex: {e}"))?;
        }
        Ok(())
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }
}
