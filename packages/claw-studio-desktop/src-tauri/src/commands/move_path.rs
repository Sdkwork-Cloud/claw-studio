use crate::state::AppState;

#[tauri::command]
pub fn move_path(source_path: String, destination_path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
  state
    .context
    .services
    .filesystem
    .move_path(&state.context.paths, &source_path, &destination_path)
    .map_err(|error| error.to_string())
}
