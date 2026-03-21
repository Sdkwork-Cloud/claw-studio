use crate::{
    framework::{
        services::studio::{
            StudioConversationRecord, StudioCreateInstanceInput, StudioInstanceConfig,
            StudioInstanceDetailRecord, StudioInstanceRecord, StudioUpdateInstanceInput,
            StudioWorkbenchTaskExecutionRecord,
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
pub fn studio_list_instances(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<StudioInstanceRecord>, String> {
    list_instances_from_state(&state).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_get_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .get_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_get_instance_detail(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceDetailRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .get_instance_detail(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_create_instance(
    state: tauri::State<'_, AppState>,
    input: StudioCreateInstanceInput,
) -> Result<StudioInstanceRecord, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .create_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_update_instance(
    state: tauri::State<'_, AppState>,
    id: String,
    input: StudioUpdateInstanceInput,
) -> Result<StudioInstanceRecord, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .update_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
            input,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_delete_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .delete_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_start_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .start_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_stop_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .stop_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_restart_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .restart_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_get_instance_config(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceConfig>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .get_instance_config(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_update_instance_config(
    state: tauri::State<'_, AppState>,
    id: String,
    config: StudioInstanceConfig,
) -> Result<Option<StudioInstanceConfig>, String> {
    let app_config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .update_instance_config(
            &state.paths,
            &app_config,
            &state.context.services.storage,
            id.as_str(),
            config,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_get_instance_logs(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .get_instance_logs(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_create_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    payload: Value,
) -> Result<(), String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .create_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            &payload,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_update_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    payload: Value,
) -> Result<(), String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .update_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            &payload,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_clone_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    name: Option<String>,
) -> Result<(), String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .clone_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            name.as_deref(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_run_instance_task_now(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<StudioWorkbenchTaskExecutionRecord, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .run_instance_task_now(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_list_instance_task_executions(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .list_instance_task_executions(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            task_id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_update_instance_task_status(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    status: String,
) -> Result<(), String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .update_instance_task_status(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            status.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_delete_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<bool, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .delete_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_list_conversations(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<StudioConversationRecord>, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .list_conversations(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_put_conversation(
    state: tauri::State<'_, AppState>,
    record: StudioConversationRecord,
) -> Result<StudioConversationRecord, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .put_conversation(
            &state.paths,
            &config,
            &state.context.services.storage,
            record,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn studio_delete_conversation(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .delete_conversation(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
        .map_err(|error| error.to_string())
}
