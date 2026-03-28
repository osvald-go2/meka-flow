use serde::Deserialize;
use serde_json::Value;

/// Top-level Codex JSONL event — each line from `codex exec --json` stdout
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum CodexEvent {
    #[serde(rename = "thread.started")]
    ThreadStarted {
        thread_id: Option<String>,
    },

    #[serde(rename = "turn.started")]
    TurnStarted {},

    #[serde(rename = "item.started")]
    ItemStarted {
        item: CodexItem,
    },

    #[serde(rename = "item.updated")]
    ItemUpdated {
        item: CodexItem,
    },

    #[serde(rename = "item.completed")]
    ItemCompleted {
        item: CodexItem,
    },

    #[serde(rename = "turn.completed")]
    TurnCompleted {
        usage: Option<CodexUsage>,
    },

    /// Catch-all for unknown events
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CodexItem {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub status: Option<String>,
    pub text: Option<String>,
    pub command: Option<String>,
    pub output: Option<String>,
    pub aggregated_output: Option<String>,
    pub exit_code: Option<i32>,
    pub filename: Option<String>,
    pub changes: Option<Vec<CodexChange>>,
    pub items: Option<Vec<CodexTodoItem>>,
    pub content: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CodexChange {
    pub path: String,
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CodexTodoItem {
    pub text: Option<String>,
    #[serde(default)]
    pub completed: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CodexUsage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cached_input_tokens: Option<u64>,
}

/// Parse a JSON line into a CodexEvent
pub fn parse_line(line: &str) -> Option<CodexEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    match serde_json::from_str::<CodexEvent>(trimmed) {
        Ok(event) => Some(event),
        Err(e) => {
            eprintln!("[codex] failed to parse event: {e} — line: {trimmed}");
            None
        }
    }
}
