#![cfg_attr(not(test), allow(dead_code))]

use crate::framework::{
    layout::{ActiveState, PinnedState, RetentionState},
    paths::AppPaths,
    Result,
};
use std::{
    cmp::Ordering,
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Default)]
pub struct RetentionService;

impl RetentionService {
    pub fn new() -> Self {
        Self
    }

    pub fn prune_module_packages(
        &self,
        paths: &AppPaths,
        active: &ActiveState,
        retention: &RetentionState,
        pinned: &PinnedState,
    ) -> Result<Vec<PathBuf>> {
        prune_packages(
            &paths.machine_store_dir.join("modules"),
            retention.modules.historical_packages as usize,
            |name| protected_module_versions(name, active, pinned),
        )
    }

    pub fn prune_runtime_packages(
        &self,
        paths: &AppPaths,
        active: &ActiveState,
        retention: &RetentionState,
        pinned: &PinnedState,
    ) -> Result<Vec<PathBuf>> {
        prune_packages(
            &paths.machine_store_dir.join("runtimes"),
            retention.runtimes.historical_packages as usize,
            |name| protected_runtime_versions(name, active, pinned),
        )
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct PackageEntry {
    version: String,
    path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum VersionSegment {
    Numeric(u64),
    Text(String),
}

fn collect_package_entries(package_dir: &Path) -> Result<Vec<PackageEntry>> {
    let mut entries = Vec::new();

    for entry in fs::read_dir(package_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }

        let path = entry.path();
        let is_pkg = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("pkg"))
            .unwrap_or(false);
        if !is_pkg {
            continue;
        }

        let Some(version) = path
            .file_stem()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string())
        else {
            continue;
        };

        entries.push(PackageEntry { version, path });
    }

    Ok(entries)
}

fn prune_packages<F>(
    store_root: &Path,
    historical_limit: usize,
    protected_versions_for_name: F,
) -> Result<Vec<PathBuf>>
where
    F: Fn(&str) -> BTreeSet<String>,
{
    let mut removed = Vec::new();

    if !store_root.exists() {
        return Ok(removed);
    }

    for entry in fs::read_dir(store_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();
        let package_dir = entry.path().join("packages");
        if !package_dir.is_dir() {
            continue;
        }

        let mut packages = collect_package_entries(&package_dir)?;
        packages.sort_by(|left, right| {
            compare_versions(&right.version, &left.version)
                .then_with(|| right.version.cmp(&left.version))
        });

        let protected_versions = protected_versions_for_name(&name);
        let mut retained_history = 0usize;

        for package in packages {
            if protected_versions.contains(&package.version) {
                continue;
            }

            if retained_history < historical_limit {
                retained_history += 1;
                continue;
            }

            fs::remove_file(&package.path)?;
            removed.push(package.path);
        }
    }

    Ok(removed)
}

fn protected_module_versions(
    module_name: &str,
    active: &ActiveState,
    pinned: &PinnedState,
) -> BTreeSet<String> {
    let mut versions = BTreeSet::new();

    if let Some(entry) = active.modules.get(module_name) {
        if let Some(active_version) = &entry.active_version {
            versions.insert(active_version.clone());
        }

        if let Some(fallback_version) = &entry.fallback_version {
            versions.insert(fallback_version.clone());
        }
    }

    if let Some(pinned_versions) = pinned.modules.get(module_name) {
        versions.extend(pinned_versions.iter().cloned());
    }

    versions
}

fn protected_runtime_versions(
    runtime_name: &str,
    active: &ActiveState,
    pinned: &PinnedState,
) -> BTreeSet<String> {
    let mut versions = BTreeSet::new();

    if let Some(entry) = active.runtimes.get(runtime_name) {
        if let Some(active_install_key) = entry.active_runtime_install_key() {
            versions.insert(active_install_key.to_string());
        }

        if let Some(fallback_install_key) = entry.fallback_runtime_install_key() {
            versions.insert(fallback_install_key.to_string());
        }
    }

    if let Some(pinned_versions) = pinned.runtimes.get(runtime_name) {
        versions.extend(pinned_versions.iter().cloned());
    }

    versions
}

fn compare_versions(left: &str, right: &str) -> Ordering {
    let left_segments = parse_version_segments(left);
    let right_segments = parse_version_segments(right);
    let max_len = left_segments.len().max(right_segments.len());

    for index in 0..max_len {
        let ordering = match (left_segments.get(index), right_segments.get(index)) {
            (
                Some(VersionSegment::Numeric(left_value)),
                Some(VersionSegment::Numeric(right_value)),
            ) => left_value.cmp(right_value),
            (Some(VersionSegment::Text(left_value)), Some(VersionSegment::Text(right_value))) => {
                left_value.cmp(right_value)
            }
            (Some(VersionSegment::Numeric(_)), Some(VersionSegment::Text(_))) => Ordering::Greater,
            (Some(VersionSegment::Text(_)), Some(VersionSegment::Numeric(_))) => Ordering::Less,
            (Some(segment), None) => compare_segment_with_missing(segment),
            (None, Some(segment)) => compare_segment_with_missing(segment).reverse(),
            (None, None) => Ordering::Equal,
        };

        if ordering != Ordering::Equal {
            return ordering;
        }
    }

    Ordering::Equal
}

fn compare_segment_with_missing(segment: &VersionSegment) -> Ordering {
    match segment {
        VersionSegment::Numeric(0) => Ordering::Equal,
        VersionSegment::Numeric(_) | VersionSegment::Text(_) => Ordering::Greater,
    }
}

fn parse_version_segments(version: &str) -> Vec<VersionSegment> {
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut current_is_numeric: Option<bool> = None;

    for ch in version.chars() {
        if ch.is_ascii_alphanumeric() {
            let is_numeric = ch.is_ascii_digit();
            match current_is_numeric {
                Some(previous) if previous == is_numeric => current.push(ch),
                Some(previous) => {
                    push_version_segment(&mut segments, &mut current, previous);
                    current.push(ch);
                    current_is_numeric = Some(is_numeric);
                }
                None => {
                    current.push(ch);
                    current_is_numeric = Some(is_numeric);
                }
            }
        } else if let Some(previous) = current_is_numeric.take() {
            push_version_segment(&mut segments, &mut current, previous);
        }
    }

    if let Some(previous) = current_is_numeric {
        push_version_segment(&mut segments, &mut current, previous);
    }

    while matches!(segments.last(), Some(VersionSegment::Numeric(0))) {
        segments.pop();
    }

    segments
}

fn push_version_segment(
    segments: &mut Vec<VersionSegment>,
    current: &mut String,
    is_numeric: bool,
) {
    if current.is_empty() {
        return;
    }

    let value = std::mem::take(current);
    if is_numeric {
        match value.parse::<u64>() {
            Ok(parsed) => segments.push(VersionSegment::Numeric(parsed)),
            Err(_) => segments.push(VersionSegment::Text(value.to_ascii_lowercase())),
        }
    } else {
        segments.push(VersionSegment::Text(value.to_ascii_lowercase()));
    }
}

#[cfg(test)]
mod tests {
    use super::RetentionService;
    use crate::framework::{
        layout::{ActiveState, ActiveStateEntry, PinnedState, RetentionState},
        paths::resolve_paths_for_root,
    };

    #[test]
    fn prunes_oldest_unpinned_module_packages_but_keeps_active_and_fallback() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let package_dir = paths
            .machine_store_dir
            .join("modules")
            .join("openclaw")
            .join("packages");
        std::fs::create_dir_all(&package_dir).expect("package dir");
        for version in ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4"] {
            std::fs::write(package_dir.join(format!("{version}.pkg")), version).expect("package");
        }

        let mut active = ActiveState::default();
        active.modules.insert(
            "openclaw".to_string(),
            ActiveStateEntry {
                active_version: Some("1.0.4".to_string()),
                fallback_version: Some("1.0.3".to_string()),
                ..ActiveStateEntry::default()
            },
        );

        let retention = RetentionState {
            modules: crate::framework::layout::RetentionBucket {
                historical_packages: 1,
                ..crate::framework::layout::RetentionBucket::default()
            },
            ..RetentionState::default()
        };

        let removed = RetentionService::new()
            .prune_module_packages(&paths, &active, &retention, &PinnedState::default())
            .expect("pruned packages");

        assert_eq!(removed.len(), 2);
        assert!(package_dir.join("1.0.4.pkg").exists());
        assert!(package_dir.join("1.0.3.pkg").exists());
        assert!(package_dir.join("1.0.2.pkg").exists());
        assert!(!package_dir.join("1.0.0.pkg").exists());
        assert!(!package_dir.join("1.0.1.pkg").exists());
    }

    #[test]
    fn preserves_pinned_module_packages_during_pruning() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let package_dir = paths
            .machine_store_dir
            .join("modules")
            .join("codex")
            .join("packages");
        std::fs::create_dir_all(&package_dir).expect("package dir");
        for version in ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4"] {
            std::fs::write(package_dir.join(format!("{version}.pkg")), version).expect("package");
        }

        let mut active = ActiveState::default();
        active.modules.insert(
            "codex".to_string(),
            ActiveStateEntry {
                active_version: Some("1.0.4".to_string()),
                fallback_version: Some("1.0.3".to_string()),
                ..ActiveStateEntry::default()
            },
        );

        let mut pinned = PinnedState::default();
        pinned
            .modules
            .insert("codex".to_string(), vec!["1.0.0".to_string()]);

        let retention = RetentionState {
            modules: crate::framework::layout::RetentionBucket {
                historical_packages: 1,
                ..crate::framework::layout::RetentionBucket::default()
            },
            ..RetentionState::default()
        };

        let removed = RetentionService::new()
            .prune_module_packages(&paths, &active, &retention, &pinned)
            .expect("pruned packages");

        assert_eq!(removed.len(), 1);
        assert!(package_dir.join("1.0.0.pkg").exists());
        assert!(package_dir.join("1.0.2.pkg").exists());
        assert!(!package_dir.join("1.0.1.pkg").exists());
    }

    #[test]
    fn keeps_newest_historical_packages_by_numeric_version_order() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let package_dir = paths
            .machine_store_dir
            .join("modules")
            .join("ironclaw")
            .join("packages");
        std::fs::create_dir_all(&package_dir).expect("package dir");
        for version in ["1.0.8", "1.0.9", "1.0.10", "1.0.11"] {
            std::fs::write(package_dir.join(format!("{version}.pkg")), version).expect("package");
        }

        let mut active = ActiveState::default();
        active.modules.insert(
            "ironclaw".to_string(),
            ActiveStateEntry {
                active_version: Some("1.0.11".to_string()),
                fallback_version: None,
                ..ActiveStateEntry::default()
            },
        );

        let retention = RetentionState {
            modules: crate::framework::layout::RetentionBucket {
                historical_packages: 1,
                ..crate::framework::layout::RetentionBucket::default()
            },
            ..RetentionState::default()
        };

        let removed = RetentionService::new()
            .prune_module_packages(&paths, &active, &retention, &PinnedState::default())
            .expect("pruned packages");

        assert_eq!(removed.len(), 2);
        assert!(package_dir.join("1.0.11.pkg").exists());
        assert!(package_dir.join("1.0.10.pkg").exists());
        assert!(!package_dir.join("1.0.9.pkg").exists());
        assert!(!package_dir.join("1.0.8.pkg").exists());
    }

    #[test]
    fn prunes_oldest_unpinned_runtime_packages_but_keeps_active_and_fallback() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let package_dir = paths
            .machine_store_dir
            .join("runtimes")
            .join("python")
            .join("packages");
        std::fs::create_dir_all(&package_dir).expect("package dir");
        for version in ["3.11.0", "3.11.1", "3.11.2", "3.11.3"] {
            std::fs::write(package_dir.join(format!("{version}.pkg")), version).expect("package");
        }

        let mut active = ActiveState::default();
        active.runtimes.insert(
            "python".to_string(),
            ActiveStateEntry {
                active_version: Some("3.11.3".to_string()),
                fallback_version: Some("3.11.2".to_string()),
                ..ActiveStateEntry::default()
            },
        );

        let retention = RetentionState {
            runtimes: crate::framework::layout::RetentionBucket {
                historical_packages: 1,
                ..crate::framework::layout::RetentionBucket::default()
            },
            ..RetentionState::default()
        };

        let removed = RetentionService::new()
            .prune_runtime_packages(&paths, &active, &retention, &PinnedState::default())
            .expect("pruned packages");

        assert_eq!(removed.len(), 1);
        assert!(package_dir.join("3.11.3.pkg").exists());
        assert!(package_dir.join("3.11.2.pkg").exists());
        assert!(package_dir.join("3.11.1.pkg").exists());
        assert!(!package_dir.join("3.11.0.pkg").exists());
    }

    #[test]
    fn preserves_pinned_runtime_packages_during_pruning() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let package_dir = paths
            .machine_store_dir
            .join("runtimes")
            .join("node")
            .join("packages");
        std::fs::create_dir_all(&package_dir).expect("package dir");
        for version in ["22.0.0", "22.0.1", "22.0.2", "22.0.3"] {
            std::fs::write(package_dir.join(format!("{version}.pkg")), version).expect("package");
        }

        let mut active = ActiveState::default();
        active.runtimes.insert(
            "node".to_string(),
            ActiveStateEntry {
                active_version: Some("22.0.3".to_string()),
                fallback_version: None,
                ..ActiveStateEntry::default()
            },
        );

        let mut pinned = PinnedState::default();
        pinned
            .runtimes
            .insert("node".to_string(), vec!["22.0.0".to_string()]);

        let retention = RetentionState {
            runtimes: crate::framework::layout::RetentionBucket {
                historical_packages: 1,
                ..crate::framework::layout::RetentionBucket::default()
            },
            ..RetentionState::default()
        };

        let removed = RetentionService::new()
            .prune_runtime_packages(&paths, &active, &retention, &pinned)
            .expect("pruned packages");

        assert_eq!(removed.len(), 1);
        assert!(package_dir.join("22.0.3.pkg").exists());
        assert!(package_dir.join("22.0.2.pkg").exists());
        assert!(package_dir.join("22.0.0.pkg").exists());
        assert!(!package_dir.join("22.0.1.pkg").exists());
    }

    #[test]
    fn prunes_runtime_packages_using_explicit_install_keys_when_version_labels_differ() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let package_dir = paths
            .machine_store_dir
            .join("runtimes")
            .join("openclaw")
            .join("packages");
        std::fs::create_dir_all(&package_dir).expect("package dir");
        for version in [
            "2026.4.8-windows-x64",
            "2026.4.9-windows-x64",
            "openclaw-nightly-windows-x64",
        ] {
            std::fs::write(package_dir.join(format!("{version}.pkg")), version).expect("package");
        }

        let mut active = ActiveState::default();
        active.runtimes.insert(
            "openclaw".to_string(),
            ActiveStateEntry {
                active_version: Some("2026.4.11-beta.1".to_string()),
                fallback_version: Some("2026.4.9".to_string()),
                active_install_key: Some("openclaw-nightly-windows-x64".to_string()),
                fallback_install_key: Some("2026.4.9-windows-x64".to_string()),
                active_version_label: Some("2026.4.11-beta.1".to_string()),
                fallback_version_label: Some("2026.4.9".to_string()),
            },
        );

        let retention = RetentionState {
            runtimes: crate::framework::layout::RetentionBucket {
                historical_packages: 0,
                ..crate::framework::layout::RetentionBucket::default()
            },
            ..RetentionState::default()
        };

        let removed = RetentionService::new()
            .prune_runtime_packages(&paths, &active, &retention, &PinnedState::default())
            .expect("pruned packages");

        assert_eq!(removed.len(), 1);
        assert!(package_dir
            .join("openclaw-nightly-windows-x64.pkg")
            .exists());
        assert!(package_dir.join("2026.4.9-windows-x64.pkg").exists());
        assert!(!package_dir.join("2026.4.8-windows-x64.pkg").exists());
    }
}
