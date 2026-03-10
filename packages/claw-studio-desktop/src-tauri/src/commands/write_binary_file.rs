use crate::state::AppState;

#[tauri::command]
pub fn write_binary_file(path: String, content: Vec<u8>, state: tauri::State<'_, AppState>) -> Result<(), String> {
  state
    .context
    .services
    .filesystem
    .write_binary(&state.context.paths, &path, &content)
    .map_err(|error| error.to_string())
}
