use crate::framework::{
    kernel_runtime::{KernelRuntimeAdapter, KernelRuntimeContract, KernelRuntimeReadinessProbe},
    layout::{
        ActiveState, KernelAuthorityState, KernelMigrationState, RuntimeUpgradeStateEntry,
        RuntimeUpgradesState,
    },
    paths::AppPaths,
    services::openclaw_runtime::{load_manifest, validate_installed_openclaw_runtime},
    FrameworkError, Result,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const OPENCLAW_HEALTH_PROBE_TIMEOUT_MS: u64 = 750;
const OPENCLAW_RUNTIME_ID: &str = "openclaw";

struct KernelRuntimeStatePaths {
    authority_file: PathBuf,
    migrations_file: PathBuf,
    runtime_upgrades_file: PathBuf,
    managed_config_file: PathBuf,
    quarantine_dir: PathBuf,
    runtime_install_dir: PathBuf,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ImportedOpenClawConfig {
    pub root: Value,
    pub source_path: Option<PathBuf>,
}

#[derive(Clone, Debug, Default)]
pub struct KernelRuntimeAuthorityService;

impl KernelRuntimeAuthorityService {
    pub fn new() -> Self {
        Self
    }

    pub fn contract(&self, runtime_id: &str, paths: &AppPaths) -> Result<KernelRuntimeContract> {
        let normalized_runtime_id = normalize_runtime_id(runtime_id);
        let adapter = self
            .adapter_for_runtime_id(normalized_runtime_id)
            .ok_or_else(|| unsupported_runtime_id_error(runtime_id))?;
        self.contract_for_adapter(adapter.as_ref(), paths)
    }

    pub fn managed_contract(
        &self,
        runtime_id: &str,
        paths: &AppPaths,
    ) -> Result<Option<KernelRuntimeContract>> {
        let normalized_runtime_id = normalize_runtime_id(runtime_id);
        let Some(adapter) = self.adapter_for_runtime_id(normalized_runtime_id) else {
            return Ok(None);
        };
        self.contract_for_adapter(adapter.as_ref(), paths).map(Some)
    }

    pub fn verify_managed_install(
        &self,
        runtime_id: &str,
        paths: &AppPaths,
        install_key: &str,
    ) -> Result<()> {
        let normalized_runtime_id = normalize_runtime_id(runtime_id);
        let Some(adapter) = self.adapter_for_runtime_id(normalized_runtime_id) else {
            return Ok(());
        };
        adapter.verify_install(paths, install_key)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn openclaw_contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract> {
        self.contract(OPENCLAW_RUNTIME_ID, paths)
    }

    fn contract_for_adapter(
        &self,
        adapter: &dyn KernelRuntimeAdapter,
        paths: &AppPaths,
    ) -> Result<KernelRuntimeContract> {
        adapter.contract(paths)
    }

    fn adapter_for_runtime_id(&self, runtime_id: &str) -> Option<Box<dyn KernelRuntimeAdapter>> {
        match normalize_runtime_id(runtime_id) {
            OPENCLAW_RUNTIME_ID => Some(Box::new(OpenClawKernelAdapter::new())),
            _ => None,
        }
    }

    pub fn active_managed_config_path(
        &self,
        runtime_id: &str,
        paths: &AppPaths,
    ) -> Result<PathBuf> {
        let state_paths = resolve_runtime_state_paths(runtime_id, paths)?;
        let authority = read_json_file::<KernelAuthorityState>(&state_paths.authority_file)?;

        Ok(authority
            .managed_config_path
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or(state_paths.managed_config_file))
    }

    #[allow(dead_code)]
    pub fn active_openclaw_config_path(&self, paths: &AppPaths) -> Result<PathBuf> {
        self.active_managed_config_path(OPENCLAW_RUNTIME_ID, paths)
    }

    pub fn import_or_default_openclaw_config(
        &self,
        paths: &AppPaths,
        managed_config_path: &Path,
    ) -> Result<ImportedOpenClawConfig> {
        if let Some(parent) = managed_config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        if managed_config_path.exists() {
            return Ok(ImportedOpenClawConfig {
                root: read_json5_object(managed_config_path)?,
                source_path: None,
            });
        }

        if paths.openclaw_config_file.exists() {
            return Ok(ImportedOpenClawConfig {
                root: read_json5_object(&paths.openclaw_config_file)?,
                source_path: Some(paths.openclaw_config_file.clone()),
            });
        }

        Ok(ImportedOpenClawConfig {
            root: Value::Object(Map::new()),
            source_path: None,
        })
    }

    #[allow(dead_code)]
    pub fn record_openclaw_config_migration(
        &self,
        paths: &AppPaths,
        source_path: Option<&Path>,
        managed_config_path: &Path,
    ) -> Result<()> {
        self.record_config_migration(OPENCLAW_RUNTIME_ID, paths, source_path, managed_config_path)
    }

    pub fn record_config_migration(
        &self,
        runtime_id: &str,
        paths: &AppPaths,
        source_path: Option<&Path>,
        managed_config_path: &Path,
    ) -> Result<()> {
        let normalized_runtime_id = normalize_runtime_id(runtime_id);
        let contract = self.contract(normalized_runtime_id, paths)?;
        let state_paths = resolve_runtime_state_paths(normalized_runtime_id, paths)?;
        let mut authority = read_json_file::<KernelAuthorityState>(&state_paths.authority_file)?;
        let mut migrations = read_json_file::<KernelMigrationState>(&state_paths.migrations_file)?;
        let migrated_at = current_rfc3339_timestamp()?;

        authority.runtime_id = normalized_runtime_id.to_string();
        authority.managed_config_path = Some(managed_config_path.to_string_lossy().into_owned());
        authority.owned_runtime_roots = contract
            .owned_runtime_roots
            .iter()
            .map(|root| path_string(root))
            .collect();
        authority.legacy_runtime_roots = contract
            .owned_runtime_roots
            .iter()
            .filter(|root| *root != &state_paths.runtime_install_dir)
            .map(|root| path_string(root))
            .collect();
        authority.last_error = None;

        migrations.runtime_id = normalized_runtime_id.to_string();
        migrations.last_config_source_path = source_path.map(path_string);
        migrations.last_config_target_path = Some(path_string(managed_config_path));
        migrations.last_config_migrated_at = Some(migrated_at);
        migrations.last_error = None;

        if let Some(source_path) = source_path.filter(|path| *path != managed_config_path) {
            if source_path.exists() {
                let quarantined_path = quarantine_path(source_path, &state_paths.quarantine_dir)?;
                let quarantined_path_string = path_string(&quarantined_path);
                if !authority
                    .quarantined_paths
                    .iter()
                    .any(|path| path == &quarantined_path_string)
                {
                    authority.quarantined_paths.push(quarantined_path_string);
                }
            }
        }

        write_json_file(&state_paths.authority_file, &authority)?;
        write_json_file(&state_paths.migrations_file, &migrations)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn record_openclaw_activation_result(
        &self,
        paths: &AppPaths,
        install_key: &str,
        last_error: Option<&str>,
    ) -> Result<()> {
        self.record_activation_result(OPENCLAW_RUNTIME_ID, paths, install_key, last_error)
    }

    pub fn record_activation_result(
        &self,
        runtime_id: &str,
        paths: &AppPaths,
        install_key: &str,
        last_error: Option<&str>,
    ) -> Result<()> {
        let normalized_runtime_id = normalize_runtime_id(runtime_id);
        let contract = self.contract(normalized_runtime_id, paths)?;
        let state_paths = resolve_runtime_state_paths(normalized_runtime_id, paths)?;
        let mut active = read_json_file::<ActiveState>(&paths.active_file)?;
        let mut authority = read_json_file::<KernelAuthorityState>(&state_paths.authority_file)?;
        let mut runtime_upgrades =
            read_json_file::<RuntimeUpgradesState>(&state_paths.runtime_upgrades_file)?;
        let attempted_at = current_rfc3339_timestamp()?;
        let managed_config_path = self.active_managed_config_path(normalized_runtime_id, paths)?;
        let runtime_upgrade_entry = runtime_upgrades
            .runtimes
            .entry(normalized_runtime_id.to_string())
            .or_insert_with(RuntimeUpgradeStateEntry::default);

        authority.runtime_id = normalized_runtime_id.to_string();
        authority.managed_config_path = Some(path_string(&managed_config_path));
        authority.owned_runtime_roots = contract
            .owned_runtime_roots
            .iter()
            .map(|root| path_string(root))
            .collect();
        authority.legacy_runtime_roots = contract
            .owned_runtime_roots
            .iter()
            .filter(|root| *root != &state_paths.runtime_install_dir)
            .map(|root| path_string(root))
            .collect();
        authority.last_error = last_error.map(str::to_string);
        runtime_upgrade_entry.last_attempted_at = Some(attempted_at);
        if let Some(last_error) = last_error {
            runtime_upgrade_entry.last_attempted_version =
                resolve_runtime_version_label(self, paths, normalized_runtime_id, install_key);
            runtime_upgrade_entry.last_error = Some(last_error.to_string());
        } else {
            let previous_active_install_key = active
                .runtimes
                .get(normalized_runtime_id)
                .and_then(|entry| entry.active_runtime_install_key().map(str::to_string));
            let fallback_install_key =
                if previous_active_install_key.as_deref() != Some(install_key) {
                    previous_active_install_key
                } else {
                    active
                        .runtimes
                        .get(normalized_runtime_id)
                        .and_then(|entry| entry.fallback_runtime_install_key().map(str::to_string))
                };
            let active_version_label = resolve_runtime_version_label_required(
                self,
                paths,
                normalized_runtime_id,
                install_key,
            )?;
            let fallback_version_label =
                fallback_install_key
                    .as_deref()
                    .and_then(|fallback_install_key| {
                        resolve_runtime_version_label(
                            self,
                            paths,
                            normalized_runtime_id,
                            fallback_install_key,
                        )
                    });

            authority.active_install_key = Some(install_key.to_string());
            authority.fallback_install_key = fallback_install_key.clone();
            authority.active_version_label = Some(active_version_label.clone());
            authority.fallback_version_label = fallback_version_label.clone();
            authority.last_activation_at = runtime_upgrade_entry.last_attempted_at.clone();
            authority.last_error = None;

            let active_entry = active
                .runtimes
                .entry(normalized_runtime_id.to_string())
                .or_default();
            active_entry.set_runtime_state(
                Some(install_key.to_string()),
                fallback_install_key.clone(),
                Some(active_version_label.clone()),
                fallback_version_label.clone(),
            );
            runtime_upgrade_entry.last_attempted_version = Some(active_version_label.clone());
            runtime_upgrade_entry.active_install_key = Some(install_key.to_string());
            runtime_upgrade_entry.fallback_install_key = fallback_install_key;
            runtime_upgrade_entry.active_version_label = Some(active_version_label.clone());
            runtime_upgrade_entry.fallback_version_label = fallback_version_label;
            runtime_upgrade_entry.last_applied_version = Some(active_version_label);
            runtime_upgrade_entry.last_error = None;
        }

        persist_runtime_state_transaction(
            &paths.active_file,
            &state_paths.authority_file,
            &state_paths.runtime_upgrades_file,
            &active,
            &authority,
            &runtime_upgrades,
        )
    }
}

#[derive(Clone, Debug, Default)]
struct OpenClawKernelAdapter;

impl OpenClawKernelAdapter {
    fn new() -> Self {
        Self
    }
}

impl KernelRuntimeAdapter for OpenClawKernelAdapter {
    fn runtime_id(&self) -> &'static str {
        OPENCLAW_RUNTIME_ID
    }

    fn contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract> {
        let openclaw = paths.kernel_paths(self.runtime_id())?;
        Ok(KernelRuntimeContract {
            runtime_id: self.runtime_id().to_string(),
            managed_config_path: openclaw.managed_config_file.clone(),
            owned_runtime_roots: vec![openclaw.runtime_dir.clone(), openclaw.legacy_runtime_dir],
            readiness_probe: KernelRuntimeReadinessProbe {
                supports_loopback_health_probe: true,
                health_probe_timeout_ms: OPENCLAW_HEALTH_PROBE_TIMEOUT_MS,
            },
        })
    }

    fn verify_install(&self, paths: &AppPaths, install_key: &str) -> Result<()> {
        validate_installed_openclaw_runtime(paths, install_key).map(|_| ())
    }

    fn resolve_install_version_label(
        &self,
        paths: &AppPaths,
        install_key: &str,
    ) -> Result<Option<String>> {
        let openclaw = paths.kernel_paths(self.runtime_id())?;
        Ok(
            load_manifest(&openclaw.runtime_dir.join(install_key).join("manifest.json"))
                .ok()
                .map(|manifest| manifest.openclaw_version),
        )
    }
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn normalize_runtime_id(runtime_id: &str) -> &str {
    runtime_id.trim()
}

fn unsupported_runtime_id_error(runtime_id: &str) -> FrameworkError {
    FrameworkError::ValidationFailed(format!(
        "unsupported kernel runtime id {}",
        runtime_id.trim()
    ))
}

fn resolve_runtime_state_paths(
    runtime_id: &str,
    paths: &AppPaths,
) -> Result<KernelRuntimeStatePaths> {
    let kernel_paths = paths.kernel_paths(runtime_id)?;
    Ok(KernelRuntimeStatePaths {
        authority_file: kernel_paths.authority_file,
        migrations_file: kernel_paths.migrations_file,
        runtime_upgrades_file: kernel_paths.runtime_upgrades_file,
        managed_config_file: kernel_paths.managed_config_file,
        quarantine_dir: kernel_paths.quarantine_dir,
        runtime_install_dir: kernel_paths.runtime_dir,
    })
}

fn resolve_runtime_version_label(
    authority: &KernelRuntimeAuthorityService,
    paths: &AppPaths,
    runtime_id: &str,
    install_key: &str,
) -> Option<String> {
    authority
        .adapter_for_runtime_id(runtime_id)
        .and_then(|adapter| {
            adapter
                .resolve_install_version_label(paths, install_key)
                .ok()
                .flatten()
        })
}

fn resolve_runtime_version_label_required(
    authority: &KernelRuntimeAuthorityService,
    paths: &AppPaths,
    runtime_id: &str,
    install_key: &str,
) -> Result<String> {
    resolve_runtime_version_label(authority, paths, runtime_id, install_key).ok_or_else(|| {
        FrameworkError::ValidationFailed(format!(
            "managed runtime activation is missing a canonical manifest version for runtime {} install key {}",
            runtime_id.trim(),
            install_key,
        ))
    })
}

fn persist_runtime_state_transaction(
    active_file: &Path,
    authority_file: &Path,
    runtime_upgrades_file: &Path,
    active: &ActiveState,
    authority: &KernelAuthorityState,
    runtime_upgrades: &RuntimeUpgradesState,
) -> Result<()> {
    let backups = vec![
        capture_file_backup(active_file)?,
        capture_file_backup(authority_file)?,
        capture_file_backup(runtime_upgrades_file)?,
    ];
    let write_result = (|| -> Result<()> {
        write_json_file(active_file, active)?;
        write_json_file(authority_file, authority)?;
        write_json_file(runtime_upgrades_file, runtime_upgrades)?;
        Ok(())
    })();

    if let Err(error) = write_result {
        for backup in backups.iter().rev() {
            let _ = restore_file_backup(backup);
        }
        return Err(error);
    }

    Ok(())
}

#[derive(Clone, Debug)]
struct FileBackup {
    path: PathBuf,
    content: Option<Vec<u8>>,
}

fn capture_file_backup(path: &Path) -> Result<FileBackup> {
    let content = if path.exists() {
        Some(fs::read(path)?)
    } else {
        None
    };
    Ok(FileBackup {
        path: path.to_path_buf(),
        content,
    })
}

fn restore_file_backup(backup: &FileBackup) -> Result<()> {
    if let Some(content) = &backup.content {
        fs::write(&backup.path, content)?;
    } else if backup.path.exists() {
        fs::remove_file(&backup.path)?;
    }
    Ok(())
}

fn quarantine_path(source_path: &Path, quarantine_dir: &Path) -> Result<PathBuf> {
    fs::create_dir_all(quarantine_dir)?;

    let file_name = source_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "openclaw-config.json".to_string());
    let quarantined_path = unique_quarantine_path(quarantine_dir, &file_name)?;

    match fs::rename(source_path, &quarantined_path) {
        Ok(()) => Ok(quarantined_path),
        Err(_) => {
            fs::copy(source_path, &quarantined_path)?;
            fs::remove_file(source_path)?;
            Ok(quarantined_path)
        }
    }
}

fn unique_quarantine_path(quarantine_dir: &Path, file_name: &str) -> Result<PathBuf> {
    let stamp = unix_timestamp_ms()?;
    let candidate = quarantine_dir.join(format!("{stamp}-{file_name}"));
    if !candidate.exists() {
        return Ok(candidate);
    }

    for suffix in 1..=32 {
        let candidate = quarantine_dir.join(format!("{stamp}-{suffix}-{file_name}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(FrameworkError::Conflict(format!(
        "failed to allocate a quarantine target for {} under {}",
        file_name,
        quarantine_dir.display()
    )))
}

fn read_json5_object(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }

    let content = fs::read_to_string(path)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid managed openclaw config: {error}"))
    })?;

    if parsed.is_object() {
        return Ok(parsed);
    }

    Err(FrameworkError::ValidationFailed(format!(
        "managed openclaw config must be a JSON object: {}",
        path.display()
    )))
}

fn read_json_file<T>(path: &Path) -> Result<T>
where
    T: DeserializeOwned,
{
    let content = fs::read_to_string(path)?;
    serde_json::from_str::<T>(&content).map_err(Into::into)
}

fn write_json_file<T>(path: &Path, value: &T) -> Result<()>
where
    T: Serialize,
{
    let content = serde_json::to_string_pretty(value)?;
    fs::write(path, content)?;
    Ok(())
}

fn current_rfc3339_timestamp() -> Result<String> {
    OffsetDateTime::now_utc().format(&Rfc3339).map_err(|error| {
        FrameworkError::Internal(format!(
            "failed to format openclaw runtime authority timestamp: {error}"
        ))
    })
}

fn unix_timestamp_ms() -> Result<u128> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to resolve the current openclaw authority timestamp: {error}"
            ))
        })
}

#[cfg(test)]
mod tests {
    use super::KernelRuntimeAuthorityService;
    use crate::framework::{layout::initialize_machine_state, paths::resolve_paths_for_root};
    use serde_json::Value;
    use std::{fs, path::Path};

    fn strip_test_module(source: &str) -> String {
        let Some(module_start) = source.find("mod tests {") else {
            return source.to_string();
        };
        let Some(open_brace) = source[module_start..].find('{') else {
            return source.to_string();
        };
        let open_brace = module_start + open_brace;
        let mut depth = 0usize;
        let mut module_end = None;
        for (offset, ch) in source[open_brace..].char_indices() {
            match ch {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        module_end = Some(open_brace + offset + ch.len_utf8());
                        break;
                    }
                }
                _ => {}
            }
        }
        let Some(module_end) = module_end else {
            return source.to_string();
        };

        let mut production = String::with_capacity(source.len());
        production.push_str(&source[..module_start]);
        production.push_str(&source[module_end..]);
        production
    }

    fn collect_rust_sources(root: &Path, files: &mut Vec<std::path::PathBuf>) {
        let entries = fs::read_dir(root).expect("read source directory");
        for entry in entries {
            let entry = entry.expect("read source directory entry");
            let path = entry.path();
            if path.is_dir() {
                collect_rust_sources(&path, files);
                continue;
            }
            if path.extension().and_then(|value| value.to_str()) == Some("rs") {
                files.push(path);
            }
        }
    }

    #[test]
    fn production_sources_do_not_call_openclaw_specific_config_wrapper() {
        for (label, source) in [
            (
                "framework/kernel_host/mod.rs",
                include_str!("../kernel_host/mod.rs"),
            ),
            (
                "framework/services/openclaw_runtime.rs",
                include_str!("openclaw_runtime.rs"),
            ),
            (
                "framework/services/openclaw_runtime_snapshot.rs",
                include_str!("openclaw_runtime_snapshot.rs"),
            ),
            (
                "framework/services/openclaw_mirror_import.rs",
                include_str!("openclaw_mirror_import.rs"),
            ),
            (
                "framework/services/studio/openclaw_workbench.rs",
                include_str!("studio/openclaw_workbench.rs"),
            ),
        ] {
            let production_source = strip_test_module(source);
            assert!(
                !production_source.contains(".active_openclaw_config_path("),
                "{label} still calls the OpenClaw-specific config wrapper in production code"
            );
        }
    }

    #[test]
    fn source_tree_does_not_use_openclaw_compatibility_wrappers_outside_authority_owner() {
        let src_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let authority_owner = src_root
            .join("framework")
            .join("services")
            .join("kernel_runtime_authority.rs");
        let forbidden_patterns = [
            ".active_openclaw_config_path(",
            ".openclaw_contract(",
            ".record_openclaw_activation_result(",
            ".record_openclaw_config_migration(",
        ];
        let mut rust_sources = Vec::new();
        let mut offenders = Vec::new();
        collect_rust_sources(&src_root, &mut rust_sources);

        for path in rust_sources {
            if path == authority_owner {
                continue;
            }

            let source = fs::read_to_string(&path).expect("read rust source");
            let relative_path = path
                .strip_prefix(&src_root)
                .expect("source under src root")
                .to_string_lossy()
                .replace('\\', "/");

            for (index, line) in source.lines().enumerate() {
                for pattern in forbidden_patterns {
                    if line.contains(pattern) && !line.contains("contains(\"") {
                        offenders.push(format!("{relative_path}:{}:{}", index + 1, line.trim()));
                    }
                }
            }
        }

        assert!(
            offenders.is_empty(),
            "OpenClaw compatibility wrappers must stay confined to kernel_runtime_authority.rs:\n{}",
            offenders.join("\n")
        );
    }

    #[test]
    fn openclaw_contract_exposes_managed_config_path_and_owned_runtime_roots() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let contract = KernelRuntimeAuthorityService::new()
            .contract("openclaw", &paths)
            .expect("openclaw contract");

        assert_eq!(contract.runtime_id, "openclaw");
        assert_eq!(
            contract.managed_config_path,
            paths.openclaw_managed_config_file
        );
        assert_eq!(
            contract.owned_runtime_roots,
            vec![
                paths.openclaw_runtime_dir.clone(),
                paths.machine_runtime_dir.join("runtimes").join("openclaw"),
            ]
        );
        assert!(contract.readiness_probe.supports_loopback_health_probe);
        assert_eq!(contract.readiness_probe.health_probe_timeout_ms, 750);
    }

    #[test]
    fn runtime_contract_rejects_unknown_runtime_id() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let error = KernelRuntimeAuthorityService::new()
            .contract("hermes", &paths)
            .expect_err("unknown kernel runtime should be rejected until adapter exists");

        assert!(!error.to_string().trim().is_empty());
    }

    #[test]
    fn record_openclaw_activation_result_persists_explicit_version_labels() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        initialize_machine_state(&paths).expect("initialize machine state");
        let install_key = "2026.4.11-beta.1-windows-x64";
        let fallback_install_key = "2026.4.9-windows-x64";
        let install_dir = paths.openclaw_runtime_dir.join(install_key);
        let fallback_install_dir = paths.openclaw_runtime_dir.join(fallback_install_key);
        fs::create_dir_all(&install_dir).expect("create install dir");
        fs::create_dir_all(&fallback_install_dir).expect("create fallback install dir");
        fs::write(
            install_dir.join("manifest.json"),
            r#"{
  "schemaVersion": 2,
  "runtimeId": "openclaw",
  "openclawVersion": "2026.4.11-beta.1",
  "requiredExternalRuntimes": ["nodejs"],
  "requiredExternalRuntimeVersions": {
    "nodejs": "22.16.0"
  },
  "platform": "windows",
  "arch": "x64",
  "cliRelativePath": "runtime/package/node_modules/openclaw/openclaw.mjs"
}"#,
        )
        .expect("write install manifest");
        fs::write(
            fallback_install_dir.join("manifest.json"),
            r#"{
  "schemaVersion": 2,
  "runtimeId": "openclaw",
  "openclawVersion": "2026.4.9",
  "requiredExternalRuntimes": ["nodejs"],
  "requiredExternalRuntimeVersions": {
    "nodejs": "22.16.0"
  },
  "platform": "windows",
  "arch": "x64",
  "cliRelativePath": "runtime/package/node_modules/openclaw/openclaw.mjs"
}"#,
        )
        .expect("write fallback manifest");
        fs::write(
            &paths.active_file,
            format!(
                r#"{{
  "layoutVersion": 1,
  "modules": {{}},
  "runtimes": {{
    "openclaw": {{
      "activeVersion": "{install_key}",
      "fallbackVersion": "{fallback_install_key}"
    }}
  }}
}}"#
            ),
        )
        .expect("write active state");

        KernelRuntimeAuthorityService::new()
            .record_activation_result("openclaw", &paths, install_key, None)
            .expect("record activation");

        let authority = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_authority_file).expect("authority json"),
        )
        .expect("parse authority json");
        let active = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.active_file).expect("active json"),
        )
        .expect("parse active json");
        let runtime_upgrades = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_runtime_upgrades_file)
                .expect("runtime upgrades json"),
        )
        .expect("parse runtime upgrades json");

        assert_eq!(
            authority.get("activeVersionLabel").and_then(Value::as_str),
            Some("2026.4.11-beta.1")
        );
        assert_eq!(
            authority
                .get("fallbackVersionLabel")
                .and_then(Value::as_str),
            Some("2026.4.9")
        );
        assert_eq!(
            active
                .pointer("/runtimes/openclaw/activeInstallKey")
                .and_then(Value::as_str),
            Some(install_key)
        );
        assert_eq!(
            active
                .pointer("/runtimes/openclaw/fallbackInstallKey")
                .and_then(Value::as_str),
            Some(fallback_install_key)
        );
        assert_eq!(
            active
                .pointer("/runtimes/openclaw/activeVersionLabel")
                .and_then(Value::as_str),
            Some("2026.4.11-beta.1")
        );
        assert_eq!(
            active
                .pointer("/runtimes/openclaw/fallbackVersionLabel")
                .and_then(Value::as_str),
            Some("2026.4.9")
        );
        assert_eq!(
            runtime_upgrades
                .pointer("/runtimes/openclaw/lastAppliedVersion")
                .and_then(Value::as_str),
            Some("2026.4.11-beta.1")
        );
        assert_eq!(
            runtime_upgrades
                .pointer("/runtimes/openclaw/activeVersionLabel")
                .and_then(Value::as_str),
            Some("2026.4.11-beta.1")
        );
        assert_eq!(
            runtime_upgrades
                .pointer("/runtimes/openclaw/fallbackVersionLabel")
                .and_then(Value::as_str),
            Some("2026.4.9")
        );
    }

    #[test]
    fn record_openclaw_activation_failure_keeps_existing_active_authority_state() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        initialize_machine_state(&paths).expect("initialize machine state");
        let active_install_key = "2026.4.9-windows-x64";
        let attempted_install_key = "2026.4.11-windows-x64";
        let active_install_dir = paths.openclaw_runtime_dir.join(active_install_key);
        let attempted_install_dir = paths.openclaw_runtime_dir.join(attempted_install_key);
        fs::create_dir_all(&active_install_dir).expect("create active install dir");
        fs::create_dir_all(&attempted_install_dir).expect("create attempted install dir");
        fs::write(
            active_install_dir.join("manifest.json"),
            r#"{
  "schemaVersion": 2,
  "runtimeId": "openclaw",
  "openclawVersion": "2026.4.9",
  "requiredExternalRuntimes": ["nodejs"],
  "requiredExternalRuntimeVersions": {
    "nodejs": "22.16.0"
  },
  "platform": "windows",
  "arch": "x64",
  "cliRelativePath": "runtime/package/node_modules/openclaw/openclaw.mjs"
}"#,
        )
        .expect("write active manifest");
        fs::write(
            attempted_install_dir.join("manifest.json"),
            r#"{
  "schemaVersion": 2,
  "runtimeId": "openclaw",
  "openclawVersion": "2026.4.11",
  "requiredExternalRuntimes": ["nodejs"],
  "requiredExternalRuntimeVersions": {
    "nodejs": "22.16.0"
  },
  "platform": "windows",
  "arch": "x64",
  "cliRelativePath": "runtime/package/node_modules/openclaw/openclaw.mjs"
}"#,
        )
        .expect("write attempted manifest");
        fs::write(
            &paths.openclaw_authority_file,
            format!(
                r#"{{
  "layoutVersion": 1,
  "runtimeId": "openclaw",
  "activeInstallKey": "{active_install_key}",
  "fallbackInstallKey": null,
  "activeVersionLabel": "2026.4.9",
  "fallbackVersionLabel": null,
  "managedConfigPath": null,
  "ownedRuntimeRoots": [],
  "legacyRuntimeRoots": [],
  "quarantinedPaths": [],
  "lastActivationAt": "2026-04-14T00:00:00Z",
  "lastError": null
}}"#
            ),
        )
        .expect("write authority state");

        KernelRuntimeAuthorityService::new()
            .record_activation_result(
                "openclaw",
                &paths,
                attempted_install_key,
                Some("simulated startup failure"),
            )
            .expect("record failure");

        let authority = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_authority_file).expect("authority json"),
        )
        .expect("parse authority json");
        let runtime_upgrades = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_runtime_upgrades_file)
                .expect("runtime upgrades json"),
        )
        .expect("parse runtime upgrades json");

        assert_eq!(
            authority.get("activeInstallKey").and_then(Value::as_str),
            Some(active_install_key)
        );
        assert_eq!(
            authority.get("activeVersionLabel").and_then(Value::as_str),
            Some("2026.4.9")
        );
        assert_eq!(
            authority.get("lastActivationAt").and_then(Value::as_str),
            Some("2026-04-14T00:00:00Z")
        );
        assert_eq!(
            authority.get("lastError").and_then(Value::as_str),
            Some("simulated startup failure")
        );
        assert_eq!(
            runtime_upgrades
                .pointer("/runtimes/openclaw/lastAttemptedVersion")
                .and_then(Value::as_str),
            Some("2026.4.11")
        );
        assert_eq!(
            runtime_upgrades
                .pointer("/runtimes/openclaw/lastAppliedVersion")
                .and_then(Value::as_str),
            None
        );
    }
}
