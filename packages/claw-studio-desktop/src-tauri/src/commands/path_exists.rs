use crate::state::AppState;

#[tauri::command]
pub fn path_exists(path: String, state: tauri::State<'_, AppState>) -> Result<bool, String> {
  state
    .context
    .services
    .filesystem
    .path_exists(&state.context.paths, &path)
    .map_err(|error| error.to_string())
}
