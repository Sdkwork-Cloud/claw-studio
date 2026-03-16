use super::{profiles::StorageDriverScope, registry::StorageDriver};
use crate::framework::{storage::StorageProviderKind, FrameworkError, Result};
use std::{
    collections::BTreeMap,
    fs,
    path::Path,
    sync::{Arc, Mutex, MutexGuard},
};

type NamespaceStore = BTreeMap<String, String>;
type ProfileNamespaceStore = BTreeMap<String, NamespaceStore>;
type MemoryStorageState = BTreeMap<String, ProfileNamespaceStore>;
type LocalFileStorageDocument = BTreeMap<String, NamespaceStore>;

#[derive(Clone, Debug, Default)]
pub struct LocalFileStorageDriver {
    lock: Arc<Mutex<()>>,
}

#[derive(Clone, Debug, Default)]
pub struct MemoryStorageDriver {
    state: Arc<Mutex<MemoryStorageState>>,
}

#[derive(Clone, Debug)]
pub struct UnavailableStorageDriver {
    kind: StorageProviderKind,
    reason: String,
}

impl StorageDriver for LocalFileStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let _guard = self.lock()?;
        let document = self.read_document(scope.path()?)?;
        Ok(document
            .get(scope.namespace.as_str())
            .and_then(|entries| entries.get(key))
            .cloned())
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let _guard = self.lock()?;
        let path = scope.path()?;
        let mut document = self.read_document(path)?;
        let namespace_entries = document.entry(scope.namespace.clone()).or_default();
        namespace_entries.insert(key.to_string(), value.to_string());
        self.write_document(path, &document)
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let _guard = self.lock()?;
        let path = scope.path()?;
        let mut document = self.read_document(path)?;
        let existed = if let Some(namespace_entries) = document.get_mut(scope.namespace.as_str()) {
            let existed = namespace_entries.remove(key).is_some();
            if namespace_entries.is_empty() {
                document.remove(scope.namespace.as_str());
            }
            existed
        } else {
            false
        };

        if existed {
            self.write_document(path, &document)?;
        }

        Ok(existed)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let _guard = self.lock()?;
        let document = self.read_document(scope.path()?)?;
        Ok(document
            .get(scope.namespace.as_str())
            .map(|entries| entries.keys().cloned().collect())
            .unwrap_or_default())
    }
}

impl LocalFileStorageDriver {
    fn lock(&self) -> Result<MutexGuard<'_, ()>> {
        self.lock
            .lock()
            .map_err(|_| FrameworkError::Internal("storage driver lock poisoned".to_string()))
    }

    fn read_document(&self, path: &Path) -> Result<LocalFileStorageDocument> {
        if !path.exists() {
            return Ok(BTreeMap::new());
        }

        let content = fs::read_to_string(path)?;
        if content.trim().is_empty() {
            return Ok(BTreeMap::new());
        }

        Ok(serde_json::from_str::<LocalFileStorageDocument>(&content)?)
    }

    fn write_document(&self, path: &Path, document: &LocalFileStorageDocument) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(document)?;
        fs::write(path, content)?;
        Ok(())
    }
}

impl StorageDriver for MemoryStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let state = self.state()?;
        Ok(state
            .get(scope.profile_id.as_str())
            .and_then(|namespaces| namespaces.get(scope.namespace.as_str()))
            .and_then(|entries| entries.get(key))
            .cloned())
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let mut state = self.state()?;
        let namespaces = state.entry(scope.profile_id.clone()).or_default();
        let entries = namespaces.entry(scope.namespace.clone()).or_default();
        entries.insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let mut state = self.state()?;
        let existed = if let Some(namespaces) = state.get_mut(scope.profile_id.as_str()) {
            let existed = if let Some(entries) = namespaces.get_mut(scope.namespace.as_str()) {
                let existed = entries.remove(key).is_some();
                if entries.is_empty() {
                    namespaces.remove(scope.namespace.as_str());
                }
                existed
            } else {
                false
            };

            if namespaces.is_empty() {
                state.remove(scope.profile_id.as_str());
            }

            existed
        } else {
            false
        };

        Ok(existed)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let state = self.state()?;
        Ok(state
            .get(scope.profile_id.as_str())
            .and_then(|namespaces| namespaces.get(scope.namespace.as_str()))
            .map(|entries| entries.keys().cloned().collect())
            .unwrap_or_default())
    }
}

impl MemoryStorageDriver {
    fn state(&self) -> Result<MutexGuard<'_, MemoryStorageState>> {
        self.state
            .lock()
            .map_err(|_| FrameworkError::Internal("storage driver state poisoned".to_string()))
    }
}

impl UnavailableStorageDriver {
    pub fn new(kind: StorageProviderKind, reason: String) -> Self {
        Self { kind, reason }
    }

    fn error(&self) -> FrameworkError {
        FrameworkError::InvalidOperation(self.reason.clone())
    }
}

impl StorageDriver for UnavailableStorageDriver {
    fn get_text(&self, _scope: &StorageDriverScope, _key: &str) -> Result<Option<String>> {
        let _ = &self.kind;
        Err(self.error())
    }

    fn put_text(&self, _scope: &StorageDriverScope, _key: &str, _value: &str) -> Result<()> {
        let _ = &self.kind;
        Err(self.error())
    }

    fn delete(&self, _scope: &StorageDriverScope, _key: &str) -> Result<bool> {
        let _ = &self.kind;
        Err(self.error())
    }

    fn list_keys(&self, _scope: &StorageDriverScope) -> Result<Vec<String>> {
        let _ = &self.kind;
        Err(self.error())
    }
}

#[cfg(test)]
mod tests {
    use super::StorageDriverScope;
    use super::{
        LocalFileStorageDriver, MemoryStorageDriver, StorageDriver, UnavailableStorageDriver,
    };
    use crate::framework::storage::StorageProviderKind;

    #[test]
    fn local_file_driver_persists_values_across_driver_instances() {
        let root = tempfile::tempdir().expect("temp dir");
        let path = root.path().join("profiles/default-local.json");
        let scope = storage_scope(
            "default-local",
            StorageProviderKind::LocalFile,
            "claw-studio",
            Some(path),
        );

        let first = LocalFileStorageDriver::default();
        first
            .put_text(&scope, "welcome", "desktop kernel")
            .expect("put text");

        let reopened = LocalFileStorageDriver::default();
        let value = reopened.get_text(&scope, "welcome").expect("get text");

        assert_eq!(value.as_deref(), Some("desktop kernel"));
    }

    #[test]
    fn memory_driver_stores_values_in_process_only() {
        let scope = storage_scope(
            "volatile-memory",
            StorageProviderKind::Memory,
            "volatile",
            None,
        );
        let driver = MemoryStorageDriver::default();

        driver
            .put_text(&scope, "session", "ready")
            .expect("put text");
        let value = driver.get_text(&scope, "session").expect("get text");
        let isolated = MemoryStorageDriver::default()
            .get_text(&scope, "session")
            .expect("isolated get text");

        assert_eq!(value.as_deref(), Some("ready"));
        assert_eq!(isolated, None);
    }

    #[test]
    fn unavailable_driver_returns_stable_runtime_errors() {
        let scope = storage_scope("sqlite-runtime", StorageProviderKind::Sqlite, "data", None);
        let driver = UnavailableStorageDriver::new(
            StorageProviderKind::Sqlite,
            "storage driver \"sqlite\" is not implemented yet".to_string(),
        );

        let error = driver
            .get_text(&scope, "mode")
            .expect_err("sqlite runtime access should not be available yet");

        assert_eq!(
            error.to_string(),
            "invalid operation: storage driver \"sqlite\" is not implemented yet"
        );
    }

    fn storage_scope(
        profile_id: &str,
        provider: StorageProviderKind,
        namespace: &str,
        path: Option<std::path::PathBuf>,
    ) -> StorageDriverScope {
        StorageDriverScope {
            profile_id: profile_id.to_string(),
            provider,
            namespace: namespace.to_string(),
            read_only: false,
            path,
            connection: None,
            database: None,
            endpoint: None,
        }
    }
}
