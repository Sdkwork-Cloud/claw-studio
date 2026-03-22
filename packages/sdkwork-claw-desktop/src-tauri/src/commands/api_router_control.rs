use crate::{
    framework::services::api_router_control::{
        ApiRouterModelMappingCreate, ApiRouterModelMappingQuery, ApiRouterModelMappingUpdate,
        ApiRouterProviderQuery, ApiRouterProxyProviderCreate, ApiRouterProxyProviderUpdate,
        ApiRouterUnifiedApiKeyCreate, ApiRouterUnifiedApiKeyQuery, ApiRouterUnifiedApiKeyUpdate,
        ApiRouterUsageRecordsQuery,
    },
    state::AppState,
};
use serde_json::Value;

fn to_string_error<T>(
    result: crate::framework::Result<T>,
) -> std::result::Result<T, String> {
    result.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_api_router_runtime_status(
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(state.context.services.api_router_control.get_runtime_status())
}

#[tauri::command]
pub fn get_api_router_channels(state: tauri::State<'_, AppState>) -> Result<Vec<Value>, String> {
    to_string_error(state.context.services.api_router_control.get_channels())
}

#[tauri::command]
pub fn get_api_router_groups(state: tauri::State<'_, AppState>) -> Result<Vec<Value>, String> {
    to_string_error(state.context.services.api_router_control.get_groups())
}

#[tauri::command]
pub fn get_api_router_proxy_providers(
    query: Option<ApiRouterProviderQuery>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .get_proxy_providers(query.unwrap_or_default()),
    )
}

#[tauri::command]
pub fn create_api_router_proxy_provider(
    input: ApiRouterProxyProviderCreate,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(state.context.services.api_router_control.create_proxy_provider(input))
}

#[tauri::command]
pub fn update_api_router_proxy_provider_group(
    id: String,
    group_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_proxy_provider_group(&id, &group_id),
    )
}

#[tauri::command]
pub fn update_api_router_proxy_provider_status(
    id: String,
    status: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_proxy_provider_status(&id, &status),
    )
}

#[tauri::command]
pub fn update_api_router_proxy_provider(
    id: String,
    update: ApiRouterProxyProviderUpdate,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_proxy_provider(&id, update),
    )
}

#[tauri::command]
pub fn delete_api_router_proxy_provider(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    to_string_error(state.context.services.api_router_control.delete_proxy_provider(&id))
}

#[tauri::command]
pub fn get_api_router_usage_record_api_keys(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    to_string_error(state.context.services.api_router_control.get_usage_record_api_keys())
}

#[tauri::command]
pub fn get_api_router_usage_record_summary(
    query: Option<ApiRouterUsageRecordsQuery>,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .get_usage_record_summary(query.unwrap_or_default()),
    )
}

#[tauri::command]
pub fn get_api_router_usage_records(
    query: Option<ApiRouterUsageRecordsQuery>,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .get_usage_records(query.unwrap_or_default()),
    )
}

#[tauri::command]
pub fn get_api_router_unified_api_keys(
    query: Option<ApiRouterUnifiedApiKeyQuery>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .get_unified_api_keys(query.unwrap_or_default()),
    )
}

#[tauri::command]
pub fn create_api_router_unified_api_key(
    input: ApiRouterUnifiedApiKeyCreate,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(state.context.services.api_router_control.create_unified_api_key(input))
}

#[tauri::command]
pub fn update_api_router_unified_api_key_group(
    id: String,
    group_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_unified_api_key_group(&id, &group_id),
    )
}

#[tauri::command]
pub fn update_api_router_unified_api_key_status(
    id: String,
    status: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_unified_api_key_status(&id, &status),
    )
}

#[tauri::command]
pub fn assign_api_router_unified_api_key_model_mapping(
    id: String,
    model_mapping_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .assign_unified_api_key_model_mapping(&id, model_mapping_id.as_deref()),
    )
}

#[tauri::command]
pub fn update_api_router_unified_api_key(
    id: String,
    update: ApiRouterUnifiedApiKeyUpdate,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_unified_api_key(&id, update),
    )
}

#[tauri::command]
pub fn delete_api_router_unified_api_key(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    to_string_error(state.context.services.api_router_control.delete_unified_api_key(&id))
}

#[tauri::command]
pub fn get_api_router_model_catalog(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    to_string_error(state.context.services.api_router_control.get_model_catalog())
}

#[tauri::command]
pub fn get_api_router_model_mappings(
    query: Option<ApiRouterModelMappingQuery>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .get_model_mappings(query.unwrap_or_default()),
    )
}

#[tauri::command]
pub fn create_api_router_model_mapping(
    input: ApiRouterModelMappingCreate,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(state.context.services.api_router_control.create_model_mapping(input))
}

#[tauri::command]
pub fn update_api_router_model_mapping(
    id: String,
    update: ApiRouterModelMappingUpdate,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_model_mapping(&id, update),
    )
}

#[tauri::command]
pub fn update_api_router_model_mapping_status(
    id: String,
    status: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    to_string_error(
        state
            .context
            .services
            .api_router_control
            .update_model_mapping_status(&id, &status),
    )
}

#[tauri::command]
pub fn delete_api_router_model_mapping(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    to_string_error(state.context.services.api_router_control.delete_model_mapping(&id))
}
