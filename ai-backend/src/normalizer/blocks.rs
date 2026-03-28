use serde::Serialize;

/// Matches the frontend ContentBlock discriminated union in src/types.ts
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { content: String },

    #[serde(rename = "code")]
    Code { code: String, language: String },

    #[serde(rename = "tool_call")]
    ToolCall {
        tool: String,
        args: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        description: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration: Option<f64>,
        status: ToolCallStatus,
    },

    #[serde(rename = "todolist")]
    TodoList { items: Vec<TodoItem> },

    #[serde(rename = "subagent")]
    Subagent {
        #[serde(rename = "agentId")]
        agent_id: String,
        task: String,
        status: SubagentStatus,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        blocks: Option<Vec<ContentBlock>>,
    },

    #[serde(rename = "askuser")]
    AskUser {
        questions: Vec<AskUserQuestion>,
        #[serde(skip_serializing_if = "Option::is_none")]
        submitted: Option<bool>,
    },

    #[serde(rename = "skill")]
    Skill {
        skill: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        args: Option<String>,
        status: SkillStatus,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration: Option<f64>,
    },
}

#[derive(Debug, Clone, Serialize)]
pub enum ToolCallStatus {
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub enum SubagentStatus {
    #[serde(rename = "launched")]
    Launched,
    #[serde(rename = "working")]
    Working,
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub enum SkillStatus {
    #[serde(rename = "invoking")]
    Invoking,
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct TodoItem {
    pub id: String,
    pub label: String,
    pub status: TodoStatus,
}

#[derive(Debug, Clone, Serialize)]
pub enum TodoStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "in_progress")]
    InProgress,
    #[serde(rename = "done")]
    Done,
}

#[derive(Debug, Clone, Serialize)]
pub struct AskUserQuestion {
    pub id: String,
    pub question: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<String>,
}

/// Delta types for streaming (used in block.delta events)
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum BlockDelta {
    /// For text/code blocks: append content
    TextDelta { content: String },
    /// For tool_call blocks: append args
    ArgsDelta { args: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_block_serializes() {
        let block = ContentBlock::Text { content: "hello".into() };
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"text\""));
        assert!(json.contains("\"content\":\"hello\""));
    }

    #[test]
    fn test_code_block_serializes() {
        let block = ContentBlock::Code { code: "fn main(){}".into(), language: "rust".into() };
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"code\""));
        assert!(json.contains("\"language\":\"rust\""));
    }

    #[test]
    fn test_tool_call_serializes() {
        let block = ContentBlock::ToolCall {
            tool: "Bash".into(),
            args: "ls -la".into(),
            description: None,
            duration: None,
            status: ToolCallStatus::Running,
        };
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"tool_call\""));
        assert!(json.contains("\"status\":\"running\""));
        // Optional fields omitted when None
        assert!(!json.contains("description"));
        assert!(!json.contains("duration"));
    }

    #[test]
    fn test_subagent_serializes_with_camel_case() {
        let block = ContentBlock::Subagent {
            agent_id: "a1".into(),
            task: "test".into(),
            status: SubagentStatus::Launched,
            summary: None,
            blocks: None,
        };
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"agentId\":\"a1\""));
        assert!(json.contains("\"type\":\"subagent\""));
    }

    #[test]
    fn test_todolist_serializes() {
        let block = ContentBlock::TodoList {
            items: vec![
                TodoItem { id: "t1".into(), label: "task one".into(), status: TodoStatus::Done },
                TodoItem { id: "t2".into(), label: "task two".into(), status: TodoStatus::Pending },
            ],
        };
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"todolist\""));
        assert!(json.contains("\"status\":\"done\""));
        assert!(json.contains("\"status\":\"pending\""));
    }
}
