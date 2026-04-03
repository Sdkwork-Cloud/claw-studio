use crate::{
    framework::{
        runtime,
        services::studio::{
            HostPlatformStatusRecord, InternalNodeSessionRecord, ManageRolloutListResult,
            ManageRolloutPreview, ManageRolloutRecord, PreviewRolloutInput,
            StudioConversationRecord, StudioCreateInstanceInput, StudioInstanceConfig,
            StudioInstanceDetailRecord, StudioInstanceRecord, StudioOpenClawGatewayInvokeOptions,
            StudioOpenClawGatewayInvokeRequest, StudioUpdateInstanceInput,
            StudioUpdateInstanceLlmProviderConfigInput, StudioWorkbenchTaskExecutionRecord,
        },
        Result as FrameworkResult,
    },
    state::AppState,
};
use serde_json::Value;

fn list_instances_from_state(state: &AppState) -> FrameworkResult<Vec<StudioInstanceRecord>> {
    let config = state.config_snapshot();
    state.context.services.studio.list_instances(
        &state.paths,
        &config,
        &state.context.services.storage,
    )
}

#[tauri::command]
pub async fn studio_list_instances(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_instances", move || {
        list_instances_from_state(&state)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance_detail(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceDetailRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance_detail", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance_detail(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_invoke_openclaw_gateway(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    request: StudioOpenClawGatewayInvokeRequest,
    options: Option<StudioOpenClawGatewayInvokeOptions>,
) -> Result<Value, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.invoke_openclaw_gateway", move || {
        let config = state.config_snapshot();
        state.context.services.studio.invoke_openclaw_gateway(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            &request,
            &options.unwrap_or_default(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_create_instance(
    state: tauri::State<'_, AppState>,
    input: StudioCreateInstanceInput,
) -> Result<StudioInstanceRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.create_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.create_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance(
    state: tauri::State<'_, AppState>,
    id: String,
    input: StudioUpdateInstanceInput,
) -> Result<StudioInstanceRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_start_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.start_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.start_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_stop_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.stop_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.stop_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_restart_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.restart_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.restart_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance_config(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceConfig>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance_config", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance_config(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_config(
    state: tauri::State<'_, AppState>,
    id: String,
    config: StudioInstanceConfig,
) -> Result<Option<StudioInstanceConfig>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_config", move || {
        let app_config = state.config_snapshot();
        state.context.services.studio.update_instance_config(
            &state.paths,
            &app_config,
            &state.context.services.storage,
            id.as_str(),
            config,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance_logs(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance_logs", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance_logs(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_create_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    payload: Value,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.create_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.create_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            &payload,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    payload: Value,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            &payload,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_file_content(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    file_id: String,
    content: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_file_content", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance_file_content(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            file_id.as_str(),
            content.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_llm_provider_config(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    provider_id: String,
    update: StudioUpdateInstanceLlmProviderConfigInput,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_llm_provider_config", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .update_instance_llm_provider_config(
                &state.paths,
                &config,
                &state.context.services.storage,
                instance_id.as_str(),
                provider_id.as_str(),
                update,
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_clone_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    name: Option<String>,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.clone_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.clone_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            name.as_deref(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_run_instance_task_now(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<StudioWorkbenchTaskExecutionRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.run_instance_task_now", move || {
        let config = state.config_snapshot();
        state.context.services.studio.run_instance_task_now(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_instance_task_executions(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_instance_task_executions", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_instance_task_executions(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            task_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_task_status(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    status: String,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_task_status", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance_task_status(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            status.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_conversations(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<StudioConversationRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_conversations", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_conversations(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_put_conversation(
    state: tauri::State<'_, AppState>,
    record: StudioConversationRecord,
) -> Result<StudioConversationRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.put_conversation", move || {
        let config = state.config_snapshot();
        state.context.services.studio.put_conversation(
            &state.paths,
            &config,
            &state.context.services.storage,
            record,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_conversation(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_conversation", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_conversation(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_host_platform_status(
    state: tauri::State<'_, AppState>,
) -> Result<HostPlatformStatusRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_host_platform_status", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_host_platform_status(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_rollouts(
    state: tauri::State<'_, AppState>,
) -> Result<ManageRolloutListResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_rollouts", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_rollouts(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn preview_rollout(
    state: tauri::State<'_, AppState>,
    input: PreviewRolloutInput,
) -> Result<ManageRolloutPreview, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.preview_rollout", move || {
        let config = state.config_snapshot();
        state.context.services.studio.preview_rollout(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn start_rollout(
    state: tauri::State<'_, AppState>,
    rollout_id: String,
) -> Result<ManageRolloutRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.start_rollout", move || {
        let config = state.config_snapshot();
        state.context.services.studio.start_rollout(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            rollout_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_node_sessions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<InternalNodeSessionRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_node_sessions", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_node_sessions(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
    })
    .await
    .map_err(|error| error.to_string())
}
