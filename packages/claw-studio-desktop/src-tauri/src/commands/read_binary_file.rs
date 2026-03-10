use crate::state::AppState;

#[tauri::command]
pub fn read_binary_file(path: String, state: tauri::State<'_, AppState>) -> Result<Vec<u8>, String> {
  state
    .context
    .services
    .filesystem
    .read_binary(&state.context.paths, &path)
    .map_err(|error| error.to_string())
}
