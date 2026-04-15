use crate::framework::{
    kernel_runtime::{KernelRuntimeAdapter, KernelRuntimeContract, KernelRuntimeReadinessProbe},
    paths::AppPaths,
    Result,
};

const OPENCLAW_HEALTH_PROBE_TIMEOUT_MS: u64 = 750;

#[derive(Clone, Debug, Default)]
pub struct KernelRuntimeAuthorityService;

impl KernelRuntimeAuthorityService {
    pub fn new() -> Self {
        Self
    }

    pub fn openclaw_contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract> {
        let adapter = OpenClawKernelAdapter::new();
        self.contract_for_adapter(&adapter, paths)
    }

    fn contract_for_adapter(
        &self,
        adapter: &dyn KernelRuntimeAdapter,
        paths: &AppPaths,
    ) -> Result<KernelRuntimeContract> {
        adapter.contract(paths)
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
        "openclaw"
    }

    fn contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract> {
        Ok(KernelRuntimeContract {
            runtime_id: self.runtime_id().to_string(),
            managed_config_path: paths.openclaw_managed_config_file.clone(),
            owned_runtime_roots: vec![
                paths.openclaw_runtime_dir.clone(),
                paths.machine_runtime_dir.join("runtimes").join("openclaw"),
            ],
            readiness_probe: KernelRuntimeReadinessProbe {
                supports_loopback_health_probe: true,
                health_probe_timeout_ms: OPENCLAW_HEALTH_PROBE_TIMEOUT_MS,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::KernelRuntimeAuthorityService;
    use crate::framework::paths::resolve_paths_for_root;

    #[test]
    fn openclaw_contract_exposes_managed_config_path_and_owned_runtime_roots() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let contract = KernelRuntimeAuthorityService::new()
            .openclaw_contract(&paths)
            .expect("openclaw contract");

        assert_eq!(contract.runtime_id, "openclaw");
        assert_eq!(contract.managed_config_path, paths.openclaw_managed_config_file);
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
}
