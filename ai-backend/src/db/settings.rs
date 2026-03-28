use rusqlite::{params, OptionalExtension};
use super::Database;

fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn get(db: &Database, key: &str) -> Result<Option<String>, String> {
    let conn = db.conn();
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("failed to get setting: {e}"))
}

pub fn set(db: &Database, key: &str, value: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value, now()],
    )
    .map_err(|e| format!("failed to set setting: {e}"))?;
    Ok(())
}

pub fn delete(db: &Database, key: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])
        .map_err(|e| format!("failed to delete setting: {e}"))?;
    Ok(())
}

pub fn list_by_prefix(db: &Database, prefix: &str) -> Result<Vec<(String, String)>, String> {
    let conn = db.conn();
    let pattern = format!("{}%", prefix);
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings WHERE key LIKE ?1 ORDER BY key")
        .map_err(|e| format!("failed to prepare list query: {e}"))?;
    let rows = stmt
        .query_map(params![pattern], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("failed to list settings: {e}"))?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("failed to read setting row: {e}"))?);
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_and_get() {
        let db = Database::open_memory().unwrap();
        set(&db, "api_key.anthropic", "sk-ant-test123").unwrap();

        let value = get(&db, "api_key.anthropic").unwrap();
        assert_eq!(value, Some("sk-ant-test123".to_string()));
    }

    #[test]
    fn test_get_nonexistent() {
        let db = Database::open_memory().unwrap();
        let value = get(&db, "nonexistent.key").unwrap();
        assert!(value.is_none());
    }

    #[test]
    fn test_upsert() {
        let db = Database::open_memory().unwrap();
        set(&db, "api_key.anthropic", "old-value").unwrap();
        set(&db, "api_key.anthropic", "new-value").unwrap();

        let value = get(&db, "api_key.anthropic").unwrap();
        assert_eq!(value, Some("new-value".to_string()));
    }

    #[test]
    fn test_delete() {
        let db = Database::open_memory().unwrap();
        set(&db, "api_key.anthropic", "sk-ant-test123").unwrap();
        delete(&db, "api_key.anthropic").unwrap();

        let value = get(&db, "api_key.anthropic").unwrap();
        assert!(value.is_none());
    }

    #[test]
    fn test_list_by_prefix() {
        let db = Database::open_memory().unwrap();
        set(&db, "api_key.anthropic", "sk-ant-123").unwrap();
        set(&db, "api_key.gemini", "ai-gemini-456").unwrap();
        set(&db, "ui.theme", "dark").unwrap();

        let api_keys = list_by_prefix(&db, "api_key.").unwrap();
        assert_eq!(api_keys.len(), 2);
        assert_eq!(api_keys[0].0, "api_key.anthropic");
        assert_eq!(api_keys[1].0, "api_key.gemini");
    }
}
