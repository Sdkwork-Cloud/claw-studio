use crate::framework::{paths::AppPaths, FrameworkError, Result};
use std::{
  ffi::OsString,
  fs,
  path::{Component, Path, PathBuf},
};

#[derive(Clone, Debug)]
pub struct ExecutionPolicy {
  default_working_directory: PathBuf,
  managed_roots: Vec<PathBuf>,
}

impl ExecutionPolicy {
  pub fn for_paths(paths: &AppPaths) -> Result<Self> {
    let default_working_directory = canonicalize_directory(&paths.data_dir)?;
    let managed_roots = paths
      .managed_roots()
      .into_iter()
      .map(|root| canonicalize_directory(&root))
      .collect::<Result<Vec<_>>>()?;

    Ok(Self {
      default_working_directory,
      managed_roots,
    })
  }

  pub fn validate_command_spawn(&self, command: &str, args: &[String]) -> Result<()> {
    let _ = self;
    validate_command_spawn(command, args)
  }

  pub fn resolve_working_directory(&self, working_directory: Option<&Path>) -> Result<PathBuf> {
    let directory = match working_directory {
      Some(directory) => canonicalize_directory(directory)?,
      None => self.default_working_directory.clone(),
    };

    if self.managed_roots.iter().any(|root| directory.starts_with(root)) {
      return Ok(directory);
    }

    Err(FrameworkError::PolicyViolation {
      path: directory,
      reason: "path is outside managed runtime directories".to_string(),
    })
  }

  pub fn sanitize_environment<I>(&self, entries: I) -> Vec<(OsString, OsString)>
  where
    I: IntoIterator<Item = (OsString, OsString)>,
  {
    let _ = self;

    entries
      .into_iter()
      .filter(|(key, _)| is_allowed_environment_key(key))
      .collect()
  }
}

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

fn canonicalize_directory(path: &Path) -> Result<PathBuf> {
  let metadata = fs::metadata(path).map_err(|_| FrameworkError::NotFound(format!("working directory not found: {}", path.display())))?;
  if !metadata.is_dir() {
    return Err(FrameworkError::ValidationFailed(format!(
      "working directory is not a directory: {}",
      path.display()
    )));
  }

  fs::canonicalize(path).map_err(FrameworkError::from)
}

fn is_allowed_environment_key(key: &std::ffi::OsStr) -> bool {
  let key = key.to_string_lossy();

  #[cfg(windows)]
  return matches_ci(&key, &["PATH", "SystemRoot", "ComSpec", "PATHEXT", "TEMP", "TMP"]);

  #[cfg(not(windows))]
  return matches_ci(&key, &["PATH", "HOME", "TMPDIR", "LANG"]);
}

fn matches_ci(value: &str, allowed: &[&str]) -> bool {
  allowed.iter().any(|candidate| value.eq_ignore_ascii_case(candidate))
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
  use super::{ensure_not_managed_root, resolve_managed_path, validate_command_spawn, ExecutionPolicy};
  use crate::framework::paths::resolve_paths_for_root;
  use std::ffi::OsString;

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

  #[test]
  fn resolves_managed_working_directory_to_canonical_path() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let nested = paths.data_dir.join("work").join("nested");
    std::fs::create_dir_all(&nested).expect("nested directory");
    let policy = ExecutionPolicy::for_paths(&paths).expect("policy");

    let resolved = policy
      .resolve_working_directory(Some(nested.as_path()))
      .expect("resolved cwd");

    assert_eq!(resolved, std::fs::canonicalize(&nested).expect("canonical cwd"));
  }

  #[test]
  fn defaults_working_directory_to_data_dir() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let policy = ExecutionPolicy::for_paths(&paths).expect("policy");

    let resolved = policy.resolve_working_directory(None).expect("default cwd");

    assert_eq!(resolved, std::fs::canonicalize(&paths.data_dir).expect("canonical data dir"));
  }

  #[test]
  fn rejects_working_directory_outside_managed_roots() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let outside = root.path().join("external");
    std::fs::create_dir_all(&outside).expect("outside dir");
    let policy = ExecutionPolicy::for_paths(&paths).expect("policy");

    let error = policy
      .resolve_working_directory(Some(outside.as_path()))
      .expect_err("outside cwd should be denied");

    assert!(error.to_string().contains("outside managed runtime directories"));
  }

  #[test]
  fn sanitizes_environment_to_allow_list() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let policy = ExecutionPolicy::for_paths(&paths).expect("policy");

    let sanitized = policy.sanitize_environment(vec![
      (OsString::from("PATH"), OsString::from("path-value")),
      (OsString::from("SECRET_TOKEN"), OsString::from("hidden")),
      #[cfg(windows)]
      (OsString::from("SystemRoot"), OsString::from("C:\\Windows")),
      #[cfg(not(windows))]
      (OsString::from("LANG"), OsString::from("en_US.UTF-8")),
    ]);

    assert!(sanitized.iter().any(|(key, _)| key == "PATH"));
    assert!(!sanitized.iter().any(|(key, _)| key == "SECRET_TOKEN"));
  }
}
