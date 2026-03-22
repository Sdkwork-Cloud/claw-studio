use crate::framework::{paths::AppPaths, FrameworkError, Result};
use flate2::read::GzDecoder;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant},
};
use tar::Archive;
use tauri::{AppHandle, Manager, Runtime};
use zip::ZipArchive;

const MANIFEST_FILE_NAME: &str = "manifest.json";
const EXTRACTION_MARKER_FILE_NAME: &str = ".claw-sdkwork-api-router-extracted.json";
const CLAW_METADATA_DIR_NAME: &str = "claw-studio";
const DEFAULT_DATABASE_FILE_NAME: &str = "sdkwork-api-server.db";
const DEFAULT_GATEWAY_BIND: &str = "127.0.0.1:8080";
const DEFAULT_ADMIN_BIND: &str = "127.0.0.1:8081";
const DEFAULT_GATEWAY_HEALTH_PATH: &str = "/health";
const DEFAULT_ADMIN_HEALTH_PATH: &str = "/admin/health";
const SDKWORK_CONFIG_DIR_ENV_KEY: &str = "SDKWORK_CONFIG_DIR";
const SDKWORK_GATEWAY_BIND_ENV_KEY: &str = "SDKWORK_GATEWAY_BIND";
const SDKWORK_ADMIN_BIND_ENV_KEY: &str = "SDKWORK_ADMIN_BIND";
const SDKWORK_ADMIN_JWT_SIGNING_SECRET_ENV_KEY: &str = "SDKWORK_ADMIN_JWT_SIGNING_SECRET";
const ROUTER_HEALTH_TIMEOUT_MS: u64 = 5_000;
const ROUTER_HEALTH_POLL_INTERVAL_MS: u64 = 50;
const ADMIN_JWT_ISSUER: &str = "sdkwork-admin";
const ADMIN_JWT_AUDIENCE: &str = "sdkwork-admin-ui";
const CLAW_ADMIN_JWT_TTL_SECS: u64 = 60 * 5;
const ADMIN_JWT_SECRET_FILE_NAME: &str = "admin-jwt-secret";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ApiRouterOwnershipMode {
    Uninitialized,
    Attached,
    Managed,
    Stopped,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ApiRouterRuntimeSnapshot {
    pub ownership: ApiRouterOwnershipMode,
    pub router_home_dir: PathBuf,
    pub extraction_dir: PathBuf,
    pub admin_pid: Option<u32>,
    pub gateway_pid: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ApiRouterHealthStatus {
    pub admin_healthy: bool,
    pub gateway_healthy: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ApiRouterProcessKind {
    Admin,
    Gateway,
}

#[derive(Clone, Debug)]
pub struct ApiRouterRuntimeOptions {
    pub artifact_root: PathBuf,
    pub managed_root_dir: PathBuf,
    pub router_home_dir: PathBuf,
    pub target_key: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterDesktopAuthSession {
    pub user_id: String,
    pub email: String,
    pub display_name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterAdminToken {
    pub token: String,
    pub subject: String,
    pub expires_at_epoch_seconds: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct AdminJwtClaims {
    sub: String,
    iss: String,
    aud: String,
    exp: usize,
    iat: usize,
}

pub trait ApiRouterHealthChecker: Send + Sync {
    fn probe(&self) -> Result<ApiRouterHealthStatus>;
}

pub trait ApiRouterProcessHandle: Send {
    fn pid(&self) -> Option<u32>;
    fn kill(&mut self) -> Result<()>;
    fn wait(&mut self) -> Result<Option<i32>>;
}

pub trait ApiRouterProcessSpawner: Send + Sync {
    fn spawn(
        &self,
        kind: ApiRouterProcessKind,
        executable: &Path,
        router_home_dir: &Path,
        env: &BTreeMap<String, String>,
    ) -> Result<Box<dyn ApiRouterProcessHandle>>;
}

#[derive(Clone)]
pub struct ApiRouterRuntimeService {
    options: ApiRouterRuntimeOptions,
    health_checker: Arc<dyn ApiRouterHealthChecker>,
    process_spawner: Arc<dyn ApiRouterProcessSpawner>,
    state: Arc<Mutex<ApiRouterRuntimeState>>,
}

impl std::fmt::Debug for ApiRouterRuntimeService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiRouterRuntimeService")
            .field("options", &self.options)
            .finish()
    }
}

struct ApiRouterRuntimeState {
    ownership: ApiRouterOwnershipMode,
    extraction_dir: PathBuf,
    admin_pid: Option<u32>,
    gateway_pid: Option<u32>,
    managed_admin: Option<Box<dyn ApiRouterProcessHandle>>,
    managed_gateway: Option<Box<dyn ApiRouterProcessHandle>>,
    auth_session: Option<ApiRouterDesktopAuthSession>,
}

#[derive(Debug, Deserialize)]
struct ApiRouterArtifactManifest {
    version: String,
    archives: BTreeMap<String, ApiRouterArtifactArchive>,
}

#[derive(Debug, Deserialize)]
struct ApiRouterArtifactArchive {
    path: String,
    sha256: String,
    binaries: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiRouterExtractionMarker {
    version: String,
    target_key: String,
    archive_sha256: String,
}

#[derive(Debug)]
struct ResolvedApiRouterArtifact {
    version: String,
    archive_sha256: String,
    archive_path: PathBuf,
    extraction_dir: PathBuf,
    admin_binary_name: String,
    gateway_binary_name: String,
}

struct DefaultHealthChecker;

struct DefaultProcessSpawner;

struct StdProcessHandle {
    child: Child,
}

impl ApiRouterRuntimeService {
    pub fn from_app<R: Runtime>(app: &AppHandle<R>, paths: &AppPaths) -> Result<Self> {
        Ok(Self::new(ApiRouterRuntimeOptions {
            artifact_root: resolve_artifact_root(app)?,
            managed_root_dir: paths.machine_runtime_dir.join("sdkwork-api-router"),
            router_home_dir: resolve_router_home_dir(app)?,
            target_key: resolve_target_key()?,
        }))
    }

    #[cfg(test)]
    pub fn for_test(paths: &AppPaths) -> Self {
        Self::new(ApiRouterRuntimeOptions {
            artifact_root: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("vendor")
                .join("sdkwork-api-router-artifacts"),
            managed_root_dir: paths.machine_runtime_dir.join("sdkwork-api-router"),
            router_home_dir: paths.user_root.join("shared-router"),
            target_key: resolve_target_key().unwrap_or_else(|_| "windows-x64".to_string()),
        })
    }

    pub fn new(options: ApiRouterRuntimeOptions) -> Self {
        Self::new_with_dependencies(
            options,
            Arc::new(DefaultHealthChecker),
            Arc::new(DefaultProcessSpawner),
        )
    }

    pub fn new_with_dependencies(
        options: ApiRouterRuntimeOptions,
        health_checker: Arc<dyn ApiRouterHealthChecker>,
        process_spawner: Arc<dyn ApiRouterProcessSpawner>,
    ) -> Self {
        Self {
            state: Arc::new(Mutex::new(ApiRouterRuntimeState {
                ownership: ApiRouterOwnershipMode::Uninitialized,
                extraction_dir: options.managed_root_dir.clone(),
                admin_pid: None,
                gateway_pid: None,
                managed_admin: None,
                managed_gateway: None,
                auth_session: None,
            })),
            options,
            health_checker,
            process_spawner,
        }
    }

    #[cfg(test)]
    pub fn ensure_artifacts_ready(&self) -> Result<PathBuf> {
        let artifact = self.resolve_artifact()?;
        self.extract_artifact_if_needed(&artifact)?;
        Ok(artifact.extraction_dir)
    }

    pub fn ensure_started_or_attached(&self) -> Result<ApiRouterRuntimeSnapshot> {
        let current = self.snapshot()?;
        if matches!(
            current.ownership,
            ApiRouterOwnershipMode::Attached | ApiRouterOwnershipMode::Managed
        ) {
            return Ok(current);
        }

        let artifact = self.resolve_artifact()?;
        self.extract_artifact_if_needed(&artifact)?;
        self.ensure_router_home_layout()?;

        let initial_health = self.health_checker.probe()?;
        if initial_health.admin_healthy && initial_health.gateway_healthy {
            let snapshot = ApiRouterRuntimeSnapshot {
                ownership: ApiRouterOwnershipMode::Attached,
                router_home_dir: self.options.router_home_dir.clone(),
                extraction_dir: artifact.extraction_dir.clone(),
                admin_pid: None,
                gateway_pid: None,
            };
            self.replace_state(snapshot.clone(), None, None)?;
            return Ok(snapshot);
        }

        let admin_executable =
            find_file_by_name(&artifact.extraction_dir, artifact.admin_binary_name.as_str())?;
        let gateway_executable =
            find_file_by_name(&artifact.extraction_dir, artifact.gateway_binary_name.as_str())?;
        let process_env = self.build_process_env()?;

        let mut admin = self.process_spawner.spawn(
            ApiRouterProcessKind::Admin,
            &admin_executable,
            &self.options.router_home_dir,
            &process_env,
        )?;
        let admin_pid = admin.pid();

        let mut gateway = match self.process_spawner.spawn(
            ApiRouterProcessKind::Gateway,
            &gateway_executable,
            &self.options.router_home_dir,
            &process_env,
        ) {
            Ok(handle) => handle,
            Err(error) => {
                let _ = terminate_process(admin.as_mut());
                return Err(error);
            }
        };
        let gateway_pid = gateway.pid();

        if let Err(error) = self.wait_for_healthy_router() {
            let _ = terminate_process(gateway.as_mut());
            let _ = terminate_process(admin.as_mut());
            return Err(error);
        }

        let snapshot = ApiRouterRuntimeSnapshot {
            ownership: ApiRouterOwnershipMode::Managed,
            router_home_dir: self.options.router_home_dir.clone(),
            extraction_dir: artifact.extraction_dir.clone(),
            admin_pid,
            gateway_pid,
        };
        self.replace_state(snapshot.clone(), Some(admin), Some(gateway))?;
        Ok(snapshot)
    }

    pub fn stop_managed(&self) -> Result<ApiRouterRuntimeSnapshot> {
        let (ownership, extraction_dir, mut admin, mut gateway) = {
            let mut state = self.lock_state()?;
            (
                state.ownership.clone(),
                state.extraction_dir.clone(),
                state.managed_admin.take(),
                state.managed_gateway.take(),
            )
        };

        if ownership != ApiRouterOwnershipMode::Managed {
            return self.snapshot();
        }

        if let Some(process) = gateway.as_mut() {
            terminate_process(process.as_mut())?;
        }
        if let Some(process) = admin.as_mut() {
            terminate_process(process.as_mut())?;
        }

        let snapshot = ApiRouterRuntimeSnapshot {
            ownership: ApiRouterOwnershipMode::Stopped,
            router_home_dir: self.options.router_home_dir.clone(),
            extraction_dir,
            admin_pid: None,
            gateway_pid: None,
        };
        self.replace_state(snapshot.clone(), None, None)?;
        Ok(snapshot)
    }

    pub fn snapshot(&self) -> Result<ApiRouterRuntimeSnapshot> {
        let state = self.lock_state()?;
        Ok(ApiRouterRuntimeSnapshot {
            ownership: state.ownership.clone(),
            router_home_dir: self.options.router_home_dir.clone(),
            extraction_dir: state.extraction_dir.clone(),
            admin_pid: state.admin_pid,
            gateway_pid: state.gateway_pid,
        })
    }

    pub fn sync_auth_session(&self, session: ApiRouterDesktopAuthSession) -> Result<()> {
        let mut state = self.lock_state()?;
        state.auth_session = Some(session);
        Ok(())
    }

    pub fn clear_auth_session(&self) -> Result<()> {
        let mut state = self.lock_state()?;
        state.auth_session = None;
        Ok(())
    }

    pub fn probe_health(&self) -> Result<ApiRouterHealthStatus> {
        self.health_checker.probe()
    }

    pub fn has_auth_session(&self) -> Result<bool> {
        Ok(self.lock_state()?.auth_session.is_some())
    }

    pub fn metadata_dir(&self) -> PathBuf {
        self.options.router_home_dir.join(CLAW_METADATA_DIR_NAME)
    }

    pub fn database_path(&self) -> PathBuf {
        self.options.router_home_dir.join(DEFAULT_DATABASE_FILE_NAME)
    }

    pub fn admin_base_url(&self) -> String {
        format!("http://{DEFAULT_ADMIN_BIND}/admin")
    }

    pub fn gateway_base_url(&self) -> String {
        format!("http://{DEFAULT_GATEWAY_BIND}/v1")
    }

    pub fn issue_admin_token(&self) -> Result<ApiRouterAdminToken> {
        let session = {
            let state = self.lock_state()?;
            state.auth_session.clone()
        }
        .ok_or_else(|| FrameworkError::Conflict("desktop auth session is not available".to_string()))?;

        let signing_secret = self.ensure_admin_jwt_signing_secret()?;
        let issued_at = current_epoch_seconds()?;
        let expires_at = issued_at + CLAW_ADMIN_JWT_TTL_SECS;
        let subject = build_admin_subject(&session);
        self.mirror_admin_user(&subject, &session, issued_at * 1_000)?;
        let claims = AdminJwtClaims {
            sub: subject.clone(),
            iss: ADMIN_JWT_ISSUER.to_string(),
            aud: ADMIN_JWT_AUDIENCE.to_string(),
            exp: expires_at as usize,
            iat: issued_at as usize,
        };
        let token = encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(signing_secret.as_bytes()),
        )
        .map_err(|error| FrameworkError::Internal(format!("failed to issue admin jwt: {error}")))?;

        Ok(ApiRouterAdminToken {
            token,
            subject,
            expires_at_epoch_seconds: expires_at,
        })
    }

    fn resolve_artifact(&self) -> Result<ResolvedApiRouterArtifact> {
        let manifest_path = self.options.artifact_root.join(MANIFEST_FILE_NAME);
        let manifest: ApiRouterArtifactManifest = serde_json::from_str(
            &fs::read_to_string(&manifest_path)?,
        )?;
        let archive = manifest.archives.get(&self.options.target_key).ok_or_else(|| {
            FrameworkError::NotFound(format!(
                "artifact archive missing for target {}",
                self.options.target_key
            ))
        })?;

        if archive.binaries.len() < 2 {
            return Err(FrameworkError::ValidationFailed(
                "artifact archive must declare admin and gateway binaries".to_string(),
            ));
        }

        let archive_path = self
            .options
            .artifact_root
            .join(normalize_relative_path(archive.path.as_str())?);
        if !archive_path.is_file() {
            return Err(FrameworkError::NotFound(format!(
                "artifact archive not found: {}",
                archive_path.display()
            )));
        }

        let actual_sha256 = sha256_for_file(&archive_path)?;
        let manifest_sha256 = archive.sha256.trim().to_ascii_lowercase();
        if !manifest_sha256.is_empty() && manifest_sha256 != actual_sha256 {
            return Err(FrameworkError::ValidationFailed(format!(
                "artifact checksum mismatch for {}",
                archive_path.display()
            )));
        }

        let version = manifest.version;
        Ok(ResolvedApiRouterArtifact {
            version: version.clone(),
            archive_sha256: if manifest_sha256.is_empty() {
                actual_sha256
            } else {
                manifest_sha256
            },
            archive_path,
            extraction_dir: self
                .options
                .managed_root_dir
                .join(&version)
                .join(&self.options.target_key),
            admin_binary_name: archive.binaries[0].clone(),
            gateway_binary_name: archive.binaries[1].clone(),
        })
    }

    fn extract_artifact_if_needed(&self, artifact: &ResolvedApiRouterArtifact) -> Result<()> {
        let marker_path = artifact.extraction_dir.join(EXTRACTION_MARKER_FILE_NAME);
        if marker_matches(&marker_path, artifact)?
            && artifact
                .extraction_dir
                .join(artifact.admin_binary_name.as_str())
                .is_file()
            && artifact
                .extraction_dir
                .join(artifact.gateway_binary_name.as_str())
                .is_file()
        {
            return Ok(());
        }

        let parent_dir = artifact
            .extraction_dir
            .parent()
            .ok_or_else(|| FrameworkError::Internal("artifact extraction parent missing".to_string()))?;
        fs::create_dir_all(parent_dir)?;

        let temp_dir = parent_dir.join(format!(
            ".extract-{}-{}",
            artifact.version, self.options.target_key
        ));
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir)?;
        }
        fs::create_dir_all(&temp_dir)?;

        extract_archive(
            &artifact.archive_path,
            &temp_dir,
            &[artifact.admin_binary_name.as_str(), artifact.gateway_binary_name.as_str()],
        )?;
        write_marker(
            &temp_dir.join(EXTRACTION_MARKER_FILE_NAME),
            &ApiRouterExtractionMarker {
                version: artifact.version.clone(),
                target_key: self.options.target_key.clone(),
                archive_sha256: artifact.archive_sha256.clone(),
            },
        )?;

        if artifact.extraction_dir.exists() {
            fs::remove_dir_all(&artifact.extraction_dir)?;
        }
        fs::rename(&temp_dir, &artifact.extraction_dir)?;
        Ok(())
    }

    fn ensure_router_home_layout(&self) -> Result<()> {
        fs::create_dir_all(&self.options.router_home_dir)?;
        fs::create_dir_all(self.options.router_home_dir.join(CLAW_METADATA_DIR_NAME))?;
        Ok(())
    }

    fn build_process_env(&self) -> Result<BTreeMap<String, String>> {
        let mut env = BTreeMap::new();
        env.insert(
            SDKWORK_CONFIG_DIR_ENV_KEY.to_string(),
            self.options.router_home_dir.to_string_lossy().into_owned(),
        );
        env.insert(
            SDKWORK_GATEWAY_BIND_ENV_KEY.to_string(),
            DEFAULT_GATEWAY_BIND.to_string(),
        );
        env.insert(
            SDKWORK_ADMIN_BIND_ENV_KEY.to_string(),
            DEFAULT_ADMIN_BIND.to_string(),
        );
        env.insert(
            SDKWORK_ADMIN_JWT_SIGNING_SECRET_ENV_KEY.to_string(),
            self.ensure_admin_jwt_signing_secret()?,
        );
        Ok(env)
    }

    fn wait_for_healthy_router(&self) -> Result<()> {
        let deadline = Instant::now() + Duration::from_millis(ROUTER_HEALTH_TIMEOUT_MS);
        loop {
            let status = self.health_checker.probe()?;
            if status.admin_healthy && status.gateway_healthy {
                return Ok(());
            }

            if Instant::now() >= deadline {
                return Err(FrameworkError::Timeout(
                    "sdkwork-api-router did not become healthy before timeout".to_string(),
                ));
            }

            thread::sleep(Duration::from_millis(ROUTER_HEALTH_POLL_INTERVAL_MS));
        }
    }

    fn replace_state(
        &self,
        snapshot: ApiRouterRuntimeSnapshot,
        managed_admin: Option<Box<dyn ApiRouterProcessHandle>>,
        managed_gateway: Option<Box<dyn ApiRouterProcessHandle>>,
    ) -> Result<()> {
        let mut state = self.lock_state()?;
        state.ownership = snapshot.ownership;
        state.extraction_dir = snapshot.extraction_dir;
        state.admin_pid = snapshot.admin_pid;
        state.gateway_pid = snapshot.gateway_pid;
        state.managed_admin = managed_admin;
        state.managed_gateway = managed_gateway;
        Ok(())
    }

    fn lock_state(&self) -> Result<MutexGuard<'_, ApiRouterRuntimeState>> {
        self.state
            .lock()
            .map_err(|_| FrameworkError::Internal("api router runtime state lock poisoned".to_string()))
    }

    fn ensure_admin_jwt_signing_secret(&self) -> Result<String> {
        self.ensure_router_home_layout()?;
        let secret_path = self
            .options
            .router_home_dir
            .join(CLAW_METADATA_DIR_NAME)
            .join(ADMIN_JWT_SECRET_FILE_NAME);
        if secret_path.is_file() {
            let secret = fs::read_to_string(&secret_path)?.trim().to_string();
            if !secret.is_empty() {
                return Ok(secret);
            }
        }

        let secret = generate_hex_secret(32)?;
        fs::write(&secret_path, format!("{secret}\n"))?;
        Ok(secret)
    }

    fn mirror_admin_user(
        &self,
        subject: &str,
        session: &ApiRouterDesktopAuthSession,
        created_at_ms: u64,
    ) -> Result<()> {
        self.ensure_router_home_layout()?;
        let database_path = self.database_path();
        let connection = Connection::open(database_path)
            .map_err(|error| FrameworkError::Internal(format!("failed to open router database: {error}")))?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS admin_users (
                    id TEXT PRIMARY KEY NOT NULL,
                    email TEXT NOT NULL,
                    display_name TEXT NOT NULL DEFAULT '',
                    password_salt TEXT NOT NULL DEFAULT '',
                    password_hash TEXT NOT NULL DEFAULT '',
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at_ms INTEGER NOT NULL DEFAULT 0
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email);",
            )
            .map_err(|error| {
                FrameworkError::Internal(format!("failed to ensure admin_users table exists: {error}"))
            })?;
        connection
            .execute(
                "INSERT INTO admin_users (
                    id,
                    email,
                    display_name,
                    password_salt,
                    password_hash,
                    active,
                    created_at_ms
                ) VALUES (?, ?, ?, '', '', 1, ?)
                ON CONFLICT(id) DO UPDATE SET
                    email = excluded.email,
                    display_name = excluded.display_name,
                    active = excluded.active,
                    created_at_ms = CASE
                        WHEN admin_users.created_at_ms IS NULL OR admin_users.created_at_ms = 0
                            THEN excluded.created_at_ms
                        ELSE admin_users.created_at_ms
                    END",
                params![
                    subject,
                    session.email.trim(),
                    session.display_name.trim(),
                    created_at_ms as i64,
                ],
            )
            .map_err(|error| {
                FrameworkError::Internal(format!("failed to mirror admin user into router database: {error}"))
            })?;
        Ok(())
    }
}

impl ApiRouterHealthChecker for DefaultHealthChecker {
    fn probe(&self) -> Result<ApiRouterHealthStatus> {
        Ok(ApiRouterHealthStatus {
            admin_healthy: probe_http_health(DEFAULT_ADMIN_BIND, DEFAULT_ADMIN_HEALTH_PATH),
            gateway_healthy: probe_http_health(DEFAULT_GATEWAY_BIND, DEFAULT_GATEWAY_HEALTH_PATH),
        })
    }
}

impl ApiRouterProcessHandle for StdProcessHandle {
    fn pid(&self) -> Option<u32> {
        Some(self.child.id())
    }

    fn kill(&mut self) -> Result<()> {
        if self.child.try_wait()?.is_none() {
            self.child.kill()?;
        }
        Ok(())
    }

    fn wait(&mut self) -> Result<Option<i32>> {
        Ok(self.child.wait()?.code())
    }
}

impl ApiRouterProcessSpawner for DefaultProcessSpawner {
    fn spawn(
        &self,
        _kind: ApiRouterProcessKind,
        executable: &Path,
        router_home_dir: &Path,
        env: &BTreeMap<String, String>,
    ) -> Result<Box<dyn ApiRouterProcessHandle>> {
        let mut command = Command::new(executable);
        command.current_dir(router_home_dir);
        command.envs(env.iter().map(|(key, value)| (key.as_str(), value.as_str())));
        command.stdin(Stdio::null());
        command.stdout(Stdio::null());
        command.stderr(Stdio::null());

        let child = command.spawn()?;
        Ok(Box::new(StdProcessHandle { child }))
    }
}

fn marker_matches(marker_path: &Path, artifact: &ResolvedApiRouterArtifact) -> Result<bool> {
    if !marker_path.is_file() {
        return Ok(false);
    }

    let marker: ApiRouterExtractionMarker = serde_json::from_str(&fs::read_to_string(marker_path)?)?;
    Ok(
        marker.version == artifact.version
            && marker.target_key == artifact
                .extraction_dir
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
            && marker.archive_sha256 == artifact.archive_sha256,
    )
}

fn write_marker(path: &Path, marker: &ApiRouterExtractionMarker) -> Result<()> {
    fs::write(path, format!("{}\n", serde_json::to_string_pretty(marker)?))?;
    Ok(())
}

pub(crate) fn sha256_for_file(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8 * 1024];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn normalize_relative_path(path: &str) -> Result<PathBuf> {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(FrameworkError::ValidationFailed(format!(
            "artifact path must be relative: {path}"
        )));
    }

    let mut normalized = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(value) => normalized.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(FrameworkError::ValidationFailed(format!(
                    "artifact path must remain inside the artifact root: {path}"
                )));
            }
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "artifact path resolved to an empty path".to_string(),
        ));
    }

    Ok(normalized)
}

fn extract_archive(archive_path: &Path, destination: &Path, binary_names: &[&str]) -> Result<()> {
    let archive_name = archive_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if archive_name.ends_with(".zip") {
        return extract_zip_archive(archive_path, destination, binary_names);
    }

    if archive_name.ends_with(".tar.gz") {
        return extract_tar_gz_archive(archive_path, destination, binary_names);
    }

    Err(FrameworkError::ValidationFailed(format!(
        "unsupported sdkwork-api-router archive format: {}",
        archive_path.display()
    )))
}

fn extract_zip_archive(archive_path: &Path, destination: &Path, binary_names: &[&str]) -> Result<()> {
    let file = fs::File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| FrameworkError::Internal(format!("failed to open zip archive: {error}")))?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            FrameworkError::Internal(format!("failed to read zip archive entry: {error}"))
        })?;
        let relative = entry.enclosed_name().ok_or_else(|| {
            FrameworkError::ValidationFailed("zip archive contains an unsafe entry".to_string())
        })?;
        let output_path = destination.join(relative);

        if entry.is_dir() {
            fs::create_dir_all(&output_path)?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = fs::File::create(&output_path)?;
        std::io::copy(&mut entry, &mut output)?;
        set_executable_if_needed(&output_path, binary_names)?;
    }

    Ok(())
}

fn extract_tar_gz_archive(
    archive_path: &Path,
    destination: &Path,
    binary_names: &[&str],
) -> Result<()> {
    let archive_file = fs::File::open(archive_path)?;
    let decoder = GzDecoder::new(archive_file);
    let mut archive = Archive::new(decoder);

    for entry_result in archive
        .entries()
        .map_err(|error| FrameworkError::Internal(format!("failed to read tar archive: {error}")))?
    {
        let mut entry = entry_result
            .map_err(|error| FrameworkError::Internal(format!("failed to access tar entry: {error}")))?;
        let relative = normalize_relative_path(
            entry
                .path()
                .map_err(|error| FrameworkError::Internal(format!("failed to read tar path: {error}")))?
                .to_string_lossy()
                .as_ref(),
        )?;
        let output_path = destination.join(relative);

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        entry
            .unpack(&output_path)
            .map_err(|error| FrameworkError::Internal(format!("failed to unpack tar entry: {error}")))?;
        if output_path.is_file() {
            set_executable_if_needed(&output_path, binary_names)?;
        }
    }

    Ok(())
}

fn find_file_by_name(root: &Path, target_name: &str) -> Result<PathBuf> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            if let Ok(found) = find_file_by_name(&path, target_name) {
                return Ok(found);
            }
            continue;
        }

        if path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value == target_name)
        {
            return Ok(path);
        }
    }

    Err(FrameworkError::NotFound(format!(
        "extracted binary not found: {target_name}"
    )))
}

fn terminate_process(process: &mut dyn ApiRouterProcessHandle) -> Result<()> {
    process.kill()?;
    let _ = process.wait()?;
    Ok(())
}

fn probe_http_health(bind: &str, path: &str) -> bool {
    let address: SocketAddr = match bind.parse() {
        Ok(value) => value,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(300)) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(300)));

    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n",
        host = bind
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut buffer = [0_u8; 256];
    let read = match stream.read(&mut buffer) {
        Ok(value) => value,
        Err(_) => return false,
    };
    if read == 0 {
        return false;
    }

    let response = String::from_utf8_lossy(&buffer[..read]).to_ascii_lowercase();
    response.starts_with("http/1.1 200") || response.starts_with("http/1.0 200")
}

fn resolve_artifact_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("sdkwork-api-router-artifacts"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("vendor")
            .join("sdkwork-api-router-artifacts"),
    );

    candidates
        .into_iter()
        .find(|candidate| candidate.join(MANIFEST_FILE_NAME).is_file())
        .ok_or_else(|| {
            FrameworkError::NotFound(
                "sdkwork-api-router bundled artifact root could not be resolved".to_string(),
            )
        })
}

fn resolve_router_home_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    app.path()
        .home_dir()
        .map(|path| path.join(".sdkwork").join("router"))
        .map_err(FrameworkError::from)
}

fn resolve_target_key() -> Result<String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Ok("windows-x64".to_string()),
        ("windows", "aarch64") => Ok("windows-arm64".to_string()),
        ("linux", "x86_64") => Ok("linux-x64".to_string()),
        ("macos", "aarch64") => Ok("macos-aarch64".to_string()),
        (os, arch) => Err(FrameworkError::ValidationFailed(format!(
            "unsupported sdkwork-api-router target {os}-{arch}"
        ))),
    }
}

fn current_epoch_seconds() -> Result<u64> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| FrameworkError::Internal(format!("system clock error: {error}")))
}

fn build_admin_subject(session: &ApiRouterDesktopAuthSession) -> String {
    if !session.user_id.trim().is_empty() {
        return session.user_id.trim().to_string();
    }

    session.email.trim().to_lowercase()
}

fn generate_hex_secret(byte_len: usize) -> Result<String> {
    let mut bytes = vec![0_u8; byte_len];
    getrandom::getrandom(&mut bytes)
        .map_err(|error| FrameworkError::Internal(format!("failed to generate random secret: {error}")))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(unix)]
fn set_executable_if_needed(path: &Path, binary_names: &[&str]) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    if path
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| binary_names.contains(&value))
    {
        let mut permissions = fs::metadata(path)?.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions)?;
    }

    Ok(())
}

#[cfg(not(unix))]
fn set_executable_if_needed(_path: &Path, _binary_names: &[&str]) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        sha256_for_file, ApiRouterHealthChecker, ApiRouterHealthStatus, ApiRouterOwnershipMode,
        ApiRouterProcessHandle, ApiRouterProcessKind, ApiRouterProcessSpawner,
        ApiRouterRuntimeOptions, ApiRouterRuntimeService,
    };
    use crate::framework::Result;
    use std::{
        collections::{BTreeMap, VecDeque},
        fs,
        io::Write,
        path::Path,
        sync::{Arc, Mutex},
    };
    use zip::write::SimpleFileOptions;

    #[derive(Clone)]
    struct SequenceHealthChecker {
        values: Arc<Mutex<VecDeque<ApiRouterHealthStatus>>>,
    }

    impl SequenceHealthChecker {
        fn new(values: Vec<ApiRouterHealthStatus>) -> Self {
            Self {
                values: Arc::new(Mutex::new(values.into())),
            }
        }
    }

    impl ApiRouterHealthChecker for SequenceHealthChecker {
        fn probe(&self) -> Result<ApiRouterHealthStatus> {
            self.values
                .lock()
                .expect("health lock")
                .pop_front()
                .ok_or_else(|| crate::framework::FrameworkError::Internal("missing probe".to_string()))
        }
    }

    struct FakeProcess {
        kind: ApiRouterProcessKind,
        pid: Option<u32>,
        events: Arc<Mutex<Vec<String>>>,
    }

    impl ApiRouterProcessHandle for FakeProcess {
        fn pid(&self) -> Option<u32> {
            self.pid
        }

        fn kill(&mut self) -> Result<()> {
            self.events
                .lock()
                .expect("events lock")
                .push(format!("kill:{:?}", self.kind));
            Ok(())
        }

        fn wait(&mut self) -> Result<Option<i32>> {
            self.events
                .lock()
                .expect("events lock")
                .push(format!("wait:{:?}", self.kind));
            Ok(Some(0))
        }
    }

    #[derive(Clone, Default)]
    struct RecordingSpawner {
        spawned: Arc<Mutex<Vec<ApiRouterProcessKind>>>,
        events: Arc<Mutex<Vec<String>>>,
    }

    impl RecordingSpawner {
        fn spawned_kinds(&self) -> Vec<ApiRouterProcessKind> {
            self.spawned.lock().expect("spawned lock").clone()
        }

        fn events(&self) -> Vec<String> {
            self.events.lock().expect("events lock").clone()
        }
    }

    impl ApiRouterProcessSpawner for RecordingSpawner {
        fn spawn(
            &self,
            kind: ApiRouterProcessKind,
            _executable: &Path,
            _router_home_dir: &Path,
            _env: &BTreeMap<String, String>,
        ) -> Result<Box<dyn ApiRouterProcessHandle>> {
            self.spawned.lock().expect("spawned lock").push(kind);
            let pid = match kind {
                ApiRouterProcessKind::Admin => Some(4101),
                ApiRouterProcessKind::Gateway => Some(4102),
            };
            Ok(Box::new(FakeProcess {
                kind,
                pid,
                events: self.events.clone(),
            }))
        }
    }

    #[test]
    fn skips_reextracting_when_the_marker_matches_the_current_artifact() {
        let root = tempfile::tempdir().expect("temp dir");
        let artifact_root = create_test_artifacts(root.path());
        let service = ApiRouterRuntimeService::new_with_dependencies(
            ApiRouterRuntimeOptions {
                artifact_root,
                managed_root_dir: root.path().join("managed"),
                router_home_dir: root.path().join("home").join(".sdkwork").join("router"),
                target_key: "windows-x64".to_string(),
            },
            Arc::new(SequenceHealthChecker::new(vec![ApiRouterHealthStatus {
                admin_healthy: true,
                gateway_healthy: true,
            }])),
            Arc::new(RecordingSpawner::default()),
        );

        let extraction_dir = service.ensure_artifacts_ready().expect("initial extract");
        let admin_binary = extraction_dir.join("admin-api-service.exe");
        fs::write(&admin_binary, "locally-mutated").expect("mutate extracted binary");

        let second_extraction_dir = service.ensure_artifacts_ready().expect("repeat extract");
        let admin_content = fs::read_to_string(admin_binary).expect("admin content");

        assert_eq!(second_extraction_dir, extraction_dir);
        assert_eq!(admin_content, "locally-mutated");
    }

    #[test]
    fn attaches_to_a_healthy_shared_router_without_spawning_children() {
        let root = tempfile::tempdir().expect("temp dir");
        let artifact_root = create_test_artifacts(root.path());
        let spawner = RecordingSpawner::default();
        let service = ApiRouterRuntimeService::new_with_dependencies(
            ApiRouterRuntimeOptions {
                artifact_root,
                managed_root_dir: root.path().join("managed"),
                router_home_dir: root.path().join("home").join(".sdkwork").join("router"),
                target_key: "windows-x64".to_string(),
            },
            Arc::new(SequenceHealthChecker::new(vec![ApiRouterHealthStatus {
                admin_healthy: true,
                gateway_healthy: true,
            }])),
            Arc::new(spawner.clone()),
        );

        let snapshot = service
            .ensure_started_or_attached()
            .expect("attach should succeed");

        assert_eq!(snapshot.ownership, ApiRouterOwnershipMode::Attached);
        assert!(spawner.spawned_kinds().is_empty());
        assert_eq!(snapshot.admin_pid, None);
        assert_eq!(snapshot.gateway_pid, None);
        assert!(service
            .options
            .router_home_dir
            .join("claw-studio")
            .is_dir());
    }

    #[test]
    fn starts_managed_children_when_the_shared_router_is_unhealthy() {
        let root = tempfile::tempdir().expect("temp dir");
        let artifact_root = create_test_artifacts(root.path());
        let spawner = RecordingSpawner::default();
        let service = ApiRouterRuntimeService::new_with_dependencies(
            ApiRouterRuntimeOptions {
                artifact_root,
                managed_root_dir: root.path().join("managed"),
                router_home_dir: root.path().join("home").join(".sdkwork").join("router"),
                target_key: "windows-x64".to_string(),
            },
            Arc::new(SequenceHealthChecker::new(vec![
                ApiRouterHealthStatus {
                    admin_healthy: false,
                    gateway_healthy: false,
                },
                ApiRouterHealthStatus {
                    admin_healthy: true,
                    gateway_healthy: true,
                },
            ])),
            Arc::new(spawner.clone()),
        );

        let snapshot = service
            .ensure_started_or_attached()
            .expect("managed start should succeed");

        assert_eq!(snapshot.ownership, ApiRouterOwnershipMode::Managed);
        assert_eq!(
            spawner.spawned_kinds(),
            vec![ApiRouterProcessKind::Admin, ApiRouterProcessKind::Gateway]
        );
        assert_eq!(snapshot.admin_pid, Some(4101));
        assert_eq!(snapshot.gateway_pid, Some(4102));
    }

    #[test]
    fn stop_managed_only_terminates_children_started_by_this_app_instance() {
        let root = tempfile::tempdir().expect("temp dir");
        let artifact_root = create_test_artifacts(root.path());
        let spawner = RecordingSpawner::default();
        let service = ApiRouterRuntimeService::new_with_dependencies(
            ApiRouterRuntimeOptions {
                artifact_root,
                managed_root_dir: root.path().join("managed"),
                router_home_dir: root.path().join("home").join(".sdkwork").join("router"),
                target_key: "windows-x64".to_string(),
            },
            Arc::new(SequenceHealthChecker::new(vec![
                ApiRouterHealthStatus {
                    admin_healthy: false,
                    gateway_healthy: false,
                },
                ApiRouterHealthStatus {
                    admin_healthy: true,
                    gateway_healthy: true,
                },
                ApiRouterHealthStatus {
                    admin_healthy: true,
                    gateway_healthy: true,
                },
            ])),
            Arc::new(spawner.clone()),
        );

        let managed_snapshot = service
            .ensure_started_or_attached()
            .expect("managed start should succeed");
        let stopped_snapshot = service.stop_managed().expect("managed stop should succeed");
        let second_stop_snapshot = service.stop_managed().expect("second stop should no-op");

        assert_eq!(managed_snapshot.ownership, ApiRouterOwnershipMode::Managed);
        assert_eq!(stopped_snapshot.ownership, ApiRouterOwnershipMode::Stopped);
        assert_eq!(second_stop_snapshot.ownership, ApiRouterOwnershipMode::Stopped);
        assert_eq!(
            spawner.events(),
            vec![
                "kill:Gateway",
                "wait:Gateway",
                "kill:Admin",
                "wait:Admin",
            ]
        );
    }

    fn create_test_artifacts(root: &Path) -> std::path::PathBuf {
        let artifact_root = root.join("artifacts");
        let target_dir = artifact_root.join("windows-x64");
        fs::create_dir_all(&target_dir).expect("target dir");

        let archive_path = target_dir.join("router-test.zip");
        let archive_file = fs::File::create(archive_path).expect("archive file");
        let mut archive = zip::ZipWriter::new(archive_file);
        let options = SimpleFileOptions::default();

        archive
            .start_file("admin-api-service.exe", options)
            .expect("start admin entry");
        archive.write_all(b"admin-test").expect("write admin");
        archive
            .start_file("gateway-service.exe", options)
            .expect("start gateway entry");
        archive.write_all(b"gateway-test").expect("write gateway");
        archive.finish().expect("finish archive");

        let sha256 = sha256_for_file(&target_dir.join("router-test.zip")).expect("archive sha");
        fs::write(
            artifact_root.join("manifest.json"),
            serde_json::json!({
                "version": "0.1.0-test",
                "archives": {
                    "windows-x64": {
                        "path": "windows-x64/router-test.zip",
                        "sha256": sha256,
                        "binaries": ["admin-api-service.exe", "gateway-service.exe"]
                    }
                }
            })
            .to_string(),
        )
        .expect("manifest");

        artifact_root
    }
}
