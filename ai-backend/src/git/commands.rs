use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use super::types::*;

// ─── helpers ───────────────────────────────────────────────────────────────

/// Run a git command and return (stdout, stderr).  Returns Err if spawn fails.
/// Exit-code is NOT checked here so callers can decide.
pub(crate) fn run_git_unchecked(dir: &str, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to run git {}: {}", args.first().unwrap_or(&""), e))
}

/// Run a git command and return stdout as String.  Returns Err if exit-code != 0.
pub(crate) fn run_git(dir: &str, args: &[&str]) -> Result<String, String> {
    let out = run_git_unchecked(dir, args)?;
    if !out.status.success() {
        return Err(format!(
            "git {} failed: {}",
            args.first().unwrap_or(&""),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn parse_numstat(text: &str) -> (u32, u32) {
    let parts: Vec<&str> = text.split('\t').collect();
    let additions = parts.first().and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    let deletions = parts.get(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    (additions, deletions)
}

/// Parse batch numstat output into a file → (additions, deletions) map.
fn parse_batch_numstat(output: &std::process::Output) -> HashMap<String, (u32, u32)> {
    let mut map = HashMap::new();
    if !output.status.success() {
        return map;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() >= 3 {
            let additions = parts[0].parse::<u32>().unwrap_or(0);
            let deletions = parts[1].parse::<u32>().unwrap_or(0);
            map.insert(parts[2].to_string(), (additions, deletions));
        }
    }
    map
}

fn parse_diff_output(text: &str) -> Vec<DiffHunk> {
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;

    for line in text.lines() {
        if line.starts_with("diff --git")
            || line.starts_with("index ")
            || line.starts_with("--- ")
            || line.starts_with("+++ ")
            || line.starts_with("new file")
            || line.starts_with("old file")
        {
            continue;
        }

        if line.starts_with("@@") {
            let mut ol: u32 = 1;
            let mut nl: u32 = 1;
            if let Some(at_end) = line[2..].find("@@") {
                let header_part = line[2..2 + at_end].trim();
                for part in header_part.split_whitespace() {
                    if let Some(old) = part.strip_prefix('-') {
                        ol = old.split(',').next().and_then(|s| s.parse().ok()).unwrap_or(1);
                    } else if let Some(new) = part.strip_prefix('+') {
                        nl = new.split(',').next().and_then(|s| s.parse().ok()).unwrap_or(1);
                    }
                }
            }
            old_line = ol;
            new_line = nl;
            hunks.push(DiffHunk {
                header: line.to_string(),
                lines: Vec::new(),
            });
            continue;
        }

        if hunks.is_empty() {
            continue;
        }

        let hunk = hunks.last_mut().unwrap();

        if let Some(content) = line.strip_prefix('+') {
            hunk.lines.push(DiffLine {
                line_type: "+".to_string(),
                old_lineno: None,
                new_lineno: Some(new_line),
                content: content.to_string(),
            });
            new_line += 1;
        } else if let Some(content) = line.strip_prefix('-') {
            hunk.lines.push(DiffLine {
                line_type: "-".to_string(),
                old_lineno: Some(old_line),
                new_lineno: None,
                content: content.to_string(),
            });
            old_line += 1;
        } else if let Some(content) = line.strip_prefix(' ') {
            hunk.lines.push(DiffLine {
                line_type: " ".to_string(),
                old_lineno: Some(old_line),
                new_lineno: Some(new_line),
                content: content.to_string(),
            });
            old_line += 1;
            new_line += 1;
        } else {
            // no-newline marker etc.
            hunk.lines.push(DiffLine {
                line_type: " ".to_string(),
                old_lineno: Some(old_line),
                new_lineno: Some(new_line),
                content: line.to_string(),
            });
            old_line += 1;
            new_line += 1;
        }
    }

    hunks
}

// ─── public API ────────────────────────────────────────────────────────────

/// Returns true if `dir` is inside a git work-tree.
pub fn check_repo(dir: &str) -> bool {
    Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(dir)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// `git init` + `git add -A` + initial commit.
pub fn init(dir: &str) -> Result<(), String> {
    run_git(dir, &["init"])?;
    run_git(dir, &["add", "-A"])?;
    run_git(dir, &["commit", "--allow-empty", "-m", "Initial commit"])?;
    Ok(())
}

/// Branch, last commit, and upstream ahead/behind counts.
pub fn git_info(dir: &str) -> Result<GitInfo, String> {
    let branch = run_git_unchecked(dir, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "main".to_string());

    let log_line = run_git(dir, &["log", "-1", "--format=%h %s"])
        .unwrap_or_default();
    let log_line = log_line.trim();
    let (commit_hash, commit_message) = match log_line.split_once(' ') {
        Some((h, m)) => (h.to_string(), m.to_string()),
        None => (log_line.to_string(), String::new()),
    };

    let revlist = run_git_unchecked(dir, &["rev-list", "--left-right", "--count", "HEAD...@{u}"]);
    let (ahead, behind, has_upstream) = match revlist {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let parts: Vec<&str> = text.split('\t').collect();
            let a = parts.first().and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
            let b = parts.get(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
            (a, b, true)
        }
        _ => (0, 0, false),
    };

    Ok(GitInfo {
        branch,
        commit_hash,
        commit_message,
        ahead,
        behind,
        has_upstream,
    })
}

/// All changed files with their add/del line counts.
pub fn git_changes(dir: &str) -> Result<Vec<FileChange>, String> {
    let stdout = run_git(dir, &["status", "--porcelain", "-u"])?;

    // Batch: get all unstaged and staged numstats in 2 subprocess calls
    let unstaged_out = run_git_unchecked(dir, &["diff", "--numstat"])?;
    let unstaged_map = parse_batch_numstat(&unstaged_out);

    let cached_out = run_git_unchecked(dir, &["diff", "--cached", "--numstat"])?;
    let cached_map = parse_batch_numstat(&cached_out);

    let mut changes: Vec<FileChange> = Vec::new();

    for line in stdout.lines() {
        if line.len() < 3 {
            continue;
        }
        let status_code = &line[..2];
        let file_path = line[3..].trim().to_string();

        let status = match status_code.trim() {
            "M" | "MM" | "AM" => "M",
            "A" => "A",
            "D" => "D",
            "R" | "RM" => "R",
            "U" | "UU" | "AA" | "DD" => "U",
            "??" => "?",
            s if s.contains('M') => "M",
            s if s.contains('A') => "A",
            s if s.contains('D') => "D",
            _ => "?",
        }
        .to_string();

        // Look up from batch numstat maps instead of per-file subprocesses
        let (mut additions, mut deletions) = unstaged_map
            .get(&file_path)
            .copied()
            .or_else(|| cached_map.get(&file_path).copied())
            .unwrap_or((0, 0));

        // untracked: count file lines as additions
        if status == "?" && additions == 0 && deletions == 0 {
            let full = Path::new(dir).join(&file_path);
            if let Ok(content) = std::fs::read_to_string(&full) {
                additions = content.lines().count() as u32;
                deletions = 0;
            }
        }

        changes.push(FileChange {
            path: file_path,
            status,
            additions,
            deletions,
        });
    }

    Ok(changes)
}

/// Full diff for a single file: unstaged → cached → untracked fallback.
pub fn git_diff(dir: &str, file: &str) -> Result<DiffOutput, String> {
    let run_diff = |args: &[&str]| -> String {
        run_git_unchecked(dir, args)
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default()
    };

    let mut diff_text = run_diff(&["diff", "--", file]);
    if diff_text.is_empty() {
        diff_text = run_diff(&["diff", "--cached", "--", file]);
    }
    if diff_text.is_empty() {
        diff_text = run_diff(&["diff", "--no-index", "/dev/null", file]);
    }

    Ok(DiffOutput {
        file_path: file.to_string(),
        hunks: parse_diff_output(&diff_text),
    })
}

/// `git add -- <file>`
pub fn stage_file(dir: &str, file: &str) -> Result<(), String> {
    run_git(dir, &["add", "--", file])?;
    Ok(())
}

/// `git reset HEAD -- <file>`
pub fn unstage_file(dir: &str, file: &str) -> Result<(), String> {
    run_git(dir, &["reset", "HEAD", "--", file])?;
    Ok(())
}

/// Tracked files: `git checkout --`; untracked files: remove from fs.
pub fn discard_file(dir: &str, file: &str) -> Result<(), String> {
    // Check if tracked
    let ls = run_git_unchecked(dir, &["ls-files", "--", file])?;
    let tracked = !String::from_utf8_lossy(&ls.stdout).trim().is_empty();

    if tracked {
        run_git(dir, &["checkout", "--", file])?;
    } else {
        let full = Path::new(dir).join(file);
        std::fs::remove_file(&full)
            .map_err(|e| format!("Failed to remove untracked file: {}", e))?;
    }
    Ok(())
}

/// `git add -A` + `git commit -m <message>` — returns short commit hash.
pub fn commit(dir: &str, message: &str) -> Result<String, String> {
    run_git(dir, &["add", "-A"])?;

    let out = run_git_unchecked(dir, &["commit", "-m", message])?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        if stderr.contains("nothing to commit") {
            return Err("Nothing to commit".to_string());
        }
        return Err(format!(
            "git commit failed: {}",
            stderr.trim()
        ));
    }

    let hash = run_git(dir, &["rev-parse", "--short", "HEAD"])?
        .trim()
        .to_string();
    Ok(hash)
}

/// All local + remote branches with ahead/behind info.
pub fn branches(dir: &str) -> Result<Vec<BranchInfo>, String> {
    let stdout = run_git(
        dir,
        &[
            "branch",
            "-a",
            "--format=%(HEAD) %(refname:short) %(upstream:track) %(committerdate:relative)",
        ],
    )?;

    let mut result: Vec<BranchInfo> = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let is_current = line.starts_with('*');
        // Skip leading `* ` or `  `
        let rest = &line[2..];

        let parts: Vec<&str> = rest.splitn(2, ' ').collect();
        let name = parts.first().unwrap_or(&"").to_string();

        if name.contains("HEAD") {
            continue;
        }

        let remaining = parts.get(1).unwrap_or(&"").to_string();
        let is_remote = name.starts_with("remotes/") || name.contains("origin/");
        let display_name = name.strip_prefix("remotes/").unwrap_or(&name).to_string();

        let mut ahead: Option<i32> = None;
        let mut behind: Option<i32> = None;
        let mut last_commit_time = remaining.clone();

        if let Some(bracket_start) = remaining.find('[') {
            if let Some(bracket_end) = remaining.find(']') {
                let track = &remaining[bracket_start + 1..bracket_end];
                for part in track.split(',') {
                    let part = part.trim();
                    if let Some(n) = part.strip_prefix("ahead ") {
                        ahead = n.trim().parse::<i32>().ok();
                    } else if let Some(n) = part.strip_prefix("behind ") {
                        behind = n.trim().parse::<i32>().ok();
                    }
                }
                last_commit_time = remaining[bracket_end + 1..].trim().to_string();
            }
        }

        result.push(BranchInfo {
            name: display_name,
            is_current,
            is_remote,
            last_commit_time,
            ahead,
            behind,
        });
    }

    result.sort_by(|a, b| {
        b.is_current
            .cmp(&a.is_current)
            .then_with(|| a.is_remote.cmp(&b.is_remote))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}

/// List all tracked files in the repository
pub fn file_tree(dir: &str) -> Result<Vec<String>, String> {
    let has_commits = run_git_unchecked(dir, &["rev-parse", "--verify", "HEAD"])
        .map(|o| o.status.success())
        .unwrap_or(false);
    if has_commits {
        let output = run_git(dir, &["ls-tree", "-r", "--name-only", "HEAD"])?;
        return Ok(output.lines().map(|l| l.to_string()).collect());
    }
    // No commits yet — walk the directory, skipping common ignored dirs
    let root = std::path::Path::new(dir);
    let mut files = Vec::new();
    let skip = [".git", "node_modules", "target", "dist", "build", ".ai-studio"];
    fn walk(base: &std::path::Path, current: &std::path::Path, skip: &[&str], out: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(current) else { return };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if skip.contains(&name.as_str()) { continue; }
            let path = entry.path();
            if path.is_dir() {
                walk(base, &path, skip, out);
            } else if let Ok(rel) = path.strip_prefix(base) {
                out.push(rel.to_string_lossy().to_string());
            }
        }
    }
    walk(root, root, &skip, &mut files);
    files.sort();
    Ok(files)
}

/// Read file content from git or working tree
pub fn file_content(dir: &str, path: &str, git_ref: Option<&str>) -> Result<String, String> {
    match git_ref {
        Some(r) => run_git(dir, &["show", &format!("{}:{}", r, path)]),
        None => {
            let full_path = std::path::Path::new(dir).join(path);
            match std::fs::read_to_string(&full_path) {
                Ok(content) => Ok(content),
                Err(_) => {
                    // Fallback: try reading from HEAD in git
                    run_git(dir, &["show", &format!("HEAD:{}", path)])
                        .map_err(|_| format!("Failed to read {}: file not found in working tree or git", path))
                }
            }
        }
    }
}

/// Last `count` commits with file lists and branch labels.
pub fn log(dir: &str, count: u32) -> Result<Vec<CommitInfo>, String> {
    // Empty repo: no commits yet
    let has_commits = run_git_unchecked(dir, &["rev-parse", "--verify", "HEAD"])
        .map(|o| o.status.success())
        .unwrap_or(false);
    if !has_commits {
        return Ok(Vec::new());
    }

    // Build hash → branch name map
    let branch_stdout = run_git_unchecked(dir, &["branch", "-a", "--format=%(objectname:short) %(refname:short)"])?;
    let mut branch_map: HashMap<String, Vec<String>> = HashMap::new();
    if branch_stdout.status.success() {
        for line in String::from_utf8_lossy(&branch_stdout.stdout).lines() {
            let line = line.trim();
            if let Some((hash, name)) = line.split_once(' ') {
                if !name.contains("HEAD") {
                    branch_map.entry(hash.to_string()).or_default().push(name.to_string());
                }
            }
        }
    }

    let format_arg = format!("-n{}", count);
    let log_stdout = run_git(
        dir,
        &[
            "log",
            &format_arg,
            "--format=COMMIT_START%n%h%n%s%n%an%n%ar",
            "--name-status",
        ],
    )?;

    let mut commits: Vec<CommitInfo> = Vec::new();
    for block in log_stdout.split("COMMIT_START\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }
        let mut lines = block.lines();
        let hash = match lines.next() {
            Some(h) => h.trim().to_string(),
            None => continue,
        };
        let message = lines.next().unwrap_or("").trim().to_string();
        let author = lines.next().unwrap_or("").trim().to_string();
        let date = lines.next().unwrap_or("").trim().to_string();

        let mut files: Vec<CommitFile> = Vec::new();
        for file_line in lines {
            let file_line = file_line.trim();
            if file_line.is_empty() {
                continue;
            }
            if let Some((status, path)) = file_line.split_once('\t') {
                files.push(CommitFile {
                    path: path.to_string(),
                    status: status.chars().next().unwrap_or('M').to_string(),
                });
            }
        }

        let branch_labels = branch_map.get(&hash).cloned().unwrap_or_default();
        commits.push(CommitInfo {
            hash,
            message,
            author,
            date,
            branches: branch_labels,
            files,
        });
    }

    Ok(commits)
}
