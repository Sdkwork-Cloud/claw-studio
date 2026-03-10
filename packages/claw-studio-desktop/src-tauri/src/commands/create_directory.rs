use crate::state::AppState;

#[tauri::command]
pub fn create_directory(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
  state
    .context
    .services
    .filesystem
    .create_directory(&state.context.paths, &path)
    .map_err(|error| error.to_string())
}
