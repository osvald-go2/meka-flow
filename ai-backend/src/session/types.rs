use serde::Serialize;

#[derive(Debug)]
pub struct Session {
    pub id: String,
    pub model: String,
    pub max_tokens: u32,
    pub messages: Vec<ChatMessage>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct SessionSummary {
    pub id: String,
    pub model: String,
    pub message_count: usize,
    pub created_at: String,
}
