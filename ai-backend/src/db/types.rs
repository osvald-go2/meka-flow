use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub view_mode: String,
    pub canvas_x: f64,
    pub canvas_y: f64,
    pub canvas_zoom: f64,
    pub last_opened_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbSession {
    pub id: String,
    pub project_id: i64,
    pub title: String,
    pub model: String,
    pub status: String,
    pub position_x: f64,
    pub position_y: f64,
    pub height: Option<f64>,
    pub git_branch: Option<String>,
    pub worktree: Option<String>,
    pub messages: String,
    pub created_at: String,
    pub updated_at: String,
    pub claude_session_id: Option<String>,
    pub codex_thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbHarnessGroup {
    pub id: String,
    pub project_id: i64,
    pub name: String,
    pub connections_json: String,
    pub max_retries: i64,
    pub status: String,
    pub current_sprint: i64,
    pub current_round: i64,
    pub harness_dir: String,
    pub created_at: String,
    pub updated_at: String,
}
