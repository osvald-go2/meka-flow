use rusqlite::{params, OptionalExtension};
use super::types::Project;
use super::Database;

fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn row_to_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        path: row.get(2)?,
        view_mode: row.get(3)?,
        canvas_x: row.get(4)?,
        canvas_y: row.get(5)?,
        canvas_zoom: row.get(6)?,
        last_opened_at: row.get(7)?,
        created_at: row.get(8)?,
    })
}

pub fn create(db: &Database, name: &str, path: &str) -> Result<Project, String> {
    let ts = now();
    let id: i64 = {
        let conn = db.conn();
        conn.execute(
            "INSERT INTO projects (name, path, view_mode, canvas_x, canvas_y, canvas_zoom, last_opened_at, created_at)
             VALUES (?1, ?2, 'canvas', 0, 0, 1.0, ?3, ?3)",
            params![name, path, ts],
        )
        .map_err(|e| format!("failed to create project: {e}"))?;
        conn.last_insert_rowid()
    };
    // conn is dropped here, safe to call get_by_id
    get_by_id(db, id)?
        .ok_or_else(|| "project not found after insert".to_string())
}

pub fn get_by_id(db: &Database, id: i64) -> Result<Option<Project>, String> {
    let conn = db.conn();
    conn.query_row(
        "SELECT id, name, path, view_mode, canvas_x, canvas_y, canvas_zoom, last_opened_at, created_at
         FROM projects WHERE id = ?1",
        params![id],
        row_to_project,
    )
    .optional()
    .map_err(|e| format!("failed to get project: {e}"))
}

pub fn get_by_path(db: &Database, path: &str) -> Result<Option<Project>, String> {
    let conn = db.conn();
    conn.query_row(
        "SELECT id, name, path, view_mode, canvas_x, canvas_y, canvas_zoom, last_opened_at, created_at
         FROM projects WHERE path = ?1",
        params![path],
        row_to_project,
    )
    .optional()
    .map_err(|e| format!("failed to get project by path: {e}"))
}

pub fn list(db: &Database) -> Result<Vec<Project>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, path, view_mode, canvas_x, canvas_y, canvas_zoom, last_opened_at, created_at
             FROM projects ORDER BY last_opened_at DESC",
        )
        .map_err(|e| format!("failed to prepare list query: {e}"))?;
    let rows = stmt
        .query_map([], row_to_project)
        .map_err(|e| format!("failed to list projects: {e}"))?;
    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|e| format!("failed to read project row: {e}"))?);
    }
    Ok(projects)
}

pub fn update(db: &Database, project: &Project) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE projects SET name = ?1, view_mode = ?2, canvas_x = ?3, canvas_y = ?4, canvas_zoom = ?5
         WHERE id = ?6",
        params![
            project.name,
            project.view_mode,
            project.canvas_x,
            project.canvas_y,
            project.canvas_zoom,
            project.id,
        ],
    )
    .map_err(|e| format!("failed to update project: {e}"))?;
    Ok(())
}

pub fn delete(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| format!("failed to delete project: {e}"))?;
    Ok(())
}

pub fn touch(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE projects SET last_opened_at = ?1 WHERE id = ?2",
        params![now(), id],
    )
    .map_err(|e| format!("failed to touch project: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn test_create_and_get() {
        let db = Database::open_memory().unwrap();
        let project = create(&db, "My Project", "/home/user/project").unwrap();

        assert_eq!(project.name, "My Project");
        assert_eq!(project.path, "/home/user/project");
        assert_eq!(project.view_mode, "canvas");
        assert_eq!(project.canvas_x, 0.0);
        assert_eq!(project.canvas_y, 0.0);
        assert_eq!(project.canvas_zoom, 1.0);

        let fetched = get_by_id(&db, project.id).unwrap().unwrap();
        assert_eq!(fetched.name, "My Project");
        assert_eq!(fetched.path, "/home/user/project");
    }

    #[test]
    fn test_get_by_path() {
        let db = Database::open_memory().unwrap();
        create(&db, "My Project", "/home/user/project").unwrap();

        let found = get_by_path(&db, "/home/user/project").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "My Project");

        let not_found = get_by_path(&db, "/nonexistent").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_list_ordered_by_last_opened() {
        let db = Database::open_memory().unwrap();
        let p1 = create(&db, "First", "/path/first").unwrap();
        let p2 = create(&db, "Second", "/path/second").unwrap();

        // Set p1's last_opened_at to a future date so it sorts first
        {
            let conn = db.conn();
            conn.execute(
                "UPDATE projects SET last_opened_at = ?1 WHERE id = ?2",
                params!["2099-01-01T00:00:00Z", p1.id],
            )
            .unwrap();
        }

        let projects = list(&db).unwrap();
        assert_eq!(projects.len(), 2);
        assert_eq!(projects[0].name, "First");
        assert_eq!(projects[1].name, "Second");
        let _ = p2;
    }

    #[test]
    fn test_update() {
        let db = Database::open_memory().unwrap();
        let mut project = create(&db, "Original", "/path/original").unwrap();

        project.view_mode = "board".to_string();
        project.canvas_zoom = 2.5;
        update(&db, &project).unwrap();

        let updated = get_by_id(&db, project.id).unwrap().unwrap();
        assert_eq!(updated.view_mode, "board");
        assert_eq!(updated.canvas_zoom, 2.5);
    }

    #[test]
    fn test_delete() {
        let db = Database::open_memory().unwrap();
        let project = create(&db, "To Delete", "/path/delete").unwrap();
        delete(&db, project.id).unwrap();

        let gone = get_by_id(&db, project.id).unwrap();
        assert!(gone.is_none());
    }

    #[test]
    fn test_unique_path_constraint() {
        let db = Database::open_memory().unwrap();
        create(&db, "First", "/same/path").unwrap();
        let result = create(&db, "Second", "/same/path");
        assert!(result.is_err());
    }
}
