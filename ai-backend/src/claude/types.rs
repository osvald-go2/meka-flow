use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Top-level JSON lines from `claude -p --output-format stream-json`
///
/// Each line from claude's stdout is one of these variants.
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeJson {
    #[serde(rename = "system")]
    System {
        #[serde(default)]
        subtype: String,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        tools: Option<Vec<Value>>,
    },

    #[serde(rename = "assistant")]
    Assistant {
        message: AssistantMessage,
        #[serde(default)]
        session_id: Option<String>,
    },

    #[serde(rename = "user")]
    User {
        message: UserMessage,
        #[serde(default)]
        tool_use_result: Option<ToolUseResult>,
        #[serde(default)]
        session_id: Option<String>,
    },

    #[serde(rename = "result")]
    Result {
        #[serde(default)]
        subtype: String,
        #[serde(default)]
        is_error: bool,
        #[serde(default)]
        result: Option<String>,
        #[serde(default)]
        duration_ms: Option<u64>,
        #[serde(default)]
        num_turns: Option<u32>,
        #[serde(default)]
        usage: Option<ResultUsage>,
        #[serde(default)]
        session_id: Option<String>,
    },
}

#[derive(Debug, Deserialize)]
pub struct AssistantMessage {
    #[serde(default)]
    pub content: Vec<ContentBlock>,
    #[serde(default)]
    pub stop_reason: Option<String>,
    #[serde(default)]
    pub usage: Option<ApiUsage>,
}

#[derive(Debug, Deserialize)]
pub struct UserMessage {
    #[serde(default)]
    pub content: Vec<ContentBlock>,
}

#[derive(Debug, Deserialize)]
pub struct ToolUseResult {
    #[serde(default)]
    pub stdout: Option<String>,
    #[serde(default)]
    pub stderr: Option<String>,
    #[serde(default)]
    pub is_error: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text {
        #[serde(default)]
        text: String,
    },
    #[serde(rename = "thinking")]
    Thinking {
        #[serde(default)]
        thinking: String,
    },
    #[serde(rename = "tool_use")]
    ToolUse {
        #[serde(default)]
        id: String,
        #[serde(default)]
        name: String,
        #[serde(default)]
        input: Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        #[serde(default)]
        tool_use_id: String,
        #[serde(default)]
        content: Option<Value>,
        #[serde(default)]
        is_error: Option<bool>,
    },
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ApiUsage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ResultUsage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
}

/// Input message format for stream-json stdin
#[derive(Debug, Serialize)]
pub struct UserInputMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub message: UserInputContent,
}

#[derive(Debug, Serialize)]
pub struct UserInputContent {
    pub role: String,
    pub content: String,
}

/// Parse a single JSON line from claude stdout.
pub fn parse_line(line: &str) -> Option<ClaudeJson> {
    match serde_json::from_str::<ClaudeJson>(line) {
        Ok(msg) => Some(msg),
        Err(_) => None, // Unknown type, skip
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_system_init() {
        let json = r#"{"type":"system","subtype":"init","session_id":"s1","model":"claude-sonnet-4-20250514","tools":[]}"#;
        let msg = parse_line(json).unwrap();
        match msg {
            ClaudeJson::System { subtype, model, .. } => {
                assert_eq!(subtype, "init");
                assert_eq!(model.unwrap(), "claude-sonnet-4-20250514");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_parse_assistant_text() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Hello!"}]}}"#;
        let msg = parse_line(json).unwrap();
        match msg {
            ClaudeJson::Assistant { message, .. } => {
                assert_eq!(message.content.len(), 1);
                match &message.content[0] {
                    ContentBlock::Text { text } => assert_eq!(text, "Hello!"),
                    _ => panic!("wrong content block"),
                }
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_parse_assistant_tool_use() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu1","name":"Bash","input":{"command":"ls"}}]}}"#;
        let msg = parse_line(json).unwrap();
        match msg {
            ClaudeJson::Assistant { message, .. } => {
                match &message.content[0] {
                    ContentBlock::ToolUse { name, input, .. } => {
                        assert_eq!(name, "Bash");
                        assert_eq!(input["command"], "ls");
                    }
                    _ => panic!("wrong content block"),
                }
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_parse_result() {
        let json = r#"{"type":"result","subtype":"success","is_error":false,"duration_ms":1234,"num_turns":3,"usage":{"input_tokens":100,"output_tokens":200}}"#;
        let msg = parse_line(json).unwrap();
        match msg {
            ClaudeJson::Result { is_error, duration_ms, usage, .. } => {
                assert!(!is_error);
                assert_eq!(duration_ms.unwrap(), 1234);
                assert_eq!(usage.unwrap().output_tokens, 200);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_unknown_type_returns_none() {
        let json = r#"{"type":"rate_limit_event","data":{}}"#;
        assert!(parse_line(json).is_none());
    }
}
