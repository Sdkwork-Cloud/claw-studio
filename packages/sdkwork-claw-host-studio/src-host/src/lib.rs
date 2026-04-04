use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Debug;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use sdkwork_claw_host_core::openclaw_control_plane::{
    OpenClawControlPlane, OpenClawGatewayInvokeRequest as ControlPlaneOpenClawGatewayInvokeRequest,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Number, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioOpenClawGatewayInvokeRequest {
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dry_run: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StudioOpenClawGatewayInvokeOptions {
    pub message_channel: Option<String>,
    pub account_id: Option<String>,
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioOpenClawGatewayInvokePayload {
    pub request: StudioOpenClawGatewayInvokeRequest,
    #[serde(default)]
    pub options: StudioOpenClawGatewayInvokeOptions,
}

pub trait StudioPublicApiProvider: Send + Sync + Debug {
    fn list_instances(&self) -> Result<Value, String>;
    fn create_instance(&self, input: Value) -> Result<Value, String>;
    fn get_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn update_instance(&self, id: &str, input: Value) -> Result<Value, String>;
    fn delete_instance(&self, id: &str) -> Result<bool, String>;
    fn start_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn stop_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn restart_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn get_instance_detail(&self, id: &str) -> Result<Option<Value>, String>;
    fn get_instance_config(&self, id: &str) -> Result<Option<Value>, String>;
    fn update_instance_config(&self, id: &str, config: Value) -> Result<Option<Value>, String>;
    fn get_instance_logs(&self, id: &str) -> Result<String, String>;
    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String>;
    fn list_conversations(&self, instance_id: &str) -> Result<Value, String>;
    fn put_conversation(&self, id: &str, record: Value) -> Result<Value, String>;
    fn delete_conversation(&self, id: &str) -> Result<bool, String>;
    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String>;
    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String>;
    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String>;
    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String>;
    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String>;
    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String>;
    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Value, String>;
    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String>;
    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String>;
}

pub trait TypedStudioPublicApiBackend: Send + Sync + Debug {
    type InstanceRecord: Serialize;
    type CreateInstanceInput: DeserializeOwned;
    type UpdateInstanceInput: DeserializeOwned;
    type InstanceDetailRecord: Serialize;
    type InstanceConfigRecord: Serialize + DeserializeOwned;
    type ConversationRecord: Serialize + DeserializeOwned;

    fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String>;
    fn create_instance(
        &self,
        input: Self::CreateInstanceInput,
    ) -> Result<Self::InstanceRecord, String>;
    fn get_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn update_instance(
        &self,
        id: &str,
        input: Self::UpdateInstanceInput,
    ) -> Result<Self::InstanceRecord, String>;
    fn delete_instance(&self, id: &str) -> Result<bool, String>;
    fn start_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn stop_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn restart_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn get_instance_detail(&self, id: &str) -> Result<Option<Self::InstanceDetailRecord>, String>;
    fn get_instance_config(&self, id: &str) -> Result<Option<Self::InstanceConfigRecord>, String>;
    fn update_instance_config(
        &self,
        id: &str,
        config: Self::InstanceConfigRecord,
    ) -> Result<Option<Self::InstanceConfigRecord>, String>;
    fn get_instance_logs(&self, id: &str) -> Result<String, String>;
    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String>;
    fn list_conversations(
        &self,
        instance_id: &str,
    ) -> Result<Vec<Self::ConversationRecord>, String>;
    fn put_conversation(
        &self,
        id: &str,
        record: Self::ConversationRecord,
    ) -> Result<Self::ConversationRecord, String>;
    fn delete_conversation(&self, id: &str) -> Result<bool, String>;
    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String>;
    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String>;
    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String>;
    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String>;
    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String>;
    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String>;
    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Vec<Value>, String>;
    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String>;
    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String>;
}

pub fn build_default_studio_public_api_provider(
    data_dir: PathBuf,
    openclaw_control_plane: Arc<OpenClawControlPlane>,
) -> Result<Arc<dyn StudioPublicApiProvider>, String> {
    Ok(build_typed_studio_public_api_provider(ServerStudioPublicApiProvider::new(
        data_dir,
        openclaw_control_plane,
    )?))
}

pub fn build_typed_studio_public_api_provider<B>(backend: B) -> Arc<dyn StudioPublicApiProvider>
where
    B: TypedStudioPublicApiBackend + 'static,
{
    Arc::new(TypedStudioPublicApiProvider { backend })
}

const BUILT_IN_INSTANCE_ID: &str = "local-built-in";
const DEFAULT_PORT: u16 = 18_789;
const STORAGE_DIR_NAME: &str = "studio-public-api";
const INSTANCES_FILE_NAME: &str = "instances.json";
const CONVERSATIONS_FILE_NAME: &str = "conversations.json";
const WORKBENCHES_FILE_NAME: &str = "workbenches.json";
const DEFAULT_OPENCLAW_PROVIDER_ID: &str = "openai";
const DEFAULT_OPENCLAW_AGENT_FILE_ID: &str = "/workspace/main/AGENTS.md";
const DEFAULT_OPENCLAW_MEMORY_FILE_ID: &str = "/workspace/main/MEMORY.md";
const DEFAULT_OPENCLAW_CONFIG_FILE_ID: &str = "/workspace/main/openclaw.json";

#[derive(Debug)]
struct ServerStudioPublicApiProvider {
    storage_dir: PathBuf,
    openclaw_control_plane: Arc<OpenClawControlPlane>,
    io_lock: Mutex<()>,
}

#[derive(Debug)]
struct TypedStudioPublicApiProvider<B>
where
    B: TypedStudioPublicApiBackend,
{
    backend: B,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct InstancesDocument {
    built_in_instance: Option<Value>,
    custom_instances: Vec<Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct ConversationsDocument {
    conversations: Vec<Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct WorkbenchesDocument {
    workbenches: BTreeMap<String, Value>,
}

#[derive(Debug, Clone)]
struct BuiltInEndpointProjection {
    host: String,
    requested_port: Option<u16>,
    active_port: Option<u16>,
    base_url: Option<String>,
    websocket_url: Option<String>,
}

impl ServerStudioPublicApiProvider {
    fn new(
        data_dir: PathBuf,
        openclaw_control_plane: Arc<OpenClawControlPlane>,
    ) -> Result<Self, String> {
        let storage_dir = data_dir.join(STORAGE_DIR_NAME);
        fs::create_dir_all(&storage_dir)
            .map_err(|error| format!("create studio public api storage dir: {error}"))?;
        Ok(Self {
            storage_dir,
            openclaw_control_plane,
            io_lock: Mutex::new(()),
        })
    }

    fn with_io_lock<T, F>(&self, action: F) -> Result<T, String>
    where
        F: FnOnce(&Self) -> Result<T, String>,
    {
        let _guard = self
            .io_lock
            .lock()
            .map_err(|_| "lock studio public api storage".to_string())?;
        action(self)
    }

    fn instances_path(&self) -> PathBuf {
        self.storage_dir.join(INSTANCES_FILE_NAME)
    }

    fn conversations_path(&self) -> PathBuf {
        self.storage_dir.join(CONVERSATIONS_FILE_NAME)
    }

    fn workbenches_path(&self) -> PathBuf {
        self.storage_dir.join(WORKBENCHES_FILE_NAME)
    }

    fn read_instances(&self) -> Result<InstancesDocument, String> {
        read_json_document(&self.instances_path())
    }

    fn write_instances(&self, document: &InstancesDocument) -> Result<(), String> {
        write_json_document(&self.instances_path(), document)
    }

    fn read_conversations(&self) -> Result<ConversationsDocument, String> {
        read_json_document(&self.conversations_path())
    }

    fn write_conversations(&self, document: &ConversationsDocument) -> Result<(), String> {
        write_json_document(&self.conversations_path(), document)
    }

    fn read_workbenches(&self) -> Result<WorkbenchesDocument, String> {
        read_json_document(&self.workbenches_path())
    }

    fn write_workbenches(&self, document: &WorkbenchesDocument) -> Result<(), String> {
        write_json_document(&self.workbenches_path(), document)
    }

    fn built_in_status(&self) -> &'static str {
        let now = unix_timestamp_ms();
        let runtime = self.openclaw_control_plane.get_runtime(now);
        let gateway = self.openclaw_control_plane.get_gateway(now);
        if runtime.lifecycle == "ready" || gateway.lifecycle == "ready" {
            "online"
        } else if runtime.lifecycle == "starting" || gateway.lifecycle == "starting" {
            "starting"
        } else if runtime.lifecycle == "degraded" || gateway.lifecycle == "degraded" {
            "error"
        } else {
            "offline"
        }
    }

    fn built_in_endpoint_projection(&self) -> BuiltInEndpointProjection {
        let updated_at = unix_timestamp_ms();
        let runtime = self.openclaw_control_plane.get_runtime(updated_at);
        let gateway = self.openclaw_control_plane.get_gateway(updated_at);
        let endpoint_id = gateway
            .endpoint_id
            .clone()
            .or_else(|| runtime.endpoint_id.clone());
        let endpoint = endpoint_id.as_deref().and_then(|target| {
            self.openclaw_control_plane
                .list_host_endpoints()
                .into_iter()
                .find(|candidate| candidate.endpoint_id == target)
        });
        let host = endpoint
            .as_ref()
            .map(|record| record.bind_host.clone())
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let active_port = gateway.active_port.or(runtime.active_port);
        let requested_port = gateway.requested_port.or(runtime.requested_port);
        let base_url = gateway.base_url.or(runtime.base_url);
        let websocket_url = gateway
            .websocket_url
            .or(runtime.websocket_url)
            .or_else(|| derive_websocket_endpoint(base_url.as_deref(), host.as_str(), active_port));

        BuiltInEndpointProjection {
            host,
            requested_port,
            active_port,
            base_url,
            websocket_url,
        }
    }

    fn project_built_in_instance(&self, raw: Option<Value>) -> Value {
        let endpoint = self.built_in_endpoint_projection();
        let config_port = endpoint.requested_port.unwrap_or(DEFAULT_PORT);
        let projected_port = endpoint.active_port.or(endpoint.requested_port);
        let mut baseline = json!({
            "id": BUILT_IN_INSTANCE_ID,
            "name": "Local Built-In",
            "description": "Bundled local OpenClaw runtime managed by Claw Studio.",
            "runtimeKind": "openclaw",
            "deploymentMode": "local-managed",
            "transportKind": "openclawGatewayWs",
            "status": self.built_in_status(),
            "isBuiltIn": true,
            "isDefault": true,
            "iconType": "server",
            "version": env!("CARGO_PKG_VERSION"),
            "typeLabel": "Built-In OpenClaw",
            "host": endpoint.host,
            "port": projected_port.map(Number::from).map(Value::Number).unwrap_or(Value::Null),
            "baseUrl": endpoint.base_url.clone().map(Value::String).unwrap_or(Value::Null),
            "websocketUrl": endpoint.websocket_url.clone().map(Value::String).unwrap_or(Value::Null),
            "cpu": 0,
            "memory": 0,
            "totalMemory": "Unknown",
            "uptime": "-",
            "capabilities": ["chat", "health", "files", "memory", "tasks", "tools", "models"],
            "storage": { "provider": "localFile", "namespace": "claw-studio" },
            "config": default_instance_config(
                config_port,
                endpoint.base_url.as_deref(),
                endpoint.websocket_url.as_deref(),
            ),
            "createdAt": unix_timestamp_ms(),
            "updatedAt": unix_timestamp_ms(),
            "lastSeenAt": Value::Null
        });
        if let Some(raw) = raw {
            merge_values(&mut baseline, raw);
        }
        self.normalize_instance(baseline, BUILT_IN_INSTANCE_ID, true)
    }

    fn project_custom_instance(&self, raw: Value) -> Option<Value> {
        let id = raw.get("id").and_then(Value::as_str)?.to_string();
        Some(self.normalize_instance(raw, id.as_str(), false))
    }

    fn normalize_instance(&self, raw: Value, id: &str, built_in: bool) -> Value {
        let updated_at = unix_timestamp_ms();
        let mut object = into_object(raw);
        let built_in_endpoint = built_in.then(|| self.built_in_endpoint_projection());
        let runtime_kind = if built_in {
            "openclaw".to_string()
        } else {
            object
                .get("runtimeKind")
                .and_then(Value::as_str)
                .unwrap_or("openclaw")
                .to_string()
        };
        let deployment_mode = if built_in {
            "local-managed".to_string()
        } else {
            object
                .get("deploymentMode")
                .and_then(Value::as_str)
                .unwrap_or("local-managed")
                .to_string()
        };
        let transport_kind = if built_in {
            "openclawGatewayWs".to_string()
        } else {
            object
                .get("transportKind")
                .and_then(Value::as_str)
                .unwrap_or("openclawGatewayWs")
                .to_string()
        };
        let host = if built_in {
            built_in_endpoint
                .as_ref()
                .map(|endpoint| endpoint.host.clone())
                .unwrap_or_else(|| "127.0.0.1".to_string())
        } else {
            object
                .get("host")
                .and_then(Value::as_str)
                .unwrap_or("127.0.0.1")
                .to_string()
        };
        let requested_port = value_as_u16(object.get("port")).or_else(|| {
            object
                .get("config")
                .and_then(Value::as_object)
                .and_then(|config| value_as_u16(config.get("port")))
        });
        let config_port = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.requested_port)
                .or(requested_port)
                .unwrap_or(DEFAULT_PORT)
        } else {
            requested_port.unwrap_or(DEFAULT_PORT)
        };
        let projected_port = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.active_port.or(endpoint.requested_port))
        } else {
            Some(config_port)
        };
        let supports_ws =
            built_in || transport_kind == "openclawGatewayWs" || transport_kind == "customWs";
        let base_url = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.base_url.clone())
        } else {
            Some(format!("http://{host}:{config_port}"))
        };
        let websocket_url = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.websocket_url.clone())
        } else if supports_ws {
            Some(format!("ws://{host}:{config_port}"))
        } else {
            None
        };
        let created_at = object
            .get("createdAt")
            .and_then(Value::as_u64)
            .unwrap_or(updated_at);
        let status = object
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or(if built_in {
                self.built_in_status()
            } else {
                "offline"
            })
            .to_string();

        object.insert("id".to_string(), Value::String(id.to_string()));
        object.insert(
            "name".to_string(),
            Value::String(
                object
                    .get("name")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| {
                        if built_in {
                            "Local Built-In".to_string()
                        } else {
                            "Custom instance".to_string()
                        }
                    }),
            ),
        );
        object.insert(
            "runtimeKind".to_string(),
            Value::String(runtime_kind.clone()),
        );
        object.insert(
            "deploymentMode".to_string(),
            Value::String(deployment_mode.clone()),
        );
        object.insert(
            "transportKind".to_string(),
            Value::String(transport_kind.clone()),
        );
        object.insert("status".to_string(), Value::String(status.clone()));
        object.insert("host".to_string(), Value::String(host.clone()));
        object.insert(
            "port".to_string(),
            projected_port
                .map(Number::from)
                .map(Value::Number)
                .unwrap_or(Value::Null),
        );
        object.insert(
            "baseUrl".to_string(),
            base_url
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
        );
        object.insert(
            "websocketUrl".to_string(),
            websocket_url
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
        );
        object.insert("isBuiltIn".to_string(), Value::Bool(built_in));
        object.insert("isDefault".to_string(), Value::Bool(built_in));
        object.insert(
            "iconType".to_string(),
            Value::String(if built_in || deployment_mode == "remote" {
                "server".to_string()
            } else {
                "box".to_string()
            }),
        );
        object.insert(
            "version".to_string(),
            Value::String(
                object
                    .get("version")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
            ),
        );
        object.insert(
            "typeLabel".to_string(),
            Value::String(
                object
                    .get("typeLabel")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| {
                        if built_in {
                            "Built-In OpenClaw".to_string()
                        } else {
                            format!("{runtime_kind} ({deployment_mode})")
                        }
                    }),
            ),
        );
        object.insert(
            "createdAt".to_string(),
            Value::Number(Number::from(created_at)),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::Number(Number::from(updated_at)),
        );
        object.insert(
            "lastSeenAt".to_string(),
            if status == "online" {
                Value::Number(Number::from(updated_at))
            } else {
                object.get("lastSeenAt").cloned().unwrap_or(Value::Null)
            },
        );
        object.insert(
            "capabilities".to_string(),
            normalize_capabilities(object.get("capabilities").cloned(), runtime_kind.as_str()),
        );
        object.insert(
            "storage".to_string(),
            normalize_storage(
                object.get("storage").cloned(),
                if built_in { "claw-studio" } else { id },
                if deployment_mode == "remote" {
                    "remoteApi"
                } else {
                    "localFile"
                },
            ),
        );
        object.insert(
            "config".to_string(),
            normalize_config(
                object.get("config").cloned(),
                config_port,
                host.as_str(),
                supports_ws,
                base_url.as_deref(),
                websocket_url.as_deref(),
                built_in,
            ),
        );
        Value::Object(object)
    }

    fn list_projected_instances(&self, document: &InstancesDocument) -> Vec<Value> {
        let mut items = vec![self.project_built_in_instance(document.built_in_instance.clone())];
        let mut custom = document
            .custom_instances
            .iter()
            .filter_map(|value| self.project_custom_instance(value.clone()))
            .collect::<Vec<_>>();
        custom.sort_by(|left, right| {
            let left_updated = left.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
            let right_updated = right.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
            right_updated.cmp(&left_updated)
        });
        items.extend(custom);
        items
    }

    fn get_projected_instance(&self, document: &InstancesDocument, id: &str) -> Option<Value> {
        if id == BUILT_IN_INSTANCE_ID {
            return Some(self.project_built_in_instance(document.built_in_instance.clone()));
        }
        document
            .custom_instances
            .iter()
            .find(|value| value.get("id").and_then(Value::as_str) == Some(id))
            .and_then(|value| self.project_custom_instance(value.clone()))
    }

    fn project_conversation(&self, id: &str, raw: Value) -> Value {
        let updated_at = unix_timestamp_ms();
        let mut object = into_object(raw);
        let messages = object
            .get("messages")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        object.insert("id".to_string(), Value::String(id.to_string()));
        object.insert(
            "title".to_string(),
            Value::String(
                object
                    .get("title")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| format!("Conversation {id}")),
            ),
        );
        object.insert(
            "primaryInstanceId".to_string(),
            Value::String(
                object
                    .get("primaryInstanceId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| BUILT_IN_INSTANCE_ID.to_string()),
            ),
        );
        object.insert(
            "participantInstanceIds".to_string(),
            object
                .get("participantInstanceIds")
                .cloned()
                .unwrap_or_else(|| {
                    Value::Array(vec![Value::String(BUILT_IN_INSTANCE_ID.to_string())])
                }),
        );
        object.insert(
            "createdAt".to_string(),
            Value::Number(Number::from(
                object
                    .get("createdAt")
                    .and_then(Value::as_u64)
                    .unwrap_or(updated_at),
            )),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::Number(Number::from(updated_at)),
        );
        object.insert(
            "messageCount".to_string(),
            Value::Number(Number::from(messages.len() as u64)),
        );
        object.insert("messages".to_string(), Value::Array(messages));
        Value::Object(object)
    }

    fn instance_logs(&self, instance: &Value) -> String {
        let id = instance
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(BUILT_IN_INSTANCE_ID);
        let status = instance
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("offline");
        let transport = instance
            .get("transportKind")
            .and_then(Value::as_str)
            .unwrap_or("openclawGatewayWs");
        let updated_at = instance
            .get("updatedAt")
            .and_then(Value::as_u64)
            .unwrap_or_else(unix_timestamp_ms);
        format!(
            "[{updated_at}] instance={id} status={status}\n[{updated_at}] transport={transport}"
        )
    }

    fn instance_workbench(
        &self,
        document: &mut WorkbenchesDocument,
        instance: &Value,
    ) -> Option<Value> {
        if !is_managed_openclaw_workbench_instance(instance) {
            return None;
        }

        let instance_id = instance
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(BUILT_IN_INSTANCE_ID)
            .to_string();
        let current = document
            .workbenches
            .get(instance_id.as_str())
            .cloned()
            .unwrap_or_else(|| create_default_workbench_snapshot(instance));
        let next = synchronize_workbench_snapshot(instance, current);
        document.workbenches.insert(instance_id, next.clone());
        Some(next)
    }

    fn instance_detail(&self, instance: &Value, workbench: Option<Value>) -> Value {
        let logs = self.instance_logs(instance);
        let status = instance
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("offline");
        json!({
            "instance": instance,
            "config": instance.get("config").cloned().unwrap_or(Value::Null),
            "logs": logs.clone(),
            "health": {
                "score": if status == "online" { 91 } else { 48 },
                "status": if status == "online" { "healthy" } else if status == "error" { "degraded" } else { "offline" },
                "checks": [],
                "evaluatedAt": unix_timestamp_ms()
            },
            "lifecycle": {
                "owner": if instance.get("deploymentMode").and_then(Value::as_str) == Some("remote") { "remoteService" } else { "appManaged" },
                "startStopSupported": instance.get("deploymentMode").and_then(Value::as_str) == Some("local-managed"),
                "configWritable": true,
                "notes": ["Server-backed studio detail projection."]
            },
            "storage": {
                "status": if instance.get("deploymentMode").and_then(Value::as_str) == Some("remote") { "planned" } else { "ready" },
                "provider": instance.get("storage").and_then(|value| value.get("provider")).and_then(Value::as_str).unwrap_or("localFile"),
                "namespace": instance.get("storage").and_then(|value| value.get("namespace")).and_then(Value::as_str).unwrap_or("claw-studio"),
                "durable": true,
                "queryable": false,
                "transactional": false,
                "remote": instance.get("deploymentMode").and_then(Value::as_str) == Some("remote")
            },
            "connectivity": {
                "primaryTransport": instance.get("transportKind").cloned().unwrap_or(Value::Null),
                "endpoints": [
                    {
                        "id": "base-url",
                        "label": "Base URL",
                        "url": instance.get("baseUrl").cloned().unwrap_or(Value::Null),
                        "kind": "http",
                        "status": "ready",
                        "source": "config"
                    }
                ]
            },
            "observability": {
                "status": "limited",
                "logAvailable": true,
                "logPreview": logs.lines().map(|line| Value::String(line.to_string())).collect::<Vec<_>>(),
                "metricsSource": "derived",
                "lastSeenAt": instance.get("lastSeenAt").cloned().unwrap_or(Value::Null)
            },
            "dataAccess": {
                "routes": []
            },
            "artifacts": [],
            "capabilities": normalized_capability_snapshots(instance.get("capabilities").cloned()),
            "officialRuntimeNotes": [],
            "workbench": workbench.unwrap_or(Value::Null)
        })
    }
}

impl StudioPublicApiProvider for ServerStudioPublicApiProvider {
    fn list_instances(&self) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            Ok(Value::Array(
                provider.list_projected_instances(&provider.read_instances()?),
            ))
        })
    }

    fn create_instance(&self, input: Value) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let input_object = input
                .as_object()
                .cloned()
                .ok_or_else(|| "studio instance create input must be an object".to_string())?;
            let mut document = provider.read_instances()?;
            let existing_ids = provider
                .list_projected_instances(&document)
                .into_iter()
                .filter_map(|value| {
                    value
                        .get("id")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                })
                .collect::<BTreeSet<_>>();
            let requested_id = input_object
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| {
                    slugify(
                        input_object
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or("custom-instance"),
                    )
                });
            let mut payload = Value::Object(input_object);
            if let Some(object) = payload.as_object_mut() {
                object.insert(
                    "id".to_string(),
                    Value::String(dedupe_id(requested_id.as_str(), &existing_ids)),
                );
            }
            let created = provider
                .project_custom_instance(payload)
                .ok_or_else(|| "project created studio instance".to_string())?;
            document.custom_instances.push(created.clone());
            provider.write_instances(&document)?;
            if is_managed_openclaw_workbench_instance(&created) {
                let mut workbenches = provider.read_workbenches()?;
                provider.instance_workbench(&mut workbenches, &created);
                provider.write_workbenches(&workbenches)?;
            }
            Ok(created)
        })
    }

    fn get_instance(&self, id: &str) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            Ok(provider.get_projected_instance(&provider.read_instances()?, id))
        })
    }

    fn update_instance(&self, id: &str, input: Value) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_instances()?;
            if id == BUILT_IN_INSTANCE_ID {
                let mut next = document
                    .built_in_instance
                    .clone()
                    .unwrap_or_else(|| provider.project_built_in_instance(None));
                merge_values(&mut next, input);
                let projected = provider.project_built_in_instance(Some(next));
                document.built_in_instance = Some(projected.clone());
                provider.write_instances(&document)?;
                let mut workbenches = provider.read_workbenches()?;
                if is_managed_openclaw_workbench_instance(&projected) {
                    provider.instance_workbench(&mut workbenches, &projected);
                } else {
                    workbenches.workbenches.remove(id);
                }
                provider.write_workbenches(&workbenches)?;
                return Ok(projected);
            }
            let Some(index) = document
                .custom_instances
                .iter()
                .position(|value| value.get("id").and_then(Value::as_str) == Some(id))
            else {
                return Err(format!("studio instance \"{id}\" does not exist"));
            };
            let mut next = document.custom_instances[index].clone();
            merge_values(&mut next, input);
            let projected = provider
                .project_custom_instance(next)
                .ok_or_else(|| format!("project updated studio instance \"{id}\""))?;
            document.custom_instances[index] = projected.clone();
            provider.write_instances(&document)?;
            let mut workbenches = provider.read_workbenches()?;
            if is_managed_openclaw_workbench_instance(&projected) {
                provider.instance_workbench(&mut workbenches, &projected);
            } else {
                workbenches.workbenches.remove(id);
            }
            provider.write_workbenches(&workbenches)?;
            Ok(projected)
        })
    }

    fn delete_instance(&self, id: &str) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            if id == BUILT_IN_INSTANCE_ID {
                return Ok(false);
            }
            let mut document = provider.read_instances()?;
            let initial_len = document.custom_instances.len();
            document
                .custom_instances
                .retain(|value| value.get("id").and_then(Value::as_str) != Some(id));
            let deleted = document.custom_instances.len() != initial_len;
            if deleted {
                provider.write_instances(&document)?;
                let mut conversations = provider.read_conversations()?;
                conversations.conversations.retain(|value| {
                    value.get("primaryInstanceId").and_then(Value::as_str) != Some(id)
                        && !value
                            .get("participantInstanceIds")
                            .and_then(Value::as_array)
                            .is_some_and(|items| items.iter().any(|item| item.as_str() == Some(id)))
                });
                provider.write_conversations(&conversations)?;
                let mut workbenches = provider.read_workbenches()?;
                workbenches.workbenches.remove(id);
                provider.write_workbenches(&workbenches)?;
            }
            Ok(deleted)
        })
    }

    fn start_instance(&self, id: &str) -> Result<Option<Value>, String> {
        Ok(Some(
            StudioPublicApiProvider::update_instance(self, id, json!({ "status": "online" }))?,
        ))
    }

    fn stop_instance(&self, id: &str) -> Result<Option<Value>, String> {
        Ok(Some(
            StudioPublicApiProvider::update_instance(self, id, json!({ "status": "offline" }))?,
        ))
    }

    fn restart_instance(&self, id: &str) -> Result<Option<Value>, String> {
        Ok(Some(
            StudioPublicApiProvider::update_instance(self, id, json!({ "status": "online" }))?,
        ))
    }

    fn get_instance_detail(&self, id: &str) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let Some(instance) = provider.get_projected_instance(&instances, id) else {
                return Ok(None);
            };
            let mut workbenches = provider.read_workbenches()?;
            let workbench = provider.instance_workbench(&mut workbenches, &instance);
            provider.write_workbenches(&workbenches)?;
            Ok(Some(provider.instance_detail(&instance, workbench)))
        })
    }

    fn get_instance_config(&self, id: &str) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            Ok(provider
                .get_projected_instance(&provider.read_instances()?, id)
                .and_then(|instance| instance.get("config").cloned()))
        })
    }

    fn update_instance_config(&self, id: &str, config: Value) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_instances()?;
            let apply_config = |mut next: Value, config: Value| -> Value {
                if let Some(object) = next.as_object_mut() {
                    let mut next_config = object
                        .get("config")
                        .cloned()
                        .unwrap_or_else(|| Value::Object(Map::new()));
                    merge_values(&mut next_config, config);
                    if let Some(config_object) = next_config.as_object() {
                        if let Some(port) = value_as_u16(config_object.get("port")) {
                            object.insert("port".to_string(), Value::Number(Number::from(port)));
                        }
                    }
                    object.insert("config".to_string(), next_config);
                }
                next
            };

            if id == BUILT_IN_INSTANCE_ID {
                let next = apply_config(
                    document
                        .built_in_instance
                        .clone()
                        .unwrap_or_else(|| provider.project_built_in_instance(None)),
                    config,
                );
                let projected = provider.project_built_in_instance(Some(next));
                let projected_config = projected.get("config").cloned();
                document.built_in_instance = Some(projected);
                provider.write_instances(&document)?;
                let mut workbenches = provider.read_workbenches()?;
                if let Some(instance) = document.built_in_instance.as_ref() {
                    provider.instance_workbench(&mut workbenches, instance);
                }
                provider.write_workbenches(&workbenches)?;
                return Ok(projected_config);
            }

            let Some(index) = document
                .custom_instances
                .iter()
                .position(|value| value.get("id").and_then(Value::as_str) == Some(id))
            else {
                return Ok(None);
            };
            let next = apply_config(document.custom_instances[index].clone(), config);
            let projected = provider.project_custom_instance(next);
            let Some(projected) = projected else {
                return Err(format!(
                    "project studio instance config update for \"{id}\""
                ));
            };
            let projected_config = projected.get("config").cloned();
            document.custom_instances[index] = projected;
            provider.write_instances(&document)?;
            let mut workbenches = provider.read_workbenches()?;
            if let Some(instance) = document.custom_instances.get(index) {
                provider.instance_workbench(&mut workbenches, instance);
            }
            provider.write_workbenches(&workbenches)?;
            Ok(projected_config)
        })
    }

    fn get_instance_logs(&self, id: &str) -> Result<String, String> {
        self.with_io_lock(|provider| {
            let instance = provider
                .get_projected_instance(&provider.read_instances()?, id)
                .ok_or_else(|| format!("studio instance \"{id}\" does not exist"))?;
            Ok(provider.instance_logs(&instance))
        })
    }

    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = create_instance_task_in_snapshot(snapshot, payload)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = update_instance_task_in_snapshot(snapshot, task_id, payload)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, updated) =
                update_instance_file_content_in_snapshot(snapshot, file_id, content)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(updated)
        })
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, updated) =
                update_instance_llm_provider_config_in_snapshot(snapshot, provider_id, update)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(updated)
        })
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = clone_instance_task_in_snapshot(snapshot, task_id, name.as_deref())?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, execution) = run_instance_task_now_in_snapshot(snapshot, task_id)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(execution)
        })
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            provider.write_workbenches(&workbenches)?;
            Ok(Value::Array(list_instance_task_executions_from_snapshot(
                &snapshot, task_id,
            )))
        })
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = update_instance_task_status_in_snapshot(snapshot, task_id, status.as_str())?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, deleted) = delete_instance_task_in_snapshot(snapshot, task_id);
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(deleted)
        })
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instance = provider
                .get_projected_instance(&provider.read_instances()?, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let runtime_kind = instance
                .get("runtimeKind")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            let deployment_mode = instance
                .get("deploymentMode")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            let is_built_in = instance
                .get("isBuiltIn")
                .and_then(Value::as_bool)
                .unwrap_or(false);

            if runtime_kind != "openclaw" || !is_built_in || deployment_mode != "local-managed" {
                return Err(format!(
                    "studio instance \"{instance_id}\" does not expose a managed OpenClaw gateway"
                ));
            }

            provider.openclaw_control_plane.invoke_gateway(
                to_control_plane_gateway_invoke_request(request, options),
                unix_timestamp_ms(),
            )
        })
    }

    fn list_conversations(&self, instance_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let mut records = provider
                .read_conversations()?
                .conversations
                .into_iter()
                .filter_map(|value| {
                    let id = value.get("id").and_then(Value::as_str)?.to_string();
                    let projected = provider.project_conversation(id.as_str(), value);
                    let primary_matches =
                        projected.get("primaryInstanceId").and_then(Value::as_str)
                            == Some(instance_id);
                    let participant_matches = projected
                        .get("participantInstanceIds")
                        .and_then(Value::as_array)
                        .is_some_and(|items| {
                            items.iter().any(|item| item.as_str() == Some(instance_id))
                        });
                    if primary_matches || participant_matches {
                        Some(projected)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            records.sort_by(|left, right| {
                let left_updated = left.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
                let right_updated = right.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
                right_updated.cmp(&left_updated)
            });
            Ok(Value::Array(records))
        })
    }

    fn put_conversation(&self, id: &str, record: Value) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_conversations()?;
            let projected = provider.project_conversation(id, record);
            if let Some(index) = document
                .conversations
                .iter()
                .position(|value| value.get("id").and_then(Value::as_str) == Some(id))
            {
                document.conversations[index] = projected.clone();
            } else {
                document.conversations.insert(0, projected.clone());
            }
            provider.write_conversations(&document)?;
            Ok(projected)
        })
    }

    fn delete_conversation(&self, id: &str) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_conversations()?;
            let initial_len = document.conversations.len();
            document
                .conversations
                .retain(|value| value.get("id").and_then(Value::as_str) != Some(id));
            let deleted = document.conversations.len() != initial_len;
            if deleted {
                provider.write_conversations(&document)?;
            }
            Ok(deleted)
        })
    }
}

impl TypedStudioPublicApiBackend for ServerStudioPublicApiProvider {
    type InstanceRecord = Value;
    type CreateInstanceInput = Value;
    type UpdateInstanceInput = Value;
    type InstanceDetailRecord = Value;
    type InstanceConfigRecord = Value;
    type ConversationRecord = Value;

    fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String> {
        match <Self as StudioPublicApiProvider>::list_instances(self)? {
            Value::Array(items) => Ok(items),
            _ => Err("default studio provider instance list must serialize as an array".to_string()),
        }
    }

    fn create_instance(
        &self,
        input: Self::CreateInstanceInput,
    ) -> Result<Self::InstanceRecord, String> {
        <Self as StudioPublicApiProvider>::create_instance(self, input)
    }

    fn get_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::get_instance(self, id)
    }

    fn update_instance(
        &self,
        id: &str,
        input: Self::UpdateInstanceInput,
    ) -> Result<Self::InstanceRecord, String> {
        <Self as StudioPublicApiProvider>::update_instance(self, id, input)
    }

    fn delete_instance(&self, id: &str) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::delete_instance(self, id)
    }

    fn start_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::start_instance(self, id)
    }

    fn stop_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::stop_instance(self, id)
    }

    fn restart_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::restart_instance(self, id)
    }

    fn get_instance_detail(&self, id: &str) -> Result<Option<Self::InstanceDetailRecord>, String> {
        <Self as StudioPublicApiProvider>::get_instance_detail(self, id)
    }

    fn get_instance_config(&self, id: &str) -> Result<Option<Self::InstanceConfigRecord>, String> {
        <Self as StudioPublicApiProvider>::get_instance_config(self, id)
    }

    fn update_instance_config(
        &self,
        id: &str,
        config: Self::InstanceConfigRecord,
    ) -> Result<Option<Self::InstanceConfigRecord>, String> {
        <Self as StudioPublicApiProvider>::update_instance_config(self, id, config)
    }

    fn get_instance_logs(&self, id: &str) -> Result<String, String> {
        <Self as StudioPublicApiProvider>::get_instance_logs(self, id)
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String> {
        <Self as StudioPublicApiProvider>::invoke_openclaw_gateway(
            self,
            instance_id,
            request,
            options,
        )
    }

    fn list_conversations(
        &self,
        instance_id: &str,
    ) -> Result<Vec<Self::ConversationRecord>, String> {
        match <Self as StudioPublicApiProvider>::list_conversations(self, instance_id)? {
            Value::Array(items) => Ok(items),
            _ => Err(
                "default studio provider conversation list must serialize as an array".to_string(),
            ),
        }
    }

    fn put_conversation(
        &self,
        id: &str,
        record: Self::ConversationRecord,
    ) -> Result<Self::ConversationRecord, String> {
        <Self as StudioPublicApiProvider>::put_conversation(self, id, record)
    }

    fn delete_conversation(&self, id: &str) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::delete_conversation(self, id)
    }

    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::create_instance_task(self, instance_id, payload)
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::update_instance_task(self, instance_id, task_id, payload)
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::update_instance_file_content(
            self,
            instance_id,
            file_id,
            content,
        )
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::update_instance_llm_provider_config(
            self,
            instance_id,
            provider_id,
            update,
        )
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::clone_instance_task(self, instance_id, task_id, name)
    }

    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String> {
        <Self as StudioPublicApiProvider>::run_instance_task_now(self, instance_id, task_id)
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Vec<Value>, String> {
        match <Self as StudioPublicApiProvider>::list_instance_task_executions(
            self,
            instance_id,
            task_id,
        )? {
            Value::Array(items) => Ok(items),
            _ => Err(
                "default studio provider task execution list must serialize as an array"
                    .to_string(),
            ),
        }
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::update_instance_task_status(
            self,
            instance_id,
            task_id,
            status,
        )
    }

    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::delete_instance_task(self, instance_id, task_id)
    }
}

impl<B> StudioPublicApiProvider for TypedStudioPublicApiProvider<B>
where
    B: TypedStudioPublicApiBackend,
{
    fn list_instances(&self) -> Result<Value, String> {
        serialize_provider_value(self.backend.list_instances()?, "typed studio instance list")
    }

    fn create_instance(&self, input: Value) -> Result<Value, String> {
        let input = deserialize_provider_value(input, "typed studio create instance input")?;
        serialize_provider_value(
            self.backend.create_instance(input)?,
            "typed studio instance record",
        )
    }

    fn get_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.get_instance(id)?,
            "typed studio instance record",
        )
    }

    fn update_instance(&self, id: &str, input: Value) -> Result<Value, String> {
        let input = deserialize_provider_value(input, "typed studio update instance input")?;
        serialize_provider_value(
            self.backend.update_instance(id, input)?,
            "typed studio instance record",
        )
    }

    fn delete_instance(&self, id: &str) -> Result<bool, String> {
        self.backend.delete_instance(id)
    }

    fn start_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.start_instance(id)?,
            "typed studio instance record",
        )
    }

    fn stop_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.stop_instance(id)?,
            "typed studio instance record",
        )
    }

    fn restart_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.restart_instance(id)?,
            "typed studio instance record",
        )
    }

    fn get_instance_detail(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.get_instance_detail(id)?,
            "typed studio instance detail record",
        )
    }

    fn get_instance_config(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.get_instance_config(id)?,
            "typed studio instance config record",
        )
    }

    fn update_instance_config(&self, id: &str, config: Value) -> Result<Option<Value>, String> {
        let config = deserialize_provider_value(config, "typed studio instance config input")?;
        serialize_optional_provider_value(
            self.backend.update_instance_config(id, config)?,
            "typed studio instance config record",
        )
    }

    fn get_instance_logs(&self, id: &str) -> Result<String, String> {
        self.backend.get_instance_logs(id)
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String> {
        self.backend
            .invoke_openclaw_gateway(instance_id, request, options)
    }

    fn list_conversations(&self, instance_id: &str) -> Result<Value, String> {
        serialize_provider_value(
            self.backend.list_conversations(instance_id)?,
            "typed studio conversation list",
        )
    }

    fn put_conversation(&self, id: &str, record: Value) -> Result<Value, String> {
        let record = deserialize_provider_value(record, "typed studio conversation record")?;
        serialize_provider_value(
            self.backend.put_conversation(id, record)?,
            "typed studio conversation record",
        )
    }

    fn delete_conversation(&self, id: &str) -> Result<bool, String> {
        self.backend.delete_conversation(id)
    }

    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String> {
        self.backend.create_instance_task(instance_id, payload)
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String> {
        self.backend
            .update_instance_task(instance_id, task_id, payload)
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String> {
        self.backend
            .update_instance_file_content(instance_id, file_id, content)
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String> {
        self.backend
            .update_instance_llm_provider_config(instance_id, provider_id, update)
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        self.backend
            .clone_instance_task(instance_id, task_id, name)
    }

    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String> {
        self.backend.run_instance_task_now(instance_id, task_id)
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Value, String> {
        serialize_provider_value(
            self.backend
                .list_instance_task_executions(instance_id, task_id)?,
            "typed studio task execution list",
        )
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String> {
        self.backend
            .update_instance_task_status(instance_id, task_id, status)
    }

    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String> {
        self.backend.delete_instance_task(instance_id, task_id)
    }
}

fn is_managed_openclaw_workbench_instance(instance: &Value) -> bool {
    instance.get("runtimeKind").and_then(Value::as_str) == Some("openclaw")
        && instance.get("deploymentMode").and_then(Value::as_str) == Some("local-managed")
}

fn synchronize_workbench_snapshot(instance: &Value, snapshot: Value) -> Value {
    if !is_managed_openclaw_workbench_instance(instance) {
        return Value::Null;
    }

    let mut root = into_object(snapshot);
    if !matches!(root.get("channels"), Some(Value::Array(_))) {
        root.insert("channels".to_string(), Value::Array(Vec::new()));
    }
    if !matches!(root.get("skills"), Some(Value::Array(_))) {
        root.insert("skills".to_string(), Value::Array(Vec::new()));
    }
    if !matches!(root.get("agents"), Some(Value::Array(_))) {
        root.insert(
            "agents".to_string(),
            Value::Array(vec![json!({
                "agent": {
                    "id": "main",
                    "name": "Main",
                    "description": "Primary managed OpenClaw workspace agent.",
                    "avatar": "M",
                    "systemPrompt": "Coordinate managed OpenClaw workbench activity.",
                    "creator": "Claw Studio Host"
                },
                "focusAreas": ["planning", "automation", "operations"],
                "automationFitScore": 82
            })]),
        );
    }
    if !matches!(root.get("tools"), Some(Value::Array(_))) {
        root.insert(
            "tools".to_string(),
            Value::Array(vec![
                json!({
                    "id": "cron",
                    "name": "Cron Scheduler",
                    "description": "Create and run managed OpenClaw scheduled tasks.",
                    "category": "automation",
                    "status": "ready",
                    "access": "write",
                    "command": "openclaw:cron"
                }),
                json!({
                    "id": "workspace-files",
                    "name": "Workspace Files",
                    "description": "Edit managed OpenClaw workspace files from the canonical host API.",
                    "category": "filesystem",
                    "status": "ready",
                    "access": "write",
                    "command": "openclaw:files"
                }),
            ]),
        );
    }

    let mut providers = root
        .get("llmProviders")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| default_workbench_llm_providers(instance));
    if providers.is_empty() {
        providers = default_workbench_llm_providers(instance);
    }
    root.insert("llmProviders".to_string(), Value::Array(providers.clone()));

    let default_provider_id = providers
        .first()
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OPENCLAW_PROVIDER_ID);
    let mut files = root
        .get("files")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| default_workbench_files(instance, default_provider_id));
    files = synchronize_workbench_files(instance, files, default_provider_id);
    root.insert("files".to_string(), Value::Array(files.clone()));
    root.insert(
        "memory".to_string(),
        Value::Array(build_workbench_memory_entries(&files)),
    );

    let mut cron_tasks = root
        .get("cronTasks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let tasks = cron_tasks
        .get("tasks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let executions = cron_tasks
        .get("taskExecutionsById")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    cron_tasks.insert("tasks".to_string(), Value::Array(tasks));
    cron_tasks.insert("taskExecutionsById".to_string(), Value::Object(executions));
    root.insert("cronTasks".to_string(), Value::Object(cron_tasks));

    Value::Object(root)
}

fn create_default_workbench_snapshot(instance: &Value) -> Value {
    let providers = default_workbench_llm_providers(instance);
    let default_provider_id = providers
        .first()
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OPENCLAW_PROVIDER_ID);
    let files = default_workbench_files(instance, default_provider_id);
    json!({
        "channels": [],
        "cronTasks": {
            "tasks": [],
            "taskExecutionsById": {}
        },
        "llmProviders": providers,
        "agents": [
            {
                "agent": {
                    "id": "main",
                    "name": "Main",
                    "description": "Primary managed OpenClaw workspace agent.",
                    "avatar": "M",
                    "systemPrompt": "Coordinate managed OpenClaw workbench activity.",
                    "creator": "Claw Studio Host"
                },
                "focusAreas": ["planning", "automation", "operations"],
                "automationFitScore": 82
            }
        ],
        "skills": [],
        "files": files.clone(),
        "memory": build_workbench_memory_entries(&files),
        "tools": [
            {
                "id": "cron",
                "name": "Cron Scheduler",
                "description": "Create and run managed OpenClaw scheduled tasks.",
                "category": "automation",
                "status": "ready",
                "access": "write",
                "command": "openclaw:cron"
            },
            {
                "id": "workspace-files",
                "name": "Workspace Files",
                "description": "Edit managed OpenClaw workspace files from the canonical host API.",
                "category": "filesystem",
                "status": "ready",
                "access": "write",
                "command": "openclaw:files"
            }
        ]
    })
}

fn default_workbench_llm_providers(_instance: &Value) -> Vec<Value> {
    vec![json!({
        "id": DEFAULT_OPENCLAW_PROVIDER_ID,
        "name": "OpenAI",
        "provider": "openai",
        "endpoint": "https://api.openai.com/v1",
        "apiKeySource": "env:OPENAI_API_KEY",
        "status": "configurationRequired",
        "defaultModelId": "gpt-5.4",
        "reasoningModelId": "o4-mini",
        "embeddingModelId": "text-embedding-3-large",
        "description": "Primary hosted provider profile for the managed host workbench.",
        "icon": "O",
        "lastCheckedAt": pseudo_iso_timestamp(),
        "capabilities": ["chat", "reasoning", "embedding"],
        "models": [
            {
                "id": "gpt-5.4",
                "name": "GPT-5.4",
                "role": "primary",
                "contextWindow": "128k"
            },
            {
                "id": "o4-mini",
                "name": "o4-mini",
                "role": "reasoning",
                "contextWindow": "200k"
            },
            {
                "id": "text-embedding-3-large",
                "name": "text-embedding-3-large",
                "role": "embedding",
                "contextWindow": "8k"
            }
        ],
        "config": {
            "temperature": 0.2,
            "topP": 1.0,
            "maxTokens": 4096,
            "timeoutMs": 60000,
            "streaming": true
        }
    })]
}

fn default_workbench_files(instance: &Value, default_provider_id: &str) -> Vec<Value> {
    let instance_name = instance
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Local Built-In");
    let transport = instance
        .get("transportKind")
        .and_then(Value::as_str)
        .unwrap_or("openclawGatewayWs");
    let gateway = instance
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("unconfigured");

    sort_workbench_files(vec![
        create_workbench_file(
            DEFAULT_OPENCLAW_AGENT_FILE_ID,
            "AGENTS.md",
            DEFAULT_OPENCLAW_AGENT_FILE_ID,
            "prompt",
            "markdown",
            "Primary agent instructions for the managed OpenClaw workspace.",
            [
                "# Main Agent",
                "",
                &format!("You are the primary managed agent for {instance_name}."),
                "- Prefer real runtime actions over placeholder responses.",
                "- Keep plans concise and execution-oriented.",
            ]
            .join("\n"),
            false,
        ),
        create_workbench_file(
            DEFAULT_OPENCLAW_MEMORY_FILE_ID,
            "MEMORY.md",
            DEFAULT_OPENCLAW_MEMORY_FILE_ID,
            "memory",
            "markdown",
            "Pinned workspace memory for the managed OpenClaw workbench.",
            [
                "# Workspace Memory",
                "",
                &format!("- Runtime: {instance_name}"),
                &format!("- Transport: {transport}"),
                &format!("- Gateway: {gateway}"),
            ]
            .join("\n"),
            false,
        ),
        build_openclaw_config_file(instance, default_provider_id),
    ])
}

fn synchronize_workbench_files(
    instance: &Value,
    files: Vec<Value>,
    default_provider_id: &str,
) -> Vec<Value> {
    let mut next = files
        .into_iter()
        .filter(|file| {
            file.get("id").and_then(Value::as_str) != Some(DEFAULT_OPENCLAW_CONFIG_FILE_ID)
        })
        .collect::<Vec<_>>();
    next.push(build_openclaw_config_file(instance, default_provider_id));
    sort_workbench_files(next)
}

fn build_openclaw_config_file(instance: &Value, default_provider_id: &str) -> Value {
    create_workbench_file(
        DEFAULT_OPENCLAW_CONFIG_FILE_ID,
        "openclaw.json",
        DEFAULT_OPENCLAW_CONFIG_FILE_ID,
        "config",
        "json",
        "Managed OpenClaw runtime configuration snapshot.",
        build_default_openclaw_config_content(instance, default_provider_id),
        false,
    )
}

fn build_default_openclaw_config_content(instance: &Value, default_provider_id: &str) -> String {
    let port = instance
        .get("config")
        .and_then(|value| value.get("port"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            instance
                .get("port")
                .and_then(Value::as_u64)
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "18789".to_string());

    serde_json::to_string_pretty(&json!({
        "runtime": "openclaw",
        "instanceId": instance.get("id").cloned().unwrap_or(Value::String(BUILT_IN_INSTANCE_ID.to_string())),
        "gateway": {
            "baseUrl": instance.get("baseUrl").cloned().unwrap_or(Value::Null),
            "websocketUrl": instance.get("websocketUrl").cloned().unwrap_or(Value::Null),
            "port": port
        },
        "workspace": {
            "root": "/workspace/main"
        },
        "channels": {},
        "models": {
            "defaultProvider": default_provider_id
        }
    }))
    .unwrap_or_else(|_| "{}".to_string())
}

fn build_workbench_memory_entries(files: &[Value]) -> Vec<Value> {
    files
        .iter()
        .filter(|file| {
            file.get("category").and_then(Value::as_str) == Some("memory")
                || file.get("name").and_then(Value::as_str) == Some("MEMORY.md")
        })
        .map(|file| {
            let content = file.get("content").and_then(Value::as_str).unwrap_or("");
            json!({
                "id": format!("memory:{}", file.get("id").and_then(Value::as_str).unwrap_or("memory")),
                "title": file.get("name").cloned().unwrap_or(Value::String("MEMORY.md".to_string())),
                "type": "runbook",
                "summary": summarize_memory_content(content),
                "source": "system",
                "updatedAt": file.get("updatedAt").cloned().unwrap_or(Value::String(pseudo_iso_timestamp())),
                "retention": "pinned",
                "tokens": std::cmp::max(1, content.len().div_ceil(4))
            })
        })
        .collect()
}

fn summarize_memory_content(content: &str) -> String {
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .next()
        .unwrap_or("Managed OpenClaw workspace memory for the canonical host workbench.")
        .to_string()
}

fn create_workbench_file(
    id: &str,
    name: &str,
    path: &str,
    category: &str,
    language: &str,
    description: &str,
    content: String,
    is_readonly: bool,
) -> Value {
    json!({
        "id": id,
        "name": name,
        "path": path,
        "category": category,
        "language": language,
        "size": format_workbench_file_size(content.as_str()),
        "updatedAt": pseudo_iso_timestamp(),
        "status": "synced",
        "description": description,
        "content": content,
        "isReadonly": is_readonly
    })
}

fn format_workbench_file_size(content: &str) -> String {
    let bytes = content.len();
    if bytes < 1024 {
        format!("{bytes} B")
    } else {
        let kb = bytes as f64 / 1024.0;
        if kb >= 10.0 {
            format!("{:.0} KB", kb)
        } else {
            format!("{:.1} KB", kb)
        }
    }
}

fn sort_workbench_files(mut files: Vec<Value>) -> Vec<Value> {
    files.sort_by(|left, right| {
        let left_path = left.get("path").and_then(Value::as_str).unwrap_or("");
        let right_path = right.get("path").and_then(Value::as_str).unwrap_or("");
        left_path.cmp(right_path)
    });
    files
}

fn pseudo_iso_timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| format!("ts-{}", unix_timestamp_ms()))
}

fn workbench_tasks(root: &Map<String, Value>) -> Vec<Value> {
    root.get("cronTasks")
        .and_then(|value| value.get("tasks"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn set_workbench_tasks(root: &mut Map<String, Value>, tasks: Vec<Value>) {
    let mut cron_tasks = root
        .get("cronTasks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    cron_tasks.insert("tasks".to_string(), Value::Array(tasks));
    cron_tasks
        .entry("taskExecutionsById".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    root.insert("cronTasks".to_string(), Value::Object(cron_tasks));
}

fn workbench_task_executions_map(root: &Map<String, Value>) -> Map<String, Value> {
    root.get("cronTasks")
        .and_then(|value| value.get("taskExecutionsById"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn set_workbench_task_executions_map(root: &mut Map<String, Value>, executions: Map<String, Value>) {
    let mut cron_tasks = root
        .get("cronTasks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    cron_tasks.insert("taskExecutionsById".to_string(), Value::Object(executions));
    cron_tasks
        .entry("tasks".to_string())
        .or_insert_with(|| Value::Array(Vec::new()));
    root.insert("cronTasks".to_string(), Value::Object(cron_tasks));
}

fn build_workbench_task_record(
    payload: &Value,
    existing: Option<&Value>,
    forced_id: Option<String>,
) -> Value {
    let root = payload.as_object().cloned().unwrap_or_default();
    let schedule = root
        .get("schedule")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let job_payload = root
        .get("payload")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let name = root
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Untitled task");
    let id = forced_id
        .or_else(|| root.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
        .or_else(|| {
            existing
                .and_then(|value| value.get("id"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| format!("task-{}", unix_timestamp_ms()));
    let schedule_kind = schedule
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("cron");
    let (schedule_label, schedule_mode, schedule_config, cron_expression) = match schedule_kind {
        "every" => {
            let every_ms = schedule
                .get("everyMs")
                .and_then(Value::as_u64)
                .unwrap_or(30 * 60 * 1000);
            let interval_minutes = std::cmp::max(1, ((every_ms as f64) / 60000.0).round() as u64);
            (
                format!("@every {interval_minutes}m"),
                "interval".to_string(),
                json!({
                    "intervalValue": interval_minutes,
                    "intervalUnit": "minute"
                }),
                Value::Null,
            )
        }
        "at" => {
            let at = schedule
                .get("at")
                .and_then(Value::as_str)
                .unwrap_or("2026-01-01T09:00:00Z");
            (
                format!("at {at}"),
                "datetime".to_string(),
                json!({
                    "scheduledDate": at.split('T').next().unwrap_or("2026-01-01"),
                    "scheduledTime": at
                        .split('T')
                        .nth(1)
                        .and_then(|value| value.get(0..5))
                        .unwrap_or("09:00")
                }),
                Value::Null,
            )
        }
        _ => {
            let expr = schedule
                .get("expr")
                .and_then(Value::as_str)
                .unwrap_or("* * * * *");
            (
                expr.to_string(),
                "cron".to_string(),
                json!({
                    "cronExpression": expr,
                    "cronTimezone": schedule.get("tz").cloned().unwrap_or(Value::Null),
                    "staggerMs": schedule.get("staggerMs").cloned().unwrap_or(Value::Null)
                }),
                Value::String(expr.to_string()),
            )
        }
    };
    let payload_kind = job_payload
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("agentTurn");
    let session_mode = match root.get("sessionTarget").and_then(Value::as_str) {
        Some("isolated") => "isolated",
        Some("current") => "current",
        Some("custom") => "custom",
        _ => "main",
    };
    let delivery = root
        .get("delivery")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let delivery_mode = match delivery.get("mode").and_then(Value::as_str) {
        Some("webhook") => "webhook",
        Some("none") => "none",
        _ if session_mode == "main" && !delivery.contains_key("mode") => "none",
        _ => "publishSummary",
    };

    json!({
        "id": id,
        "name": name,
        "description": root.get("description").cloned().unwrap_or(Value::Null),
        "prompt": job_payload.get("message").cloned().or_else(|| job_payload.get("text").cloned()).unwrap_or(Value::String(String::new())),
        "schedule": schedule_label,
        "scheduleMode": schedule_mode,
        "scheduleConfig": schedule_config,
        "cronExpression": cron_expression,
        "actionType": if payload_kind == "systemEvent" { "message" } else { "skill" },
        "status": if root.get("enabled").and_then(Value::as_bool) == Some(false) { "paused" } else { "active" },
        "sessionMode": session_mode,
        "customSessionId": root.get("customSessionId").cloned().unwrap_or(Value::Null),
        "wakeUpMode": if root.get("wakeMode").and_then(Value::as_str) == Some("next-heartbeat") { "nextCycle" } else { "immediate" },
        "executionContent": if payload_kind == "systemEvent" { "sendPromptMessage" } else { "runAssistantTask" },
        "timeoutSeconds": job_payload.get("timeoutSeconds").cloned().unwrap_or(Value::Null),
        "deleteAfterRun": root.get("deleteAfterRun").cloned().unwrap_or(Value::Null),
        "agentId": root.get("agentId").cloned().unwrap_or(Value::Null),
        "model": job_payload.get("model").cloned().unwrap_or(Value::Null),
        "thinking": job_payload.get("thinking").cloned().unwrap_or(Value::Null),
        "lightContext": job_payload.get("lightContext").cloned().unwrap_or(Value::Null),
        "deliveryMode": delivery_mode,
        "deliveryBestEffort": delivery.get("bestEffort").cloned().unwrap_or(Value::Null),
        "deliveryChannel": delivery.get("channel").cloned().unwrap_or(Value::Null),
        "deliveryLabel": delivery.get("label").cloned().unwrap_or(Value::Null),
        "recipient": delivery.get("to").cloned().unwrap_or(Value::Null),
        "lastRun": existing.and_then(|value| value.get("lastRun")).cloned().unwrap_or(Value::Null),
        "nextRun": existing.and_then(|value| value.get("nextRun")).cloned().unwrap_or(Value::Null),
        "latestExecution": existing.and_then(|value| value.get("latestExecution")).cloned().unwrap_or(Value::Null),
        "rawDefinition": payload.clone()
    })
}

fn create_task_execution_record(task_id: &str, trigger: &str) -> Value {
    let timestamp = pseudo_iso_timestamp();
    json!({
        "id": format!("exec-{}", unix_timestamp_ms()),
        "taskId": task_id,
        "status": "success",
        "trigger": trigger,
        "startedAt": timestamp,
        "finishedAt": timestamp,
        "summary": "Managed task completed successfully."
    })
}

fn create_instance_task_in_snapshot(snapshot: Value, payload: Value) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let task = build_workbench_task_record(&payload, None, None);
    let task_id = task
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "task record must include an id".to_string())?;
    if tasks
        .iter()
        .any(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
    {
        return Err(format!("task \"{task_id}\" already exists"));
    }
    tasks.insert(0, task);
    set_workbench_tasks(&mut root, tasks);
    Ok(Value::Object(root))
}

fn update_instance_task_in_snapshot(
    snapshot: Value,
    task_id: &str,
    payload: Value,
) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let tasks = workbench_tasks(&root);
    let Some(current) = tasks
        .iter()
        .find(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
        .cloned()
    else {
        return Err(format!("task \"{task_id}\" not found"));
    };
    let next_tasks = tasks
        .into_iter()
        .map(|entry| {
            if entry.get("id").and_then(Value::as_str) == Some(task_id) {
                build_workbench_task_record(&payload, Some(&current), Some(task_id.to_string()))
            } else {
                entry
            }
        })
        .collect::<Vec<_>>();
    set_workbench_tasks(&mut root, next_tasks);
    Ok(Value::Object(root))
}

fn clone_instance_task_in_snapshot(
    snapshot: Value,
    task_id: &str,
    name: Option<&str>,
) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let existing_ids = tasks
        .iter()
        .filter_map(|entry| entry.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
        .collect::<BTreeSet<_>>();
    let Some(source) = tasks
        .iter()
        .find(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
        .cloned()
    else {
        return Err(format!("task \"{task_id}\" not found"));
    };
    let source_name = source
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Untitled task")
        .to_string();
    let cloned_id = dedupe_id(&format!("{task_id}-copy"), &existing_ids);
    let mut cloned = source;
    if let Some(object) = cloned.as_object_mut() {
        object.insert("id".to_string(), Value::String(cloned_id.clone()));
        object.insert(
            "name".to_string(),
            Value::String(
                name.filter(|value| !value.trim().is_empty())
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| format!("{source_name} (copy)")),
            ),
        );
        object.insert("latestExecution".to_string(), Value::Null);
        object.remove("lastRun");
        object.remove("nextRun");
        if let Some(raw_definition) = object
            .get_mut("rawDefinition")
            .and_then(Value::as_object_mut)
        {
            raw_definition.insert("id".to_string(), Value::String(cloned_id));
        }
    }
    tasks.insert(0, cloned);
    set_workbench_tasks(&mut root, tasks);
    Ok(Value::Object(root))
}

fn run_instance_task_now_in_snapshot(
    snapshot: Value,
    task_id: &str,
) -> Result<(Value, Value), String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let task = tasks
        .iter_mut()
        .find(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
        .ok_or_else(|| format!("task \"{task_id}\" not found"))?;
    let execution = create_task_execution_record(task_id, "manual");
    if let Some(task_object) = task.as_object_mut() {
        task_object.insert("latestExecution".to_string(), execution.clone());
        task_object.insert(
            "lastRun".to_string(),
            execution
                .get("startedAt")
                .cloned()
                .unwrap_or(Value::String(pseudo_iso_timestamp())),
        );
    }
    let mut executions = workbench_task_executions_map(&root);
    let mut items = executions
        .remove(task_id)
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();
    items.insert(0, execution.clone());
    executions.insert(task_id.to_string(), Value::Array(items));
    set_workbench_tasks(&mut root, tasks);
    set_workbench_task_executions_map(&mut root, executions);
    Ok((Value::Object(root), execution))
}

fn list_instance_task_executions_from_snapshot(snapshot: &Value, task_id: &str) -> Vec<Value> {
    snapshot
        .get("cronTasks")
        .and_then(|value| value.get("taskExecutionsById"))
        .and_then(|value| value.get(task_id))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn update_instance_task_status_in_snapshot(
    snapshot: Value,
    task_id: &str,
    status: &str,
) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let mut found = false;
    for task in &mut tasks {
        if task.get("id").and_then(Value::as_str) == Some(task_id) {
            found = true;
            if let Some(task_object) = task.as_object_mut() {
                task_object.insert("status".to_string(), Value::String(status.to_string()));
            }
        }
    }
    if !found {
        return Err(format!("task \"{task_id}\" not found"));
    }
    set_workbench_tasks(&mut root, tasks);
    Ok(Value::Object(root))
}

fn delete_instance_task_in_snapshot(snapshot: Value, task_id: &str) -> (Value, bool) {
    let mut root = into_object(snapshot);
    let tasks = workbench_tasks(&root);
    let deleted = tasks
        .iter()
        .any(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id));
    let next_tasks = tasks
        .into_iter()
        .filter(|entry| entry.get("id").and_then(Value::as_str) != Some(task_id))
        .collect::<Vec<_>>();
    let mut executions = workbench_task_executions_map(&root);
    executions.remove(task_id);
    set_workbench_tasks(&mut root, next_tasks);
    set_workbench_task_executions_map(&mut root, executions);
    (Value::Object(root), deleted)
}

fn update_instance_file_content_in_snapshot(
    snapshot: Value,
    file_id: &str,
    content: String,
) -> Result<(Value, bool), String> {
    let mut root = into_object(snapshot);
    let mut files = root
        .get("files")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut updated = false;
    for file in &mut files {
        let matches = file.get("id").and_then(Value::as_str) == Some(file_id)
            || file.get("path").and_then(Value::as_str) == Some(file_id);
        if matches {
            updated = true;
            if let Some(file_object) = file.as_object_mut() {
                file_object.insert("content".to_string(), Value::String(content.clone()));
                file_object.insert(
                    "size".to_string(),
                    Value::String(format_workbench_file_size(content.as_str())),
                );
                file_object.insert(
                    "updatedAt".to_string(),
                    Value::String(pseudo_iso_timestamp()),
                );
                file_object.insert("status".to_string(), Value::String("modified".to_string()));
            }
        }
    }
    files = sort_workbench_files(files);
    root.insert("files".to_string(), Value::Array(files.clone()));
    root.insert(
        "memory".to_string(),
        Value::Array(build_workbench_memory_entries(&files)),
    );
    Ok((Value::Object(root), updated))
}

fn update_instance_llm_provider_config_in_snapshot(
    snapshot: Value,
    provider_id: &str,
    update: Value,
) -> Result<(Value, bool), String> {
    let update_object = update
        .as_object()
        .cloned()
        .ok_or_else(|| "llm provider config update must be an object".to_string())?;
    let endpoint = update_object
        .get("endpoint")
        .and_then(Value::as_str)
        .unwrap_or("https://api.openai.com/v1");
    let api_key_source = update_object
        .get("apiKeySource")
        .and_then(Value::as_str)
        .unwrap_or("");
    let default_model_id = update_object
        .get("defaultModelId")
        .and_then(Value::as_str)
        .unwrap_or("gpt-5.4");
    let reasoning_model_id = update_object
        .get("reasoningModelId")
        .and_then(Value::as_str);
    let embedding_model_id = update_object
        .get("embeddingModelId")
        .and_then(Value::as_str);
    let config = update_object
        .get("config")
        .cloned()
        .unwrap_or_else(|| json!({
            "temperature": 0.2,
            "topP": 1.0,
            "maxTokens": 4096,
            "timeoutMs": 60000,
            "streaming": true
        }));

    let mut root = into_object(snapshot);
    let mut providers = root
        .get("llmProviders")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut updated = false;
    for provider in &mut providers {
        if provider.get("id").and_then(Value::as_str) == Some(provider_id) {
            updated = true;
            if let Some(provider_object) = provider.as_object_mut() {
                provider_object.insert(
                    "endpoint".to_string(),
                    Value::String(endpoint.to_string()),
                );
                provider_object.insert(
                    "apiKeySource".to_string(),
                    Value::String(api_key_source.to_string()),
                );
                provider_object.insert(
                    "status".to_string(),
                    Value::String(
                        if api_key_source.trim().is_empty() {
                            "configurationRequired"
                        } else {
                            "ready"
                        }
                        .to_string(),
                    ),
                );
                provider_object.insert(
                    "defaultModelId".to_string(),
                    Value::String(default_model_id.to_string()),
                );
                provider_object.insert(
                    "reasoningModelId".to_string(),
                    reasoning_model_id
                        .map(|value| Value::String(value.to_string()))
                        .unwrap_or(Value::Null),
                );
                provider_object.insert(
                    "embeddingModelId".to_string(),
                    embedding_model_id
                        .map(|value| Value::String(value.to_string()))
                        .unwrap_or(Value::Null),
                );
                provider_object.insert(
                    "lastCheckedAt".to_string(),
                    Value::String(pseudo_iso_timestamp()),
                );
                provider_object.insert("config".to_string(), config.clone());
                provider_object.insert(
                    "models".to_string(),
                    Value::Array(build_provider_models(
                        default_model_id,
                        reasoning_model_id,
                        embedding_model_id,
                    )),
                );
            }
        }
    }

    if !updated {
        providers.push(json!({
            "id": provider_id,
            "name": provider_id.to_ascii_uppercase(),
            "provider": provider_id,
            "endpoint": endpoint,
            "apiKeySource": api_key_source,
            "status": if api_key_source.trim().is_empty() { "configurationRequired" } else { "ready" },
            "defaultModelId": default_model_id,
            "reasoningModelId": reasoning_model_id,
            "embeddingModelId": embedding_model_id,
            "description": "Managed provider profile projected by the canonical host workbench.",
            "icon": provider_id
                .chars()
                .next()
                .map(|value| value.to_ascii_uppercase().to_string())
                .unwrap_or_else(|| "P".to_string()),
            "lastCheckedAt": pseudo_iso_timestamp(),
            "capabilities": ["chat", "reasoning", "embedding"],
            "models": build_provider_models(
                default_model_id,
                reasoning_model_id,
                embedding_model_id,
            ),
            "config": config
        }));
        updated = true;
    }

    root.insert("llmProviders".to_string(), Value::Array(providers));
    Ok((Value::Object(root), updated))
}

fn build_provider_models(
    default_model_id: &str,
    reasoning_model_id: Option<&str>,
    embedding_model_id: Option<&str>,
) -> Vec<Value> {
    let mut models = vec![json!({
        "id": default_model_id,
        "name": default_model_id,
        "role": "primary",
        "contextWindow": "128k"
    })];
    if let Some(value) = reasoning_model_id {
        models.push(json!({
            "id": value,
            "name": value,
            "role": "reasoning",
            "contextWindow": "200k"
        }));
    }
    if let Some(value) = embedding_model_id {
        models.push(json!({
            "id": value,
            "name": value,
            "role": "embedding",
            "contextWindow": "8k"
        }));
    }
    models
}

fn normalize_storage(raw: Option<Value>, namespace: &str, provider: &str) -> Value {
    let mut value = json!({ "provider": provider, "namespace": namespace });
    if let Some(raw) = raw {
        merge_values(&mut value, raw);
    }
    value
}

fn default_instance_config(
    port: u16,
    published_base_url: Option<&str>,
    published_websocket_url: Option<&str>,
) -> Value {
    json!({
        "port": port.to_string(),
        "sandbox": true,
        "autoUpdate": true,
        "logLevel": "info",
        "corsOrigins": "*",
        "baseUrl": published_base_url.map(|value| Value::String(value.to_string())).unwrap_or(Value::Null),
        "websocketUrl": published_websocket_url.map(|value| Value::String(value.to_string())).unwrap_or(Value::Null),
        "authToken": Value::Null
    })
}

fn normalize_config(
    raw: Option<Value>,
    port: u16,
    host: &str,
    supports_ws: bool,
    published_base_url: Option<&str>,
    published_websocket_url: Option<&str>,
    force_published_urls: bool,
) -> Value {
    let mut value = default_instance_config(port, published_base_url, published_websocket_url);
    if let Some(raw) = raw {
        merge_values(&mut value, raw);
    }
    let resolved_base_url = if force_published_urls {
        published_base_url.map(|value| Value::String(value.to_string()))
    } else {
        Some(Value::String(format!("http://{host}:{port}")))
    }
    .unwrap_or(Value::Null);
    let resolved_websocket_url = if force_published_urls {
        published_websocket_url.map(|value| Value::String(value.to_string()))
    } else if supports_ws {
        Some(Value::String(format!("ws://{host}:{port}")))
    } else {
        None
    }
    .unwrap_or(Value::Null);
    if let Some(object) = value.as_object_mut() {
        object.insert("port".to_string(), Value::String(port.to_string()));
        object.insert("baseUrl".to_string(), resolved_base_url);
        object.insert("websocketUrl".to_string(), resolved_websocket_url);
    }
    value
}

fn to_control_plane_gateway_invoke_request(
    request: StudioOpenClawGatewayInvokeRequest,
    options: StudioOpenClawGatewayInvokeOptions,
) -> ControlPlaneOpenClawGatewayInvokeRequest {
    ControlPlaneOpenClawGatewayInvokeRequest {
        tool: request.tool,
        action: request.action,
        args: request.args,
        session_key: request.session_key,
        dry_run: request.dry_run,
        message_channel: options.message_channel,
        account_id: options.account_id,
        headers: if options.headers.is_empty() {
            None
        } else {
            Some(options.headers)
        },
    }
}

fn derive_websocket_endpoint(
    base_url: Option<&str>,
    host: &str,
    active_port: Option<u16>,
) -> Option<String> {
    if let Some(base_url) = base_url {
        if let Some(stripped) = base_url.strip_prefix("https://") {
            return Some(format!("wss://{stripped}"));
        }
        if let Some(stripped) = base_url.strip_prefix("http://") {
            return Some(format!("ws://{stripped}"));
        }
    }

    active_port.map(|port| format!("ws://{host}:{port}"))
}

fn normalize_capabilities(raw: Option<Value>, runtime_kind: &str) -> Value {
    if let Some(raw) = raw {
        if let Some(items) = raw.as_array() {
            if !items.is_empty() {
                return Value::Array(items.clone());
            }
        }
    }
    let defaults = if runtime_kind == "openclaw" {
        vec![
            "chat", "health", "files", "memory", "tasks", "tools", "models",
        ]
    } else {
        vec!["chat", "health", "models"]
    };
    Value::Array(
        defaults
            .into_iter()
            .map(|item| Value::String(item.to_string()))
            .collect(),
    )
}

fn normalized_capability_snapshots(raw: Option<Value>) -> Value {
    let capabilities = raw
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| item.as_str().map(ToOwned::to_owned))
        .map(|id| {
            json!({
                "id": id,
                "status": "ready",
                "detail": "Server-backed studio detail projection.",
                "source": "runtime"
            })
        })
        .collect::<Vec<_>>();
    Value::Array(capabilities)
}

fn value_as_u16(value: Option<&Value>) -> Option<u16> {
    match value? {
        Value::Number(number) => number.as_u64().and_then(|value| u16::try_from(value).ok()),
        Value::String(value) => value.parse::<u16>().ok(),
        _ => None,
    }
}

fn merge_values(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(target_object), Value::Object(patch_object)) => {
            for (key, patch_value) in patch_object {
                if let Some(target_value) = target_object.get_mut(&key) {
                    merge_values(target_value, patch_value);
                } else {
                    target_object.insert(key, patch_value);
                }
            }
        }
        (target_slot, patch_value) => *target_slot = patch_value,
    }
}

fn into_object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(object) => object,
        _ => Map::new(),
    }
}

fn read_json_document<T>(path: &Path) -> Result<T, String>
where
    T: Default + DeserializeOwned,
{
    if !path.exists() {
        return Ok(T::default());
    }
    let bytes = fs::read(path).map_err(|error| format!("read {}: {error}", path.display()))?;
    if bytes.is_empty() {
        return Ok(T::default());
    }
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("deserialize {}: {error}", path.display()))
}

fn write_json_document<T>(path: &Path, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("create {}: {error}", parent.display()))?;
    }
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("serialize {}: {error}", path.display()))?;
    fs::write(path, bytes).map_err(|error| format!("write {}: {error}", path.display()))
}

fn serialize_provider_value<T>(value: T, label: &str) -> Result<Value, String>
where
    T: Serialize,
{
    serde_json::to_value(value).map_err(|error| format!("serialize {label}: {error}"))
}

fn serialize_optional_provider_value<T>(
    value: Option<T>,
    label: &str,
) -> Result<Option<Value>, String>
where
    T: Serialize,
{
    value
        .map(|item| serialize_provider_value(item, label))
        .transpose()
}

fn deserialize_provider_value<T>(value: Value, label: &str) -> Result<T, String>
where
    T: DeserializeOwned,
{
    serde_json::from_value(value).map_err(|error| format!("deserialize {label}: {error}"))
}

fn slugify(input: &str) -> String {
    let mut result = String::new();
    let mut last_dash = false;
    for character in input.chars() {
        if character.is_ascii_alphanumeric() {
            result.push(character.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            result.push('-');
            last_dash = true;
        }
    }
    let trimmed = result.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "custom-instance".to_string()
    } else {
        trimmed
    }
}

fn dedupe_id(base: &str, existing: &BTreeSet<String>) -> String {
    if !existing.contains(base) {
        return base.to_string();
    }
    let mut counter = 2u64;
    loop {
        let candidate = format!("{base}-{counter}");
        if !existing.contains(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::{
        build_default_studio_public_api_provider, build_typed_studio_public_api_provider,
        StudioOpenClawGatewayInvokeOptions, StudioOpenClawGatewayInvokeRequest,
        TypedStudioPublicApiBackend,
    };
    use sdkwork_claw_host_core::{
        host_endpoints::{HostEndpointRegistration, HostEndpointRegistry, OpenClawLifecycle},
        openclaw_control_plane::OpenClawControlPlane,
    };
    use serde::{Deserialize, Serialize};
    use serde_json::{json, Value};
    use std::sync::{Arc, Mutex};

    #[test]
    fn default_provider_exposes_local_built_in_instance_projection() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let instances = provider.list_instances().expect("list instances");
        let built_in = instances
            .as_array()
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("id").and_then(serde_json::Value::as_str) == Some("local-built-in")
                })
            })
            .expect("built-in instance");

        assert_eq!(
            built_in
                .get("deploymentMode")
                .and_then(serde_json::Value::as_str),
            Some("local-managed")
        );
        assert_eq!(
            built_in
                .get("transportKind")
                .and_then(serde_json::Value::as_str),
            Some("openclawGatewayWs")
        );
    }

    #[test]
    fn default_provider_projects_built_in_endpoint_from_openclaw_control_plane() {
        let root = tempfile::tempdir().expect("temp dir");
        let mut host_endpoints = HostEndpointRegistry::default();
        host_endpoints.register(HostEndpointRegistration {
            endpoint_id: "openclaw-gateway".to_string(),
            bind_host: "10.0.0.8".to_string(),
            requested_port: 28_789,
            active_port: Some(42_617),
            scheme: "http".to_string(),
            base_path: None,
            websocket_path: None,
            loopback_only: false,
            dynamic_port: true,
            last_conflict_at: None,
            last_conflict_reason: Some("requested port busy".to_string()),
        });
        let control_plane = OpenClawControlPlane::inactive("test-host")
            .with_host_endpoints(host_endpoints)
            .with_gateway_endpoint("openclaw-gateway", OpenClawLifecycle::Ready);
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(control_plane),
        )
        .expect("provider");

        let built_in = provider
            .get_instance("local-built-in")
            .expect("get instance")
            .expect("built-in instance");

        assert_eq!(
            built_in
                .get("host")
                .and_then(serde_json::Value::as_str),
            Some("10.0.0.8")
        );
        assert_eq!(
            built_in
                .get("port")
                .and_then(serde_json::Value::as_u64),
            Some(42_617)
        );
        assert_eq!(
            built_in
                .get("baseUrl")
                .and_then(serde_json::Value::as_str),
            Some("http://10.0.0.8:42617")
        );
        assert_eq!(
            built_in
                .get("websocketUrl")
                .and_then(serde_json::Value::as_str),
            Some("ws://10.0.0.8:42617")
        );
        assert_eq!(
            built_in
                .get("config")
                .and_then(|value| value.get("port"))
                .and_then(serde_json::Value::as_str),
            Some("28789")
        );
        assert_eq!(
            built_in
                .get("config")
                .and_then(|value| value.get("baseUrl"))
                .and_then(serde_json::Value::as_str),
            Some("http://10.0.0.8:42617")
        );
    }

    #[test]
    fn default_provider_persists_custom_instance_config_updates() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Shared Server Instance",
                "runtimeKind": "openclaw",
                "deploymentMode": "local-managed",
                "transportKind": "openclawGatewayWs"
            }))
            .expect("create instance");
        let id = created
            .get("id")
            .and_then(serde_json::Value::as_str)
            .expect("id");

        let config = provider
            .update_instance_config(
                id,
                json!({
                    "port": "28888",
                    "sandbox": true,
                    "autoUpdate": false,
                    "logLevel": "debug",
                    "corsOrigins": "http://localhost:3001"
                }),
            )
            .expect("update config")
            .expect("config projection");

        assert_eq!(
            config.get("port").and_then(serde_json::Value::as_str),
            Some("28888")
        );
    }

    #[test]
    fn default_provider_persists_workbench_mutations_for_managed_openclaw_instances() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let detail = provider
            .get_instance_detail("local-built-in")
            .expect("detail request should succeed")
            .expect("built-in detail should exist");
        assert!(
            detail.get("workbench").is_some(),
            "default provider should project a workbench snapshot for managed openclaw instances"
        );

        provider
            .create_instance_task(
                "local-built-in",
                json!({
                    "id": "job-1",
                    "name": "Daily Sync",
                    "schedule": {
                        "kind": "cron",
                        "expr": "0 9 * * *",
                        "tz": "Asia/Shanghai"
                    },
                    "payload": {
                        "kind": "agentTurn",
                        "message": "Summarize updates.",
                        "model": "openai/gpt-5.4"
                    }
                }),
            )
            .expect("task create should persist into the default provider");
        provider
            .update_instance_task(
                "local-built-in",
                "job-1",
                json!({
                    "id": "job-1",
                    "name": "Updated Daily Sync",
                    "enabled": false,
                    "schedule": {
                        "kind": "cron",
                        "expr": "0 10 * * *",
                        "tz": "Asia/Shanghai"
                    },
                    "payload": {
                        "kind": "agentTurn",
                        "message": "Summarize only critical updates.",
                        "model": "openai/gpt-5.4"
                    }
                }),
            )
            .expect("task update should persist into the default provider");
        provider
            .clone_instance_task(
                "local-built-in",
                "job-1",
                Some("Daily Sync Copy".to_string()),
            )
            .expect("task clone should persist into the default provider");
        let execution = provider
            .run_instance_task_now("local-built-in", "job-1")
            .expect("task run should create an execution record");
        let executions = provider
            .list_instance_task_executions("local-built-in", "job-1")
            .expect("task execution list should succeed");
        provider
            .update_instance_task_status("local-built-in", "job-1", "paused".to_string())
            .expect("task status update should succeed");
        let file_updated = provider
            .update_instance_file_content(
                "local-built-in",
                "/workspace/main/AGENTS.md",
                "# Updated main agent".to_string(),
            )
            .expect("file update should succeed");
        let provider_updated = provider
            .update_instance_llm_provider_config(
                "local-built-in",
                "openai",
                json!({
                    "endpoint": "https://api.openai.com/v1",
                    "apiKeySource": "env:OPENAI_API_KEY",
                    "defaultModelId": "gpt-5.4",
                    "reasoningModelId": "o4-mini",
                    "embeddingModelId": "text-embedding-3-large",
                    "config": {
                        "temperature": 0.1,
                        "topP": 1.0,
                        "maxTokens": 4096,
                        "timeoutMs": 60000,
                        "streaming": true
                    }
                }),
            )
            .expect("provider update should succeed");
        let deleted = provider
            .delete_instance_task("local-built-in", "job-1")
            .expect("task delete should succeed");
        let detail = provider
            .get_instance_detail("local-built-in")
            .expect("detail request should succeed")
            .expect("built-in detail should exist");
        let workbench = detail
            .get("workbench")
            .and_then(Value::as_object)
            .expect("detail should expose a workbench snapshot");
        let llm_providers = workbench
            .get("llmProviders")
            .and_then(Value::as_array)
            .expect("workbench should expose provider entries");
        let files = workbench
            .get("files")
            .and_then(Value::as_array)
            .expect("workbench should expose files");
        let tasks = workbench
            .get("cronTasks")
            .and_then(|value| value.get("tasks"))
            .and_then(Value::as_array)
            .expect("workbench should expose task entries");

        assert_eq!(execution.get("taskId").and_then(Value::as_str), Some("job-1"));
        assert_eq!(executions.as_array().map(|items| items.len()), Some(1));
        assert!(file_updated);
        assert!(provider_updated);
        assert!(deleted);
        assert!(tasks
            .iter()
            .all(|task| task.get("id").and_then(Value::as_str) != Some("job-1")));
        assert!(files.iter().any(|file| {
            file.get("id").and_then(Value::as_str) == Some("/workspace/main/AGENTS.md")
                && file.get("content").and_then(Value::as_str) == Some("# Updated main agent")
        }));
        assert!(llm_providers.iter().any(|provider| {
            provider.get("id").and_then(Value::as_str) == Some("openai")
                && provider.get("endpoint").and_then(Value::as_str)
                    == Some("https://api.openai.com/v1")
        }));
    }

    #[test]
    fn default_backend_can_be_wrapped_by_typed_adapter_without_losing_built_in_projection() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_typed_studio_public_api_provider(
            super::ServerStudioPublicApiProvider::new(
                root.path().to_path_buf(),
                std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
            )
            .expect("backend"),
        );

        let instances = provider.list_instances().expect("list instances");
        let built_in = instances
            .as_array()
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("id").and_then(serde_json::Value::as_str) == Some("local-built-in")
                })
            })
            .expect("built-in instance");

        assert_eq!(
            built_in
                .get("deploymentMode")
                .and_then(serde_json::Value::as_str),
            Some("local-managed")
        );
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeInstanceRecord {
        id: String,
        name: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeCreateInstanceInput {
        name: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeUpdateInstanceInput {
        name: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeInstanceDetailRecord {
        id: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeInstanceConfigRecord {
        port: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeConversationRecord {
        id: String,
        title: String,
    }

    #[derive(Debug)]
    struct FakeTypedStudioBackend {
        created_names: Arc<Mutex<Vec<String>>>,
    }

    impl TypedStudioPublicApiBackend for FakeTypedStudioBackend {
        type InstanceRecord = FakeInstanceRecord;
        type CreateInstanceInput = FakeCreateInstanceInput;
        type UpdateInstanceInput = FakeUpdateInstanceInput;
        type InstanceDetailRecord = FakeInstanceDetailRecord;
        type InstanceConfigRecord = FakeInstanceConfigRecord;
        type ConversationRecord = FakeConversationRecord;

        fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String> {
            Ok(Vec::new())
        }

        fn create_instance(
            &self,
            input: Self::CreateInstanceInput,
        ) -> Result<Self::InstanceRecord, String> {
            self.created_names
                .lock()
                .expect("created names lock")
                .push(input.name.clone());
            Ok(FakeInstanceRecord {
                id: "fake-instance".to_string(),
                name: input.name,
            })
        }

        fn get_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn update_instance(
            &self,
            _id: &str,
            _input: Self::UpdateInstanceInput,
        ) -> Result<Self::InstanceRecord, String> {
            Err("unused".to_string())
        }

        fn delete_instance(&self, _id: &str) -> Result<bool, String> {
            Ok(false)
        }

        fn start_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn stop_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn restart_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn get_instance_detail(
            &self,
            _id: &str,
        ) -> Result<Option<Self::InstanceDetailRecord>, String> {
            Ok(None)
        }

        fn get_instance_config(
            &self,
            _id: &str,
        ) -> Result<Option<Self::InstanceConfigRecord>, String> {
            Ok(None)
        }

        fn update_instance_config(
            &self,
            _id: &str,
            _config: Self::InstanceConfigRecord,
        ) -> Result<Option<Self::InstanceConfigRecord>, String> {
            Ok(None)
        }

        fn get_instance_logs(&self, _id: &str) -> Result<String, String> {
            Ok(String::new())
        }

        fn invoke_openclaw_gateway(
            &self,
            _instance_id: &str,
            request: StudioOpenClawGatewayInvokeRequest,
            options: StudioOpenClawGatewayInvokeOptions,
        ) -> Result<Value, String> {
            Ok(json!({
                "tool": request.tool,
                "action": request.action,
                "messageChannel": options.message_channel
            }))
        }

        fn create_instance_task(
            &self,
            _instance_id: &str,
            _payload: Value,
        ) -> Result<(), String> {
            Ok(())
        }

        fn update_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _payload: Value,
        ) -> Result<(), String> {
            Ok(())
        }

        fn update_instance_file_content(
            &self,
            _instance_id: &str,
            _file_id: &str,
            _content: String,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn update_instance_llm_provider_config(
            &self,
            _instance_id: &str,
            _provider_id: &str,
            _update: Value,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn clone_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _name: Option<String>,
        ) -> Result<(), String> {
            Ok(())
        }

        fn run_instance_task_now(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<Value, String> {
            Ok(json!({
                "id": "exec-1",
                "taskId": "job-1"
            }))
        }

        fn list_instance_task_executions(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<Vec<Value>, String> {
            Ok(vec![json!({
                "id": "exec-1",
                "taskId": "job-1"
            })])
        }

        fn update_instance_task_status(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _status: String,
        ) -> Result<(), String> {
            Ok(())
        }

        fn delete_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn list_conversations(&self, _instance_id: &str) -> Result<Vec<Self::ConversationRecord>, String> {
            Ok(Vec::new())
        }

        fn put_conversation(
            &self,
            _id: &str,
            record: Self::ConversationRecord,
        ) -> Result<Self::ConversationRecord, String> {
            Ok(record)
        }

        fn delete_conversation(&self, _id: &str) -> Result<bool, String> {
            Ok(false)
        }
    }

    #[test]
    fn typed_provider_serializes_typed_backend_results_and_deserializes_inputs() {
        let created_names = Arc::new(Mutex::new(Vec::new()));
        let provider = build_typed_studio_public_api_provider(FakeTypedStudioBackend {
            created_names: created_names.clone(),
        });

        let created = provider
            .create_instance(json!({
                "name": "Desktop Typed Backend"
            }))
            .expect("create instance through typed provider");

        assert_eq!(
            created.get("id").and_then(serde_json::Value::as_str),
            Some("fake-instance")
        );
        assert_eq!(
            created.get("name").and_then(serde_json::Value::as_str),
            Some("Desktop Typed Backend")
        );
        assert_eq!(
            created_names.lock().expect("created names lock").as_slice(),
            ["Desktop Typed Backend"]
        );
    }
}
