use std::env;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use sdkwork_claw_host_core::host_core_metadata;
use sdkwork_claw_host_core::internal::node_sessions::NodeSessionRegistry;
use sdkwork_claw_host_core::rollout::control_plane::RolloutControlPlane;

#[derive(Debug, Clone)]
pub struct ServerState {
    pub mode: &'static str,
    pub host: String,
    pub port: u16,
    pub web_dist_dir: PathBuf,
    pub rollout_control_plane: Arc<RolloutControlPlane>,
    pub node_session_registry: Arc<NodeSessionRegistry>,
}

impl ServerState {
    pub fn listen_address(&self) -> SocketAddr {
        let ip = self
            .host
            .parse::<IpAddr>()
            .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));
        SocketAddr::new(ip, self.port)
    }

    pub fn host_platform_updated_at(&self) -> u64 {
        unix_timestamp_ms()
    }

    pub fn host_platform_version(&self) -> String {
        let metadata = host_core_metadata();
        format!("server@{}", metadata.package_name)
    }
}

pub fn build_server_state() -> ServerState {
    let rollout_data_dir = env::var("CLAW_SERVER_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(".claw-server"));

    build_server_state_with_rollout_data_dir(rollout_data_dir)
}

pub fn build_server_state_with_rollout_data_dir(rollout_data_dir: PathBuf) -> ServerState {
    let host = env::var("CLAW_SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("CLAW_SERVER_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(18_797);
    let web_dist_dir = resolve_server_web_dist_dir(env::var("CLAW_SERVER_WEB_DIST").ok());
    let rollout_store_path = rollout_data_dir.join("rollouts.json");
    let node_session_store_path = rollout_data_dir.join("node-sessions.json");

    ServerState {
        mode: "server",
        host,
        port,
        web_dist_dir,
        rollout_control_plane: Arc::new(
            RolloutControlPlane::open(rollout_store_path)
                .expect("server rollout control plane should initialize"),
        ),
        node_session_registry: Arc::new(
            NodeSessionRegistry::open(node_session_store_path)
                .expect("server node session registry should initialize"),
        ),
    }
}

pub fn resolve_server_web_dist_dir(value: Option<String>) -> PathBuf {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("../sdkwork-claw-web/dist"))
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::resolve_server_web_dist_dir;

    #[test]
    fn resolve_server_web_dist_dir_prefers_explicit_value() {
        assert_eq!(
            resolve_server_web_dist_dir(Some("custom-web-dist".to_string())),
            PathBuf::from("custom-web-dist"),
        );
        assert_eq!(
            resolve_server_web_dist_dir(None),
            PathBuf::from("../sdkwork-claw-web/dist"),
        );
    }
}
