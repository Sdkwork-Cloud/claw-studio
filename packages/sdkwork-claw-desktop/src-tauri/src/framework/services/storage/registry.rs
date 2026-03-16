use super::{
    drivers::{LocalFileStorageDriver, MemoryStorageDriver, UnavailableStorageDriver},
    profiles::StorageDriverScope,
};
use crate::framework::{
    storage::{StorageAvailability, StorageCapabilities, StorageProviderInfo, StorageProviderKind},
    FrameworkError, Result,
};
use std::{collections::BTreeMap, sync::Arc};

#[derive(Clone, Debug, Default)]
pub struct StorageDriverRegistry {
    drivers: BTreeMap<StorageProviderKind, RegisteredStorageDriver>,
}

#[derive(Clone)]
struct RegisteredStorageDriver {
    info: StorageProviderInfo,
    driver: Arc<dyn StorageDriver>,
}

impl std::fmt::Debug for RegisteredStorageDriver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RegisteredStorageDriver")
            .field("info", &self.info)
            .finish()
    }
}

pub trait StorageDriver: Send + Sync + std::fmt::Debug {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>>;
    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()>;
    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool>;
    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>>;
}

impl StorageDriverRegistry {
    pub fn with_built_in_drivers() -> Self {
        let mut registry = Self::default();
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::Memory),
            Arc::new(MemoryStorageDriver::default()),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::LocalFile),
            Arc::new(LocalFileStorageDriver::default()),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::Sqlite),
            Arc::new(UnavailableStorageDriver::new(
                StorageProviderKind::Sqlite,
                "storage driver \"sqlite\" is not implemented yet".to_string(),
            )),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::Postgres),
            Arc::new(UnavailableStorageDriver::new(
                StorageProviderKind::Postgres,
                "storage driver \"postgres\" is not implemented yet".to_string(),
            )),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::RemoteApi),
            Arc::new(UnavailableStorageDriver::new(
                StorageProviderKind::RemoteApi,
                "storage driver \"remote-api\" is not implemented yet".to_string(),
            )),
        );
        registry
    }

    pub fn register_driver(
        &mut self,
        info: StorageProviderInfo,
        driver: Arc<dyn StorageDriver>,
    ) -> &mut Self {
        self.drivers
            .insert(info.kind.clone(), RegisteredStorageDriver { info, driver });
        self
    }

    pub fn providers(&self) -> Vec<StorageProviderInfo> {
        self.drivers
            .values()
            .map(|registered| registered.info.clone())
            .collect()
    }

    pub(crate) fn get(&self, kind: &StorageProviderKind) -> Result<&dyn StorageDriver> {
        self.drivers
            .get(kind)
            .map(|registered| registered.driver.as_ref())
            .ok_or_else(|| {
                FrameworkError::NotFound(format!(
                    "storage driver registry entry for provider \"{}\"",
                    kind.id()
                ))
            })
    }
}

pub(crate) fn built_in_provider_info(kind: StorageProviderKind) -> StorageProviderInfo {
    let capabilities = capabilities_for_kind(&kind);
    let availability = availability_for_provider(&kind);

    StorageProviderInfo {
        id: kind.id().to_string(),
        label: kind.label().to_string(),
        kind,
        availability,
        requires_configuration: requires_configuration(&capabilities),
        capabilities,
    }
}

fn requires_configuration(capabilities: &StorageCapabilities) -> bool {
    capabilities.remote || capabilities.queryable
}

fn availability_for_provider(kind: &StorageProviderKind) -> StorageAvailability {
    match kind {
        StorageProviderKind::Memory | StorageProviderKind::LocalFile => StorageAvailability::Ready,
        StorageProviderKind::Sqlite => StorageAvailability::Planned,
        StorageProviderKind::Postgres | StorageProviderKind::RemoteApi => {
            StorageAvailability::ConfigurationRequired
        }
    }
}

fn capabilities_for_kind(kind: &StorageProviderKind) -> StorageCapabilities {
    match kind {
        StorageProviderKind::Memory => StorageCapabilities {
            durable: false,
            structured: true,
            queryable: false,
            transactional: false,
            remote: false,
        },
        StorageProviderKind::LocalFile => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: false,
            transactional: false,
            remote: false,
        },
        StorageProviderKind::Sqlite => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: true,
            transactional: true,
            remote: false,
        },
        StorageProviderKind::Postgres => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: true,
            transactional: true,
            remote: true,
        },
        StorageProviderKind::RemoteApi => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: true,
            transactional: false,
            remote: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::StorageDriverRegistry;
    use crate::framework::storage::StorageProviderKind;

    #[test]
    fn built_in_storage_registry_includes_pluggable_backends() {
        let providers = StorageDriverRegistry::with_built_in_drivers().providers();

        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::Memory));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::LocalFile));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::Sqlite));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::Postgres));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::RemoteApi));
    }
}
