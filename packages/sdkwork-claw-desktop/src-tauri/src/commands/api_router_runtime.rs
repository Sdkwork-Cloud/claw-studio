use crate::{
    framework::{services::api_router_runtime::ApiRouterRuntimeStatus, FrameworkError, Result as FrameworkResult},
    state::AppState,
};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::Serialize;
use std::{
    net::SocketAddr,
    time::{SystemTime, UNIX_EPOCH},
};

const MANAGED_BOOTSTRAP_ADMIN_USER_ID: &str = "admin_local_default";
const MANAGED_BOOTSTRAP_ADMIN_EMAIL: &str = "admin@sdkwork.local";
const MANAGED_BOOTSTRAP_ADMIN_DISPLAY_NAME: &str = "Admin Operator";
const ADMIN_JWT_ISSUER: &str = "sdkwork-admin";
const ADMIN_JWT_AUDIENCE: &str = "sdkwork-admin-ui";
const ADMIN_JWT_TTL_SECS: u64 = 60 * 60 * 12;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApiRouterAdminBootstrapSessionSource {
    ManagedLocalJwt,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterAdminBootstrapSessionUser {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub active: bool,
    pub created_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterAdminBootstrapSession {
    pub token: String,
    pub source: ApiRouterAdminBootstrapSessionSource,
    pub user: ApiRouterAdminBootstrapSessionUser,
}

#[derive(Debug, Serialize)]
struct AdminBootstrapClaims {
    sub: String,
    iss: String,
    aud: String,
    exp: usize,
    iat: usize,
}

pub fn api_router_runtime_status_from_state(
    state: &AppState,
) -> FrameworkResult<ApiRouterRuntimeStatus> {
    let managed_active = state
        .context
        .services
        .supervisor
        .is_service_running("api_router")?;

    state
        .context
        .services
        .api_router_runtime
        .inspect(&state.paths)
        .map(|status| status.with_managed_active(managed_active))
}

pub fn api_router_admin_bootstrap_session_from_state(
    state: &AppState,
) -> FrameworkResult<Option<ApiRouterAdminBootstrapSession>> {
    let status = api_router_runtime_status_from_state(state)?;
    if status.mode != crate::framework::services::api_router_runtime::ApiRouterRuntimeMode::ManagedActive
        || !status.admin.enabled
        || !status.admin.healthy
        || !status.gateway.healthy
        || !is_loopback_bind_addr(&status.admin.bind_addr)
        || !is_loopback_bind_addr(&status.gateway.bind_addr)
    {
        return Ok(None);
    }

    let Some(runtime) = state
        .context
        .services
        .supervisor
        .configured_api_router_runtime()?
    else {
        return Ok(None);
    };

    let token = issue_admin_bootstrap_token(
        MANAGED_BOOTSTRAP_ADMIN_USER_ID,
        &runtime.managed_secrets.admin_jwt_signing_secret,
    )?;
    Ok(Some(ApiRouterAdminBootstrapSession {
        token,
        source: ApiRouterAdminBootstrapSessionSource::ManagedLocalJwt,
        user: ApiRouterAdminBootstrapSessionUser {
            id: MANAGED_BOOTSTRAP_ADMIN_USER_ID.to_string(),
            email: MANAGED_BOOTSTRAP_ADMIN_EMAIL.to_string(),
            display_name: MANAGED_BOOTSTRAP_ADMIN_DISPLAY_NAME.to_string(),
            active: true,
            created_at_ms: unix_timestamp_ms()?,
        },
    }))
}

#[tauri::command]
pub fn get_api_router_runtime_status(
    state: tauri::State<'_, AppState>,
) -> Result<ApiRouterRuntimeStatus, String> {
    api_router_runtime_status_from_state(&state).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_api_router_admin_bootstrap_session(
    state: tauri::State<'_, AppState>,
) -> Result<Option<ApiRouterAdminBootstrapSession>, String> {
    api_router_admin_bootstrap_session_from_state(&state).map_err(|error| error.to_string())
}

fn issue_admin_bootstrap_token(subject: &str, signing_secret: &str) -> FrameworkResult<String> {
    let issued_at = unix_timestamp_secs()?;
    let claims = AdminBootstrapClaims {
        sub: subject.to_string(),
        iss: ADMIN_JWT_ISSUER.to_string(),
        aud: ADMIN_JWT_AUDIENCE.to_string(),
        exp: (issued_at + ADMIN_JWT_TTL_SECS) as usize,
        iat: issued_at as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(signing_secret.as_bytes()),
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))
}

fn is_loopback_bind_addr(bind_addr: &str) -> bool {
    bind_addr
        .parse::<SocketAddr>()
        .map(|addr| addr.ip().is_loopback())
        .unwrap_or(false)
}

fn unix_timestamp_secs() -> FrameworkResult<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?
        .as_secs())
}

fn unix_timestamp_ms() -> FrameworkResult<u64> {
    Ok(u64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| FrameworkError::Internal(error.to_string()))?
            .as_millis(),
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?)
}

#[cfg(test)]
mod tests {
    use super::{
        api_router_admin_bootstrap_session_from_state, api_router_runtime_status_from_state,
        ApiRouterAdminBootstrapSessionSource,
    };
    use crate::{
        framework::{
            config::AppConfig,
            context::FrameworkContext,
            logging::init_logger,
            paths::resolve_paths_for_root,
            services::{
                api_router_managed_runtime::{
                    ActivatedApiRouterRuntime, ManagedApiRouterProcessSpec,
                    ManagedApiRouterSecretBundle,
                },
                api_router_runtime::{ApiRouterConfigSource, ApiRouterRuntimeMode},
            },
        },
        state::AppState,
    };
    use std::{
        fs,
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        thread,
        time::Duration,
    };

    struct TestHealthServer {
        bind_addr: String,
        shutdown: Arc<AtomicBool>,
        handle: Option<std::thread::JoinHandle<()>>,
    }

    impl TestHealthServer {
        fn start(expected_path: &'static str) -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
            listener
                .set_nonblocking(true)
                .expect("listener non blocking");
            let bind_addr = listener.local_addr().expect("local addr").to_string();
            let shutdown = Arc::new(AtomicBool::new(false));
            let shutdown_signal = shutdown.clone();
            let handle = thread::spawn(move || {
                while !shutdown_signal.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((mut stream, _)) => {
                            let mut buffer = [0_u8; 1024];
                            let bytes_read = stream.read(&mut buffer).unwrap_or(0);
                            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
                            let status = if request.starts_with(&format!("GET {expected_path} ")) {
                                "200 OK"
                            } else {
                                "404 Not Found"
                            };
                            let body = if status == "200 OK" { "ok" } else { "missing" };
                            let response = format!(
                                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                                body.len()
                            );
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.flush();
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(_) => break,
                    }
                }
            });

            Self {
                bind_addr,
                shutdown,
                handle: Some(handle),
            }
        }
    }

    impl Drop for TestHealthServer {
        fn drop(&mut self) {
            self.shutdown.store(true, Ordering::Relaxed);
            let _ = TcpStream::connect(self.bind_addr.as_str());
            if let Some(handle) = self.handle.take() {
                let _ = handle.join();
            }
        }
    }

    fn reserve_available_bind_addr() -> String {
        TcpListener::bind("127.0.0.1:0")
            .expect("listener")
            .local_addr()
            .expect("local addr")
            .to_string()
    }

    #[test]
    fn command_reads_runtime_status_from_shared_router_root() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);
        let router_root = paths
            .user_root
            .parent()
            .expect("shared namespace root")
            .join("router");
        let admin_bind = reserve_available_bind_addr();
        let portal_bind = reserve_available_bind_addr();
        let gateway_bind = reserve_available_bind_addr();
        let web_bind = reserve_available_bind_addr();

        fs::create_dir_all(&router_root).expect("router root");
        fs::write(
            router_root.join("config.yml"),
            format!(
                "admin_bind: \"{admin_bind}\"\nportal_bind: \"{portal_bind}\"\ngateway_bind: \"{gateway_bind}\"\nweb_bind: \"{web_bind}\"\n"
            ),
        )
        .expect("router config");

        let status = api_router_runtime_status_from_state(&state).expect("runtime status");

        assert_eq!(status.mode, ApiRouterRuntimeMode::NeedsManagedStart);
        assert_eq!(status.config_source, ApiRouterConfigSource::File);
        assert!(status
            .resolved_config_file
            .as_deref()
            .is_some_and(|value| value.ends_with("config.yml")));
        assert!(!status.admin.healthy);
        assert!(!status.gateway.healthy);
        assert!(status.admin.port_available);
        assert!(status.gateway.port_available);
    }

    #[test]
    fn command_marks_runtime_as_managed_active_when_claw_owns_the_router_process_group() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context.clone());
        let router_root = paths
            .user_root
            .parent()
            .expect("shared namespace root")
            .join("router");
        let admin_server = TestHealthServer::start("/admin/health");
        let portal_server = TestHealthServer::start("/portal/health");
        let gateway_server = TestHealthServer::start("/health");
        let web_bind = reserve_available_bind_addr();

        fs::create_dir_all(&router_root).expect("router root");
        fs::write(
            router_root.join("config.json"),
            format!(
                "{{\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"gateway_bind\":\"{}\",\"web_bind\":\"{}\"}}",
                admin_server.bind_addr, portal_server.bind_addr, gateway_server.bind_addr, web_bind
            ),
        )
        .expect("router config");

        context
            .services
            .supervisor
            .record_running("api_router", Some(42))
            .expect("api router supervisor state");

        let status = api_router_runtime_status_from_state(&state).expect("runtime status");

        assert_eq!(status.mode, ApiRouterRuntimeMode::ManagedActive);
        assert_eq!(status.recommended_managed_mode, None);
        assert!(status.admin.healthy);
        assert!(status.gateway.healthy);
    }

    #[test]
    fn command_exposes_bootstrap_session_for_managed_local_router_only() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context.clone());
        let router_root = paths
            .user_root
            .parent()
            .expect("shared namespace root")
            .join("router");
        let admin_server = TestHealthServer::start("/admin/health");
        let portal_server = TestHealthServer::start("/portal/health");
        let gateway_server = TestHealthServer::start("/health");
        let web_bind = reserve_available_bind_addr();

        fs::create_dir_all(&router_root).expect("router root");
        fs::write(
            router_root.join("config.json"),
            format!(
                "{{\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"gateway_bind\":\"{}\",\"web_bind\":\"{}\"}}",
                admin_server.bind_addr, portal_server.bind_addr, gateway_server.bind_addr, web_bind
            ),
        )
        .expect("router config");

        context
            .services
            .supervisor
            .configure_api_router_runtime(&managed_runtime_fixture(&router_root))
            .expect("configure managed runtime");
        context
            .services
            .supervisor
            .record_running("api_router", Some(42))
            .expect("api router supervisor state");

        let session =
            api_router_admin_bootstrap_session_from_state(&state).expect("bootstrap session");

        assert!(session.is_some());
        let session = session.expect("managed bootstrap session");
        assert!(!session.token.trim().is_empty());
        assert_eq!(
            session.source,
            ApiRouterAdminBootstrapSessionSource::ManagedLocalJwt
        );
        assert_eq!(session.user.email, "admin@sdkwork.local");
        assert_eq!(session.user.display_name, "Admin Operator");
    }

    #[test]
    fn command_hides_bootstrap_session_for_attached_external_router() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);
        let router_root = paths
            .user_root
            .parent()
            .expect("shared namespace root")
            .join("router");
        let admin_server = TestHealthServer::start("/admin/health");
        let portal_server = TestHealthServer::start("/portal/health");
        let gateway_server = TestHealthServer::start("/health");
        let web_bind = reserve_available_bind_addr();

        fs::create_dir_all(&router_root).expect("router root");
        fs::write(
            router_root.join("config.json"),
            format!(
                "{{\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"gateway_bind\":\"{}\",\"web_bind\":\"{}\"}}",
                admin_server.bind_addr, portal_server.bind_addr, gateway_server.bind_addr, web_bind
            ),
        )
        .expect("router config");

        let session =
            api_router_admin_bootstrap_session_from_state(&state).expect("bootstrap session");

        assert!(session.is_none());
    }

    fn managed_runtime_fixture(router_root: &std::path::Path) -> ActivatedApiRouterRuntime {
        ActivatedApiRouterRuntime {
            install_key: "managed-router".to_string(),
            install_dir: router_root.join("managed-install"),
            shared_root_dir: router_root.to_path_buf(),
            bind_env_overrides: std::collections::BTreeMap::new(),
            managed_secrets: ManagedApiRouterSecretBundle {
                schema_version: 1,
                admin_jwt_signing_secret: "managed-admin-jwt-secret".to_string(),
                portal_jwt_signing_secret: "managed-portal-jwt-secret".to_string(),
                credential_master_key: "managed-credential-master-key".to_string(),
            },
            gateway: ManagedApiRouterProcessSpec {
                command_path: router_root.join("gateway"),
                args: Vec::new(),
                working_dir: None,
            },
            admin: ManagedApiRouterProcessSpec {
                command_path: router_root.join("admin"),
                args: Vec::new(),
                working_dir: None,
            },
            portal: ManagedApiRouterProcessSpec {
                command_path: router_root.join("portal"),
                args: Vec::new(),
                working_dir: None,
            },
        }
    }
}
