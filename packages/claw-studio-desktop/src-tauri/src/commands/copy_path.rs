use crate::state::AppState;

#[tauri::command]
pub fn copy_path(source_path: String, destination_path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
  state
    .context
    .services
    .filesystem
    .copy_path(&state.context.paths, &source_path, &destination_path)
    .map_err(|error| error.to_string())
}
