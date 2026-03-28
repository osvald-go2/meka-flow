use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex};

use super::types::{parse_line, ClaudeJson, UserInputContent, UserInputMessage};

/// Manages a spawned `claude` CLI process communicating via stream-json protocol.
pub struct ClaudeProcess {
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    pub child: Child,
    cached_pid: Option<u32>,
}

impl ClaudeProcess {
    /// Spawn the claude CLI with stream-json I/O.
    ///
    /// Command: `claude -p --output-format stream-json --input-format stream-json
    ///           --verbose --no-chrome --dangerously-skip-permissions`
    pub fn spawn(working_dir: &str, resume_session_id: Option<&str>, model: Option<&str>) -> Result<(Self, mpsc::UnboundedReceiver<ClaudeJson>), String> {
        let mut cmd = Command::new("claude");
        cmd.args([
            "-p",
            "--output-format", "stream-json",
            "--input-format", "stream-json",
            "--verbose",
            "--no-chrome",
            "--dangerously-skip-permissions",
            "--mcp-config", r#"{"mcpServers":{}}"#,
            "--strict-mcp-config",
        ]);
        if let Some(m) = model {
            cmd.args(["--model", m]);
        }
        if let Some(sid) = resume_session_id {
            cmd.args(["--resume", sid]);
        }
        cmd.current_dir(working_dir);

        // Prevent nested claude session detection
        cmd.env_remove("CLAUDECODE");
        cmd.env_remove("CLAUDE_CODE_ENTRYPOINT");

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {}", e))?;
        let cached_pid = child.id();

        let stdin = child.stdin.take()
            .ok_or_else(|| "Failed to open stdin".to_string())?;
        let stdout = child.stdout.take()
            .ok_or_else(|| "Failed to open stdout".to_string())?;
        let stderr = child.stderr.take();

        // Channel for parsed messages
        let (tx, rx) = mpsc::unbounded_channel::<ClaudeJson>();

        // Spawn stdout read loop — parse each line as ClaudeJson
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        if line.trim().is_empty() {
                            continue;
                        }
                        if let Some(msg) = parse_line(&line) {
                            if tx.send(msg).is_err() {
                                break; // Receiver dropped
                            }
                        }
                    }
                    Ok(None) => break, // EOF
                    Err(_) => break,
                }
            }
        });

        // Log stderr
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[claude stderr] {}", line);
                }
            });
        }

        let process = ClaudeProcess {
            stdin: Arc::new(Mutex::new(stdin)),
            child,
            cached_pid,
        };

        Ok((process, rx))
    }

    /// Send a user message to the claude process via stdin.
    pub async fn send_message(&self, text: &str) -> Result<(), String> {
        let msg = UserInputMessage {
            msg_type: "user".to_string(),
            message: UserInputContent {
                role: "user".to_string(),
                content: text.to_string(),
            },
        };

        let json = serde_json::to_string(&msg)
            .map_err(|e| format!("JSON serialize error: {}", e))?;

        let mut stdin = self.stdin.lock().await;
        stdin.write_all(json.as_bytes()).await
            .map_err(|e| format!("stdin write error: {}", e))?;
        stdin.write_all(b"\n").await
            .map_err(|e| format!("stdin newline error: {}", e))?;
        stdin.flush().await
            .map_err(|e| format!("stdin flush error: {}", e))?;

        Ok(())
    }

    /// Interrupt the claude process via SIGINT (Unix only).
    /// Does not terminate the process — just stops current generation.
    pub fn interrupt(&self) -> Result<(), String> {
        let pid = self.cached_pid
            .ok_or_else(|| "process already exited".to_string())?;
        let ret = unsafe { libc::kill(pid as i32, libc::SIGINT) };
        if ret != 0 {
            return Err(format!("SIGINT failed with errno: {}", std::io::Error::last_os_error()));
        }
        Ok(())
    }

    /// Kill the claude process.
    pub async fn kill(&mut self) -> Result<(), String> {
        self.child.kill().await
            .map_err(|e| format!("Kill failed: {}", e))
    }
}
