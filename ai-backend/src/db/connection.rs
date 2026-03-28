use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::migrations;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open_default() -> Result<Self, String> {
        let path = Self::default_db_path()?;
        Self::open(&path)
    }

    pub fn open(path: &str) -> Result<Self, String> {
        if let Some(parent) = std::path::Path::new(path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create db directory: {e}"))?;
        }

        let conn = Connection::open(path)
            .map_err(|e| format!("failed to open database: {e}"))?;

        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;"
        ).map_err(|e| format!("failed to set pragmas: {e}"))?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        migrations::run(&db)?;

        Ok(db)
    }

    pub fn open_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory()
            .map_err(|e| format!("failed to open in-memory db: {e}"))?;

        conn.execute_batch(
            "PRAGMA foreign_keys = ON;"
        ).map_err(|e| format!("failed to set pragmas: {e}"))?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        migrations::run(&db)?;

        Ok(db)
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("database mutex poisoned")
    }

    fn default_db_path() -> Result<String, String> {
        let data_dir = dirs::data_dir()
            .ok_or("could not determine user data directory")?;
        let mut path: PathBuf = data_dir;
        path.push("meka-flow");
        path.push("data.db");
        path.to_str()
            .map(|s| s.to_string())
            .ok_or("invalid data directory path".to_string())
    }
}
