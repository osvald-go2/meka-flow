use std::path::{Path, PathBuf};
use std::process::Command;

use super::commands::run_git_unchecked;
use super::types::{BranchDiffStats, WorktreeInfo};

// ─── helpers ────────────────────────────────────────────────────────────────

/// Read base branch from `.meka-flow-meta.json`, fallback to main/master.
fn read_base_branch(dir: &str) -> String {
    let meta_path = Path::new(dir).join(".meka-flow-meta.json");
    if let Ok(content) = std::fs::read_to_string(&meta_path) {
        if let Some(start) = content.find("\"baseBranch\"") {
            let rest = &content[start..];
            if let Some(colon) = rest.find(':') {
                let after = rest[colon + 1..].trim();
                if after.starts_with('"') {
                    if let Some(end) = after[1..].find('"') {
                        let branch = &after[1..1 + end];
                        if !branch.is_empty() {
                            return branch.to_string();
                        }
                    }
                }
            }
        }
    }

    // Fallback: check main then master
    let main_ok = Command::new("git")
        .args(["rev-parse", "--verify", "main"])
        .current_dir(dir)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if main_ok {
        return "main".to_string();
    }

    let master_ok = Command::new("git")
        .args(["rev-parse", "--verify", "master"])
        .current_dir(dir)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if master_ok {
        return "master".to_string();
    }

    "main".to_string()
}

// ─── public API ─────────────────────────────────────────────────────────────

/// Parse `git worktree list --porcelain` and return structured info.
pub fn list_worktrees(dir: &str) -> Result<Vec<WorktreeInfo>, String> {
    let out = Command::new("git")
        .args(["worktree", "list", "--porcelain"])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to list worktrees: {}", e))?;

    if !out.status.success() {
        return Err(format!(
            "git worktree list failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let canonical_dir = std::fs::canonicalize(dir)
        .unwrap_or_else(|_| Path::new(dir).to_path_buf());

    let mut worktrees: Vec<WorktreeInfo> = Vec::new();
    let mut current_path = String::new();
    let mut current_hash = String::new();
    let mut current_branch = String::new();
    let mut is_bare = false;
    let mut is_first = true;

    let flush = |wt_path: &str,
                 hash: &str,
                 branch: &str,
                 canonical_dir: &PathBuf,
                 is_first: bool,
                 worktrees: &mut Vec<WorktreeInfo>| {
        let msg = Command::new("git")
            .args(["log", "-1", "--format=%s"])
            .current_dir(wt_path)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let canonical_wt = std::fs::canonicalize(wt_path)
            .unwrap_or_else(|_| Path::new(wt_path).to_path_buf());
        let is_current = canonical_wt == *canonical_dir;

        worktrees.push(WorktreeInfo {
            branch: branch.to_string(),
            path: wt_path.to_string(),
            commit_hash: hash.to_string(),
            commit_message: msg,
            is_main: is_first,
            is_current,
        });
    };

    for line in stdout.lines() {
        if line.starts_with("worktree ") {
            current_path = line.strip_prefix("worktree ").unwrap_or("").to_string();
        } else if line.starts_with("HEAD ") {
            let h = line.strip_prefix("HEAD ").unwrap_or("");
            current_hash = h.chars().take(7).collect();
        } else if line.starts_with("branch ") {
            let b = line.strip_prefix("branch ").unwrap_or("");
            current_branch = b.strip_prefix("refs/heads/").unwrap_or(b).to_string();
        } else if line == "bare" {
            is_bare = true;
        } else if line.is_empty() && !current_path.is_empty() {
            if !is_bare {
                flush(
                    &current_path,
                    &current_hash,
                    &current_branch,
                    &canonical_dir,
                    is_first,
                    &mut worktrees,
                );
            }
            current_path.clear();
            current_hash.clear();
            current_branch.clear();
            is_bare = false;
            is_first = false;
        }
    }

    // Handle last block if no trailing newline
    if !current_path.is_empty() && !is_bare {
        flush(
            &current_path,
            &current_hash,
            &current_branch,
            &canonical_dir,
            is_first,
            &mut worktrees,
        );
    }

    Ok(worktrees)
}

/// Create (or locate) a worktree for `branch`, based on `base`.
/// Returns the worktree path on success.
pub fn create_worktree(project_dir: &str, branch: &str, base: &str) -> Result<String, String> {
    // 1. Does the branch already exist?
    let check = Command::new("git")
        .args(["branch", "--list", branch])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to check branch: {}", e))?;
    let branch_exists = !String::from_utf8_lossy(&check.stdout).trim().is_empty();

    // 2. If branch exists, see if a worktree is already attached
    if branch_exists {
        let wt_list = Command::new("git")
            .args(["worktree", "list", "--porcelain"])
            .current_dir(project_dir)
            .output()
            .map_err(|e| format!("Failed to list worktrees: {}", e))?;

        let wt_output = String::from_utf8_lossy(&wt_list.stdout).to_string();
        let expected_ref = format!("refs/heads/{}", branch);

        for block in wt_output.split("\n\n") {
            let block = block.trim();
            if block.is_empty() {
                continue;
            }
            let mut wt_path: Option<&str> = None;
            let mut wt_branch: Option<&str> = None;
            for l in block.lines() {
                if let Some(p) = l.strip_prefix("worktree ") {
                    wt_path = Some(p);
                }
                if let Some(b) = l.strip_prefix("branch ") {
                    wt_branch = Some(b);
                }
            }
            if wt_branch == Some(&expected_ref) {
                if let Some(p) = wt_path {
                    let canonical = std::fs::canonicalize(p)
                        .unwrap_or_else(|_| PathBuf::from(p));
                    return Ok(canonical.to_string_lossy().to_string());
                }
            }
        }
    }

    // 3. Compute worktree path: .meka-flow/worktrees/<safe_branch>
    let safe_branch = branch.replace('/', "-");
    let worktrees_dir = Path::new(project_dir)
        .join(".meka-flow")
        .join("worktrees");
    std::fs::create_dir_all(&worktrees_dir)
        .map_err(|e| format!("Failed to create worktrees directory: {}", e))?;
    let wt_path = worktrees_dir.join(&safe_branch);
    let wt_str = wt_path.to_string_lossy().to_string();

    // 4. Create worktree
    let (meta_base, output) = if branch_exists {
        // Attach existing branch
        let out = Command::new("git")
            .args(["worktree", "add", &wt_str, branch])
            .current_dir(project_dir)
            .output()
            .map_err(|e| format!("Failed to create worktree: {}", e))?;
        (branch.to_string(), out)
    } else {
        // New branch from base
        let out = Command::new("git")
            .args(["worktree", "add", "-b", branch, &wt_str, base])
            .current_dir(project_dir)
            .output()
            .map_err(|e| format!("Failed to create worktree: {}", e))?;
        (base.to_string(), out)
    };

    if !output.status.success() {
        return Err(format!(
            "git worktree add failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    // 5. Write .meka-flow-meta.json
    let meta_path = wt_path.join(".meka-flow-meta.json");
    let meta_content = format!("{{\"baseBranch\":\"{}\"}}", meta_base);
    std::fs::write(&meta_path, &meta_content)
        .map_err(|e| format!("Failed to write .meka-flow-meta.json: {}", e))?;

    // 6. Add .meka-flow-meta.json to .gitignore
    let gitignore_path = wt_path.join(".gitignore");
    let needs_entry = if gitignore_path.exists() {
        let content = std::fs::read_to_string(&gitignore_path).unwrap_or_default();
        !content.lines().any(|l| l.trim() == ".meka-flow-meta.json")
    } else {
        true
    };
    if needs_entry {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&gitignore_path)
            .map_err(|e| format!("Failed to open .gitignore: {}", e))?;
        if gitignore_path.exists() {
            let content = std::fs::read_to_string(&gitignore_path).unwrap_or_default();
            if !content.is_empty() && !content.ends_with('\n') {
                writeln!(file).map_err(|e| format!("Failed to write .gitignore: {}", e))?;
            }
        }
        writeln!(file, ".meka-flow-meta.json")
            .map_err(|e| format!("Failed to write .gitignore: {}", e))?;
    }

    // 7. Return canonical path
    let canonical = std::fs::canonicalize(&wt_path).unwrap_or(wt_path);
    Ok(canonical.to_string_lossy().to_string())
}

/// Merge a worktree branch into `target` (defaults to base branch from meta).
/// On conflict, `git merge --abort` is called automatically.
pub fn merge_worktree(
    project_dir: &str,
    wt_path: &str,
    target: Option<&str>,
) -> Result<String, String> {
    // Get worktree branch name
    let branch_out = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(wt_path)
        .output()
        .map_err(|e| format!("Failed to get worktree branch: {}", e))?;
    if !branch_out.status.success() {
        return Err(format!(
            "Failed to get worktree branch: {}",
            String::from_utf8_lossy(&branch_out.stderr).trim()
        ));
    }
    let wt_branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();

    let target_branch = target
        .map(|s| s.to_string())
        .unwrap_or_else(|| read_base_branch(wt_path));

    // Checkout target in project_dir
    let checkout = Command::new("git")
        .args(["checkout", &target_branch])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to checkout target branch: {}", e))?;
    if !checkout.status.success() {
        return Err(format!(
            "切换到目标分支失败: {}",
            String::from_utf8_lossy(&checkout.stderr).trim()
        ));
    }

    // Merge
    let merge = Command::new("git")
        .args(["merge", &wt_branch])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to merge: {}", e))?;
    if !merge.status.success() {
        let _ = Command::new("git")
            .args(["merge", "--abort"])
            .current_dir(project_dir)
            .output();
        return Err(format!(
            "合并冲突，已自动中止合并。请手动解决冲突后重试。\n{}",
            String::from_utf8_lossy(&merge.stderr).trim()
        ));
    }

    Ok(format!("成功将分支 '{}' 合并到 '{}'", wt_branch, target_branch))
}

/// Remove a worktree and delete its branch.
pub fn remove_worktree(
    project_dir: &str,
    wt_path: &str,
    branch: &str,
) -> Result<String, String> {
    let remove = Command::new("git")
        .args(["worktree", "remove", wt_path, "--force"])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to remove worktree: {}", e))?;
    if !remove.status.success() {
        return Err(format!(
            "删除工作树失败: {}",
            String::from_utf8_lossy(&remove.stderr).trim()
        ));
    }

    let delete = Command::new("git")
        .args(["branch", "-D", branch])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to delete branch: {}", e))?;
    if !delete.status.success() {
        return Err(format!(
            "删除分支失败: {}",
            String::from_utf8_lossy(&delete.stderr).trim()
        ));
    }

    Ok(format!("已删除工作树和分支 '{}'", branch))
}

/// Aggregate add/del stats: committed diff vs base + unstaged + cached + untracked.
pub fn branch_diff_stats(
    dir: &str,
    base_branch: Option<&str>,
) -> Result<BranchDiffStats, String> {
    let base = base_branch
        .map(|s| s.to_string())
        .unwrap_or_else(|| read_base_branch(dir));

    let diff_arg = format!("{}...HEAD", base);
    let out = Command::new("git")
        .args(["diff", &diff_arg, "--numstat"])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;
    if !out.status.success() {
        return Err(format!(
            "git diff failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    let mut additions: u64 = 0;
    let mut deletions: u64 = 0;

    let count_numstat = |stdout: &str, add: &mut u64, del: &mut u64| {
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 2 {
                if let Ok(a) = parts[0].parse::<u64>() {
                    *add += a;
                }
                if let Ok(d) = parts[1].parse::<u64>() {
                    *del += d;
                }
            }
        }
    };

    count_numstat(
        &String::from_utf8_lossy(&out.stdout),
        &mut additions,
        &mut deletions,
    );

    // Unstaged
    if let Ok(o) = run_git_unchecked(dir, &["diff", "--numstat"]) {
        if o.status.success() {
            count_numstat(
                &String::from_utf8_lossy(&o.stdout),
                &mut additions,
                &mut deletions,
            );
        }
    }

    // Staged
    if let Ok(o) = run_git_unchecked(dir, &["diff", "--cached", "--numstat"]) {
        if o.status.success() {
            count_numstat(
                &String::from_utf8_lossy(&o.stdout),
                &mut additions,
                &mut deletions,
            );
        }
    }

    // Untracked: count lines
    if let Ok(o) = run_git_unchecked(dir, &["ls-files", "--others", "--exclude-standard"]) {
        if o.status.success() {
            for file in String::from_utf8_lossy(&o.stdout).lines() {
                let full = Path::new(dir).join(file);
                if let Ok(content) = std::fs::read_to_string(&full) {
                    additions += content.lines().count() as u64;
                }
            }
        }
    }

    Ok(BranchDiffStats {
        additions,
        deletions,
        base_branch: base,
    })
}
