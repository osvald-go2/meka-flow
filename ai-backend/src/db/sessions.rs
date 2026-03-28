use rusqlite::{params, OptionalExtension};
use super::types::DbSession;
use super::Database;

fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn row_to_session(row: &rusqlite::Row) -> rusqlite::Result<DbSession> {
    Ok(DbSession {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        model: row.get(3)?,
        status: row.get(4)?,
        position_x: row.get(5)?,
        position_y: row.get(6)?,
        height: row.get(7)?,
        git_branch: row.get(8)?,
        worktree: row.get(9)?,
        messages: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
        claude_session_id: row.get(13)?,
        codex_thread_id: row.get(14)?,
    })
}

pub fn create(db: &Database, session: &DbSession) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO sessions (id, project_id, title, model, status, position_x, position_y, height, git_branch, worktree, messages, created_at, updated_at, claude_session_id, codex_thread_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            session.id,
            session.project_id,
            session.title,
            session.model,
            session.status,
            session.position_x,
            session.position_y,
            session.height,
            session.git_branch,
            session.worktree,
            session.messages,
            session.created_at,
            session.updated_at,
            session.claude_session_id,
            session.codex_thread_id,
        ],
    )
    .map_err(|e| format!("failed to create session: {e}"))?;
    Ok(())
}

pub fn get_by_id(db: &Database, id: &str) -> Result<Option<DbSession>, String> {
    let conn = db.conn();
    conn.query_row(
        "SELECT id, project_id, title, model, status, position_x, position_y, height, git_branch, worktree, messages, created_at, updated_at, claude_session_id, codex_thread_id
         FROM sessions WHERE id = ?1",
        params![id],
        row_to_session,
    )
    .optional()
    .map_err(|e| format!("failed to get session: {e}"))
}

pub fn list_by_project(db: &Database, project_id: i64) -> Result<Vec<DbSession>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, model, status, position_x, position_y, height, git_branch, worktree, messages, created_at, updated_at, claude_session_id, codex_thread_id
             FROM sessions WHERE project_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| format!("failed to prepare list query: {e}"))?;
    let rows = stmt
        .query_map(params![project_id], row_to_session)
        .map_err(|e| format!("failed to list sessions: {e}"))?;
    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| format!("failed to read session row: {e}"))?);
    }
    Ok(sessions)
}

pub fn update(db: &Database, session: &DbSession) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE sessions SET project_id = ?1, title = ?2, model = ?3, status = ?4, position_x = ?5, position_y = ?6, height = ?7, git_branch = ?8, worktree = ?9, messages = ?10, claude_session_id = ?11, codex_thread_id = ?12, updated_at = ?13
         WHERE id = ?14",
        params![
            session.project_id,
            session.title,
            session.model,
            session.status,
            session.position_x,
            session.position_y,
            session.height,
            session.git_branch,
            session.worktree,
            session.messages,
            session.claude_session_id,
            session.codex_thread_id,
            now(),
            session.id,
        ],
    )
    .map_err(|e| format!("failed to update session: {e}"))?;
    Ok(())
}

pub fn update_messages(db: &Database, id: &str, messages: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE sessions SET messages = ?1, updated_at = ?2 WHERE id = ?3",
        params![messages, now(), id],
    )
    .map_err(|e| format!("failed to update messages: {e}"))?;
    Ok(())
}

pub fn update_status(db: &Database, id: &str, status: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE sessions SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now(), id],
    )
    .map_err(|e| format!("failed to update status: {e}"))?;
    Ok(())
}

pub fn update_position(db: &Database, id: &str, x: f64, y: f64, height: Option<f64>) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE sessions SET position_x = ?1, position_y = ?2, height = ?3, updated_at = ?4 WHERE id = ?5",
        params![x, y, height, now(), id],
    )
    .map_err(|e| format!("failed to update position: {e}"))?;
    Ok(())
}

pub fn delete(db: &Database, id: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])
        .map_err(|e| format!("failed to delete session: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (Database, i64) {
        let db = Database::open_memory().unwrap();
        let project = crate::db::projects::create(&db, "test", "/test/path").unwrap();
        (db, project.id)
    }

    fn make_session(project_id: i64) -> DbSession {
        DbSession {
            id: uuid::Uuid::new_v4().to_string(),
            project_id,
            title: "Test Session".to_string(),
            model: "claude".to_string(),
            status: "inbox".to_string(),
            position_x: 100.0,
            position_y: 200.0,
            height: Some(400.0),
            git_branch: Some("feat/test".to_string()),
            worktree: None,
            messages: "[]".to_string(),
            created_at: now(),
            updated_at: now(),
            claude_session_id: None,
            codex_thread_id: None,
        }
    }

    #[test]
    fn test_create_and_get() {
        let (db, project_id) = setup();
        let session = make_session(project_id);
        let session_id = session.id.clone();
        create(&db, &session).unwrap();

        let fetched = get_by_id(&db, &session_id).unwrap().unwrap();
        assert_eq!(fetched.id, session_id);
        assert_eq!(fetched.project_id, project_id);
        assert_eq!(fetched.title, "Test Session");
        assert_eq!(fetched.model, "claude");
        assert_eq!(fetched.status, "inbox");
        assert_eq!(fetched.position_x, 100.0);
        assert_eq!(fetched.position_y, 200.0);
        assert_eq!(fetched.height, Some(400.0));
        assert_eq!(fetched.git_branch, Some("feat/test".to_string()));
        assert!(fetched.worktree.is_none());
    }

    #[test]
    fn test_list_by_project() {
        let (db, project_id) = setup();
        let s1 = make_session(project_id);
        let s2 = make_session(project_id);
        create(&db, &s1).unwrap();
        create(&db, &s2).unwrap();

        let sessions = list_by_project(&db, project_id).unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn test_update_messages() {
        let (db, project_id) = setup();
        let session = make_session(project_id);
        let session_id = session.id.clone();
        create(&db, &session).unwrap();

        let new_messages = r#"[{"role":"user","content":"hello"}]"#;
        update_messages(&db, &session_id, new_messages).unwrap();

        let fetched = get_by_id(&db, &session_id).unwrap().unwrap();
        assert_eq!(fetched.messages, new_messages);
    }

    #[test]
    fn test_update_status() {
        let (db, project_id) = setup();
        let session = make_session(project_id);
        let session_id = session.id.clone();
        create(&db, &session).unwrap();

        update_status(&db, &session_id, "review").unwrap();

        let fetched = get_by_id(&db, &session_id).unwrap().unwrap();
        assert_eq!(fetched.status, "review");
    }

    #[test]
    fn test_update_position() {
        let (db, project_id) = setup();
        let session = make_session(project_id);
        let session_id = session.id.clone();
        create(&db, &session).unwrap();

        update_position(&db, &session_id, 500.0, 600.0, Some(800.0)).unwrap();

        let fetched = get_by_id(&db, &session_id).unwrap().unwrap();
        assert_eq!(fetched.position_x, 500.0);
        assert_eq!(fetched.position_y, 600.0);
        assert_eq!(fetched.height, Some(800.0));
    }

    #[test]
    fn test_delete() {
        let (db, project_id) = setup();
        let session = make_session(project_id);
        let session_id = session.id.clone();
        create(&db, &session).unwrap();

        delete(&db, &session_id).unwrap();

        let gone = get_by_id(&db, &session_id).unwrap();
        assert!(gone.is_none());
    }

    #[test]
    fn test_codex_thread_id_persistence() {
        let (db, project_id) = setup();
        let mut session = make_session(project_id);
        session.codex_thread_id = Some("thread_abc123".to_string());
        let session_id = session.id.clone();
        create(&db, &session).unwrap();
        let fetched = get_by_id(&db, &session_id).unwrap().unwrap();
        assert_eq!(fetched.codex_thread_id, Some("thread_abc123".to_string()));
    }

    #[test]
    fn test_cascade_delete_with_project() {
        let (db, project_id) = setup();
        let session = make_session(project_id);
        let session_id = session.id.clone();
        create(&db, &session).unwrap();

        // Delete the project; session should cascade-delete
        crate::db::projects::delete(&db, project_id).unwrap();

        let gone = get_by_id(&db, &session_id).unwrap();
        assert!(gone.is_none());
    }
}
