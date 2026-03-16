use crate::state::AppState;

#[tauri::command]
pub fn get_device_id(state: tauri::State<'_, AppState>) -> Result<String, String> {
    state
        .context
        .services
        .system
        .load_or_create_device_id(&state.context.paths)
        .map_err(|error| error.to_string())
}
