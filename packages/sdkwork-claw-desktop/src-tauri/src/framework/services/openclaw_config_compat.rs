use crate::framework::{layout::KernelAuthorityState, paths::AppPaths, Result};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn legacy_openclaw_config_file_path(paths: &AppPaths) -> PathBuf {
    paths
        .openclaw_kernel_dir
        .join("managed-config")
        .join("openclaw.json")
}

pub fn read_openclaw_authority_state_file(authority_file: &Path) -> Result<KernelAuthorityState> {
    let content = fs::read_to_string(authority_file)?;
    parse_openclaw_authority_state_json(&content)
}

pub fn resolve_legacy_openclaw_config_source_path(
    paths: &AppPaths,
    config_file_path: &Path,
) -> Result<Option<PathBuf>> {
    let mut candidates = Vec::new();
    if paths.openclaw_authority_file.is_file() {
        let authority = read_openclaw_authority_state_file(&paths.openclaw_authority_file)?;
        if let Some(stored_path) = authority
            .config_file_path
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
        {
            push_unique_path(&mut candidates, stored_path);
        }
    }
    push_unique_path(&mut candidates, legacy_openclaw_config_file_path(paths));

    Ok(candidates
        .into_iter()
        .find(|candidate| candidate != config_file_path && candidate.is_file()))
}

pub fn parse_openclaw_authority_state_json(content: &str) -> Result<KernelAuthorityState> {
    let mut root = serde_json::from_str::<Value>(content)?;
    normalize_legacy_openclaw_authority_json(&mut root);
    serde_json::from_value::<KernelAuthorityState>(root).map_err(Into::into)
}

fn normalize_legacy_openclaw_authority_json(root: &mut Value) {
    let Some(object) = root.as_object_mut() else {
        return;
    };

    if object.contains_key("configFilePath") {
        return;
    }

    if let Some(legacy_config_file_path) = object.remove("managedConfigPath") {
        object.insert("configFilePath".to_string(), legacy_config_file_path);
    }
}

fn push_unique_path(target: &mut Vec<PathBuf>, value: PathBuf) {
    if !target.iter().any(|existing| existing == &value) {
        target.push(value);
    }
}

#[cfg(test)]
mod tests {
    use super::parse_openclaw_authority_state_json;
    use crate::framework::{
        layout::{initialize_machine_state, KernelAuthorityState},
        paths::resolve_paths_for_root,
    };
    use serde_json::Value;

    #[test]
    fn parse_openclaw_authority_state_json_reads_legacy_managed_config_key() {
        let authority = parse_openclaw_authority_state_json(
            r#"{
  "managedConfigPath": "/legacy/openclaw.json"
}"#,
        )
        .expect("legacy authority json");

        assert_eq!(
            authority.config_file_path.as_deref(),
            Some("/legacy/openclaw.json")
        );
    }

    #[test]
    fn parse_openclaw_authority_state_json_prefers_canonical_config_file_path() {
        let authority = parse_openclaw_authority_state_json(
            r#"{
  "configFilePath": "/canonical/openclaw.json",
  "managedConfigPath": "/legacy/openclaw.json"
}"#,
        )
        .expect("authority json");

        assert_eq!(
            authority.config_file_path.as_deref(),
            Some("/canonical/openclaw.json")
        );
    }

    #[test]
    fn kernel_authority_state_generic_deserialization_ignores_legacy_managed_config_key() {
        let authority = serde_json::from_str::<KernelAuthorityState>(
            r#"{
  "managedConfigPath": "/legacy/openclaw.json"
}"#,
        )
        .expect("legacy authority json parses canonically");

        assert!(authority.config_file_path.is_none());
    }

    #[test]
    fn initialize_machine_state_rewrites_legacy_openclaw_config_key_to_canonical_config_file_path(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let openclaw = paths
            .kernel_paths("openclaw")
            .expect("openclaw kernel paths");

        std::fs::create_dir_all(
            openclaw
                .authority_file
                .parent()
                .expect("authority file parent"),
        )
        .expect("create authority dir");
        std::fs::write(
            &openclaw.authority_file,
            r#"{
  "managedConfigPath": "/legacy/openclaw.json"
}"#,
        )
        .expect("write legacy authority");

        initialize_machine_state(&paths).expect("initialize machine state");

        let authority_json = serde_json::from_str::<Value>(
            &std::fs::read_to_string(&openclaw.authority_file).expect("authority file"),
        )
        .expect("authority json value");
        assert_eq!(
            authority_json
                .get("configFilePath")
                .and_then(Value::as_str),
            Some("/legacy/openclaw.json")
        );
        assert!(authority_json.get("managedConfigPath").is_none());
    }
}
