use crate::framework::{paths::AppPaths, FrameworkError, Result};
use std::{
  fs,
  path::{Component, Path, PathBuf},
};

pub fn resolve_managed_path(paths: &AppPaths, candidate: &Path) -> Result<PathBuf> {
  let raw = if candidate.as_os_str().is_empty() {
    paths.data_dir.clone()
  } else if candidate.is_absolute() {
    candidate.to_path_buf()
  } else {
    paths.data_dir.join(candidate)
  };

  let normalized = normalize_path(&raw);
  let allowed = paths
    .managed_roots()
    .into_iter()
    .map(|root| normalize_path(&root))
    .any(|root| normalized.starts_with(&root));

  if allowed {
    return Ok(normalized);
  }

  Err(FrameworkError::PolicyViolation {
    path: normalized,
    reason: "path is outside managed runtime directories".to_string(),
  })
}

pub fn ensure_parent_directory(path: &Path) -> Result<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }

  Ok(())
}

pub fn ensure_not_managed_root(paths: &AppPaths, candidate: &Path) -> Result<()> {
  let normalized = normalize_path(candidate);
  let is_root = paths
    .managed_roots()
    .into_iter()
    .map(|root| normalize_path(&root))
    .any(|root| normalized == root);

  if is_root {
    return Err(FrameworkError::PolicyViolation {
      path: normalized,
      reason: "managed root directories cannot be modified directly".to_string(),
    });
  }

  Ok(())
}

pub fn validate_command_spawn(command: &str, args: &[String]) -> Result<()> {
  let normalized = command.trim().to_ascii_lowercase();
  if normalized.is_empty() {
    return Err(FrameworkError::ValidationFailed(
      "command must not be empty".to_string(),
    ));
  }

  let _ = args;

  #[cfg(windows)]
  let allowed = matches!(normalized.as_str(), "cmd" | "cmd.exe" | "where" | "where.exe");

  #[cfg(not(windows))]
  let allowed = matches!(normalized.as_str(), "sh" | "/bin/sh" | "which" | "/usr/bin/which");

  if allowed {
    return Ok(());
  }

  Err(FrameworkError::PolicyDenied {
    resource: command.to_string(),
    reason: "command spawn is not allowed".to_string(),
  })
}

pub fn validate_working_directory(working_directory: Option<&Path>) -> Result<()> {
  let Some(directory) = working_directory else {
    return Ok(());
  };

  let metadata = fs::metadata(directory)
    .map_err(|_| FrameworkError::NotFound(format!("working directory not found: {}", directory.display())))?;

  if metadata.is_dir() {
    return Ok(());
  }

  Err(FrameworkError::ValidationFailed(format!(
    "working directory is not a directory: {}",
    directory.display()
  )))
}

fn normalize_path(path: &Path) -> PathBuf {
  let mut normalized = PathBuf::new();

  for component in path.components() {
    match component {
      Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
      Component::RootDir => normalized.push(Path::new(std::path::MAIN_SEPARATOR_STR)),
      Component::CurDir => {}
      Component::ParentDir => {
        normalized.pop();
      }
      Component::Normal(value) => normalized.push(value),
    }
  }

  normalized
}

#[cfg(test)]
mod tests {
  use super::{ensure_not_managed_root, resolve_managed_path, validate_command_spawn};
  use crate::framework::paths::resolve_paths_for_root;

  #[test]
  fn resolves_relative_path_inside_data_dir() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");

    let resolved = resolve_managed_path(&paths, std::path::Path::new("notes/readme.txt")).expect("resolved path");

    assert_eq!(resolved, paths.data_dir.join("notes").join("readme.txt"));
  }

  #[test]
  fn rejects_path_outside_managed_roots() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let outside = root.path().join("outside.txt");

    let error = resolve_managed_path(&paths, &outside).expect_err("policy failure");

    assert!(error.to_string().contains("outside managed runtime directories"));
  }

  #[test]
  fn rejects_direct_managed_root_mutation() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");

    let error = ensure_not_managed_root(&paths, &paths.data_dir).expect_err("managed root protected");

    assert!(error.to_string().contains("managed root directories cannot be modified directly"));
  }

  #[test]
  fn rejects_spawn_for_unknown_command() {
    let error = validate_command_spawn("powershell", &["-Command".to_string(), "Get-Process".to_string()])
      .expect_err("policy should deny unknown command");

    assert!(error.to_string().contains("not allowed"));
  }
}
