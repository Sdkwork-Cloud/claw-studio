use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::internal::node_sessions::PersistedNodeSessionCatalog;
use crate::rollout::control_plane::PersistedRolloutCatalog;
use crate::storage::node_session_store::NodeSessionCatalogStore;
use crate::storage::rollout_store::RolloutCatalogStore;
use crate::storage::StorageError;

const SQLITE_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS host_catalog_documents (
    catalog_key TEXT PRIMARY KEY,
    document_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
"#;

const ROLLOUT_CATALOG_KEY: &str = "rollout-catalog";
const NODE_SESSION_CATALOG_KEY: &str = "node-session-catalog";

#[derive(Debug, Clone)]
pub(crate) struct SqliteCatalogDatabase {
    path: PathBuf,
    lock: Arc<Mutex<()>>,
}

impl SqliteCatalogDatabase {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self {
            path,
            lock: Arc::new(Mutex::new(())),
        }
    }

    fn load_document<T>(&self, catalog_key: &str) -> Result<Option<T>, StorageError>
    where
        T: DeserializeOwned,
    {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT document_json FROM host_catalog_documents WHERE catalog_key = ?1",
                    params![catalog_key],
                    |row| row.get::<_, String>(0),
                )
                .optional()
        })?
        .map(|document_json| serde_json::from_str::<T>(&document_json).map_err(StorageError::from))
        .transpose()
    }

    fn save_document<T>(&self, catalog_key: &str, document: &T) -> Result<(), StorageError>
    where
        T: Serialize,
    {
        let document_json = serde_json::to_string_pretty(document)?;
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO host_catalog_documents (catalog_key, document_json, updated_at)
                 VALUES (?1, ?2, unixepoch() * 1000)
                 ON CONFLICT(catalog_key)
                 DO UPDATE SET document_json = excluded.document_json,
                               updated_at = excluded.updated_at",
                params![catalog_key, document_json],
            )?;
            Ok(())
        })
    }

    fn with_connection<T, F>(&self, operation: F) -> Result<T, StorageError>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let _guard = self.lock()?;
        ensure_parent_directory(&self.path)?;
        let connection = Connection::open(&self.path)?;
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.execute_batch(SQLITE_SCHEMA_SQL)?;
        operation(&connection).map_err(StorageError::from)
    }

    fn lock(&self) -> Result<MutexGuard<'_, ()>, StorageError> {
        self.lock
            .lock()
            .map_err(|_| StorageError::Message("sqlite storage driver lock poisoned".to_string()))
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteRolloutCatalogStore {
    database: SqliteCatalogDatabase,
}

impl SqliteRolloutCatalogStore {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self {
            database: SqliteCatalogDatabase::new(path),
        }
    }
}

impl RolloutCatalogStore for SqliteRolloutCatalogStore {
    fn load_catalog(&self) -> Result<Option<PersistedRolloutCatalog>, StorageError> {
        self.database.load_document(ROLLOUT_CATALOG_KEY)
    }

    fn save_catalog(&self, catalog: &PersistedRolloutCatalog) -> Result<(), StorageError> {
        self.database.save_document(ROLLOUT_CATALOG_KEY, catalog)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteNodeSessionCatalogStore {
    database: SqliteCatalogDatabase,
}

impl SqliteNodeSessionCatalogStore {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self {
            database: SqliteCatalogDatabase::new(path),
        }
    }
}

impl NodeSessionCatalogStore for SqliteNodeSessionCatalogStore {
    fn load_catalog(&self) -> Result<Option<PersistedNodeSessionCatalog>, StorageError> {
        self.database.load_document(NODE_SESSION_CATALOG_KEY)
    }

    fn save_catalog(&self, catalog: &PersistedNodeSessionCatalog) -> Result<(), StorageError> {
        self.database
            .save_document(NODE_SESSION_CATALOG_KEY, catalog)
    }
}

fn ensure_parent_directory(path: &Path) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| StorageError::Message(format!("sqlite storage io error: {error}")))?;
    }

    Ok(())
}
