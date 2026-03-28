use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

use crate::protocol::OutgoingMessage;

fn classify_event(path: &Path, repo_root: &Path) -> Option<&'static str> {
    let rel = path.strip_prefix(repo_root).ok()?;
    let rel_str = rel.to_string_lossy();

    if rel_str.starts_with(".git/objects")
        || rel_str.starts_with("node_modules")
        || rel_str.starts_with("build")
        || rel_str.starts_with("dist")
        || rel_str.starts_with(".meka-flow")
    {
        return None;
    }

    if rel_str == ".git/HEAD" {
        return Some("head");
    }
    if rel_str.starts_with(".git/refs") {
        return Some("refs");
    }
    if rel_str == ".git/index" || !rel_str.starts_with(".git") {
        return Some("files");
    }

    None
}

struct WatcherEntry {
    _watcher: RecommendedWatcher,
}

pub struct GitWatcherManager {
    watchers: Arc<Mutex<HashMap<String, WatcherEntry>>>,
}

impl GitWatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn watch(
        &self,
        dir: &str,
        event_tx: mpsc::UnboundedSender<OutgoingMessage>,
    ) -> Result<(), String> {
        let dir_string = dir.to_string();
        let repo_root = PathBuf::from(dir);

        {
            let watchers = self.watchers.lock().unwrap();
            if watchers.contains_key(dir) {
                return Ok(());
            }
        }

        let debounce_state: Arc<Mutex<HashMap<String, Instant>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let debounce_ms = Duration::from_millis(500);

        let tx = event_tx.clone();
        let root = repo_root.clone();
        let dir_for_event = dir_string.clone();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    for path in &event.paths {
                        if let Some(kind) = classify_event(path, &root) {
                            let mut state = debounce_state.lock().unwrap();
                            let now = Instant::now();
                            if let Some(last) = state.get(kind) {
                                if now.duration_since(*last) < debounce_ms {
                                    continue;
                                }
                            }
                            state.insert(kind.to_string(), now);

                            let payload = serde_json::json!({
                                "dir": dir_for_event,
                                "kind": kind,
                            });
                            let msg = crate::protocol::Event::new("git.changed", payload);
                            let _ = tx.send(msg);
                        }
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&repo_root, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        let git_dir = repo_root.join(".git");
        if git_dir.exists() {
            let _ = watcher.watch(&git_dir, RecursiveMode::Recursive);
        }

        let mut watchers = self.watchers.lock().unwrap();
        watchers.insert(
            dir_string,
            WatcherEntry {
                _watcher: watcher,
            },
        );

        Ok(())
    }

    pub fn unwatch(&self, dir: &str) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.remove(dir);
        Ok(())
    }
}
