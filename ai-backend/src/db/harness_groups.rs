use rusqlite::{params, OptionalExtension};
use super::types::DbHarnessGroup;
use super::Database;

fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn row_to_group(row: &rusqlite::Row) -> rusqlite::Result<DbHarnessGroup> {
    Ok(DbHarnessGroup {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        connections_json: row.get(3)?,
        max_retries: row.get(4)?,
        status: row.get(5)?,
        current_sprint: row.get(6)?,
        current_round: row.get(7)?,
        harness_dir: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn create(db: &Database, group: &DbHarnessGroup) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO harness_groups (id, project_id, name, connections_json, max_retries, status, current_sprint, current_round, harness_dir, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            group.id,
            group.project_id,
            group.name,
            group.connections_json,
            group.max_retries,
            group.status,
            group.current_sprint,
            group.current_round,
            group.harness_dir,
            group.created_at,
            group.updated_at,
        ],
    )
    .map_err(|e| format!("failed to create harness group: {e}"))?;
    Ok(())
}

pub fn get_by_id(db: &Database, id: &str) -> Result<Option<DbHarnessGroup>, String> {
    let conn = db.conn();
    conn.query_row(
        "SELECT id, project_id, name, connections_json, max_retries, status, current_sprint, current_round, harness_dir, created_at, updated_at
         FROM harness_groups WHERE id = ?1",
        params![id],
        row_to_group,
    )
    .optional()
    .map_err(|e| format!("failed to get harness group: {e}"))
}

pub fn list_by_project(db: &Database, project_id: i64) -> Result<Vec<DbHarnessGroup>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, connections_json, max_retries, status, current_sprint, current_round, harness_dir, created_at, updated_at
             FROM harness_groups WHERE project_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| format!("failed to prepare list query: {e}"))?;
    let rows = stmt
        .query_map(params![project_id], row_to_group)
        .map_err(|e| format!("failed to list harness groups: {e}"))?;
    let mut groups = Vec::new();
    for row in rows {
        groups.push(row.map_err(|e| format!("failed to read harness group row: {e}"))?);
    }
    Ok(groups)
}

pub fn update(db: &Database, group: &DbHarnessGroup) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE harness_groups SET project_id = ?1, name = ?2, connections_json = ?3, max_retries = ?4, status = ?5, current_sprint = ?6, current_round = ?7, harness_dir = ?8, updated_at = ?9
         WHERE id = ?10",
        params![
            group.project_id,
            group.name,
            group.connections_json,
            group.max_retries,
            group.status,
            group.current_sprint,
            group.current_round,
            group.harness_dir,
            now(),
            group.id,
        ],
    )
    .map_err(|e| format!("failed to update harness group: {e}"))?;
    Ok(())
}

pub fn delete(db: &Database, id: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM harness_groups WHERE id = ?1", params![id])
        .map_err(|e| format!("failed to delete harness group: {e}"))?;
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

    fn make_group(project_id: i64) -> DbHarnessGroup {
        DbHarnessGroup {
            id: uuid::Uuid::new_v4().to_string(),
            project_id,
            name: "Test Group".to_string(),
            connections_json: r#"[{"id":"c1","fromSessionId":"s1","toSessionId":"s2","fromRole":"planner","toRole":"generator"}]"#.to_string(),
            max_retries: 3,
            status: "idle".to_string(),
            current_sprint: 0,
            current_round: 0,
            harness_dir: "/tmp/harness".to_string(),
            created_at: now(),
            updated_at: now(),
        }
    }

    #[test]
    fn test_create_and_get() {
        let (db, project_id) = setup();
        let group = make_group(project_id);
        let group_id = group.id.clone();
        create(&db, &group).unwrap();

        let fetched = get_by_id(&db, &group_id).unwrap().unwrap();
        assert_eq!(fetched.id, group_id);
        assert_eq!(fetched.project_id, project_id);
        assert_eq!(fetched.name, "Test Group");
        assert_eq!(fetched.status, "idle");
        assert_eq!(fetched.max_retries, 3);
        assert!(fetched.connections_json.contains("planner"));
    }

    #[test]
    fn test_list_by_project() {
        let (db, project_id) = setup();
        let g1 = make_group(project_id);
        let g2 = make_group(project_id);
        create(&db, &g1).unwrap();
        create(&db, &g2).unwrap();

        let groups = list_by_project(&db, project_id).unwrap();
        assert_eq!(groups.len(), 2);
    }

    #[test]
    fn test_update() {
        let (db, project_id) = setup();
        let mut group = make_group(project_id);
        let group_id = group.id.clone();
        create(&db, &group).unwrap();

        group.name = "Updated Group".to_string();
        group.status = "running".to_string();
        group.connections_json = "[]".to_string();
        update(&db, &group).unwrap();

        let fetched = get_by_id(&db, &group_id).unwrap().unwrap();
        assert_eq!(fetched.name, "Updated Group");
        assert_eq!(fetched.status, "running");
        assert_eq!(fetched.connections_json, "[]");
    }

    #[test]
    fn test_delete() {
        let (db, project_id) = setup();
        let group = make_group(project_id);
        let group_id = group.id.clone();
        create(&db, &group).unwrap();

        delete(&db, &group_id).unwrap();

        let gone = get_by_id(&db, &group_id).unwrap();
        assert!(gone.is_none());
    }

    #[test]
    fn test_cascade_delete_with_project() {
        let (db, project_id) = setup();
        let group = make_group(project_id);
        let group_id = group.id.clone();
        create(&db, &group).unwrap();

        crate::db::projects::delete(&db, project_id).unwrap();

        let gone = get_by_id(&db, &group_id).unwrap();
        assert!(gone.is_none());
    }
}
