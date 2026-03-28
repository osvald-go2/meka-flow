use super::Database;

const CURRENT_VERSION: i64 = 4;

pub fn run(db: &Database) -> Result<(), String> {
    let conn = db.conn();

    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| format!("failed to read user_version: {e}"))?;

    if version < 1 {
        migrate_v1(&conn)?;
    }

    if version < 2 {
        migrate_v2(&conn)?;
    }

    if version < 3 {
        migrate_v3(&conn)?;
    }

    if version < 4 {
        migrate_v4(&conn)?;
    }

    Ok(())
}

fn migrate_v4(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS harness_groups (
            id              VARCHAR(36) PRIMARY KEY,
            project_id      INTEGER NOT NULL,
            name            VARCHAR(255) NOT NULL,
            connections_json TEXT NOT NULL DEFAULT '[]',
            max_retries     INTEGER NOT NULL DEFAULT 3,
            status          VARCHAR(20) NOT NULL DEFAULT 'idle',
            current_sprint  INTEGER NOT NULL DEFAULT 0,
            current_round   INTEGER NOT NULL DEFAULT 0,
            harness_dir     VARCHAR(1024) NOT NULL DEFAULT '',
            created_at      VARCHAR(30) NOT NULL,
            updated_at      VARCHAR(30) NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_harness_groups_project ON harness_groups(project_id);
        PRAGMA user_version = 4;
    ").map_err(|e| format!("migration v4 failed: {e}"))?;
    Ok(())
}

fn migrate_v3(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch("
        ALTER TABLE sessions ADD COLUMN codex_thread_id TEXT DEFAULT NULL;
        PRAGMA user_version = 3;
    ").map_err(|e| format!("migration v3 failed: {e}"))?;
    Ok(())
}

fn migrate_v2(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch("
        ALTER TABLE sessions ADD COLUMN claude_session_id TEXT DEFAULT NULL;
        PRAGMA user_version = 2;
    ").map_err(|e| format!("migration v2 failed: {e}"))?;

    Ok(())
}

fn migrate_v1(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS projects (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            VARCHAR(255) NOT NULL,
            path            VARCHAR(1024) NOT NULL UNIQUE,
            view_mode       VARCHAR(20) NOT NULL DEFAULT 'canvas',
            canvas_x        REAL NOT NULL DEFAULT 0,
            canvas_y        REAL NOT NULL DEFAULT 0,
            canvas_zoom     REAL NOT NULL DEFAULT 1.0,
            last_opened_at  VARCHAR(30) NOT NULL,
            created_at      VARCHAR(30) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id          VARCHAR(36) PRIMARY KEY,
            project_id  INTEGER NOT NULL,
            title       VARCHAR(255) NOT NULL,
            model       VARCHAR(100) NOT NULL,
            status      VARCHAR(20) NOT NULL DEFAULT 'inbox',
            position_x  REAL NOT NULL DEFAULT 0,
            position_y  REAL NOT NULL DEFAULT 0,
            height      REAL,
            git_branch  VARCHAR(255),
            worktree    VARCHAR(1024),
            messages    TEXT NOT NULL DEFAULT '[]',
            created_at  VARCHAR(30) NOT NULL,
            updated_at  VARCHAR(30) NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(project_id, status);

        CREATE TABLE IF NOT EXISTS settings (
            key         VARCHAR(100) PRIMARY KEY,
            value       VARCHAR(2048) NOT NULL,
            updated_at  VARCHAR(30) NOT NULL
        );

        PRAGMA user_version = 1;"
    ).map_err(|e| format!("migration v1 failed: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    #[test]
    fn test_fresh_migration_creates_tables() {
        let db = Database::open_memory().unwrap();
        let conn = db.conn();

        let project_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .unwrap();
        assert_eq!(project_count, 0);

        let session_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(session_count, 0);

        let setting_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(setting_count, 0);

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4);
    }

    #[test]
    fn test_migration_is_idempotent() {
        let db = Database::open_memory().unwrap();
        run(&db).unwrap();

        let version: i64 = db.conn()
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4);
    }

    #[test]
    fn test_v3_migration_adds_codex_thread_id() {
        let db = Database::open_memory().unwrap();
        let conn = db.conn();
        let has_column: bool = conn
            .prepare("SELECT codex_thread_id FROM sessions LIMIT 0")
            .is_ok();
        assert!(has_column, "codex_thread_id column should exist after migration");
    }
}
