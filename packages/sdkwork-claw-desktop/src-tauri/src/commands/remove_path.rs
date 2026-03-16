use crate::state::AppState;

#[tauri::command]
pub fn remove_path(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state
        .context
        .services
        .filesystem
        .remove_path(&state.context.paths, &path)
        .map_err(|error| error.to_string())
}
