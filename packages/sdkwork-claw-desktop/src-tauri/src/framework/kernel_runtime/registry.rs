use std::path::{Path, PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KernelPaths {
    pub runtime_id: String,
    pub runtime_root: PathBuf,
    pub machine_state_dir: PathBuf,
    pub authority_file: PathBuf,
    pub migrations_file: PathBuf,
    pub upgrades_file: PathBuf,
    pub managed_config_dir: PathBuf,
    pub managed_config_file: PathBuf,
    pub quarantine_dir: PathBuf,
}

pub fn build_kernel_paths(runtime_id: &str, runtimes_dir: &Path, kernels_state_dir: &Path) -> KernelPaths {
    let machine_state_dir = kernels_state_dir.join(runtime_id);
    let managed_config_dir = machine_state_dir.join("managed-config");

    KernelPaths {
        runtime_id: runtime_id.to_string(),
        runtime_root: runtimes_dir.join(runtime_id),
        machine_state_dir: machine_state_dir.clone(),
        authority_file: machine_state_dir.join("authority.json"),
        migrations_file: machine_state_dir.join("migrations.json"),
        upgrades_file: machine_state_dir.join("runtime-upgrades.json"),
        managed_config_dir: managed_config_dir.clone(),
        managed_config_file: managed_config_dir.join(format!("{runtime_id}.json")),
        quarantine_dir: machine_state_dir.join("quarantine"),
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_adapter;
    use crate::framework::paths::resolve_paths_for_root;

    #[test]
    fn resolves_openclaw_adapter_from_registry() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let adapter = resolve_adapter("openclaw").expect("openclaw adapter");
        let contract = adapter.contract(&paths).expect("openclaw contract");

        assert_eq!(adapter.runtime_id(), "openclaw");
        assert_eq!(
            contract.managed_config_path,
            paths.kernel_paths("openclaw").managed_config_file
        );
    }
}
