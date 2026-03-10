use crate::{framework::filesystem::ManagedFileEntry, state::AppState};

#[tauri::command]
pub fn list_directory(path: String, state: tauri::State<'_, AppState>) -> Result<Vec<ManagedFileEntry>, String> {
  state
    .context
    .services
    .filesystem
    .list_directory(&state.context.paths, &path)
    .map_err(|error| error.to_string())
}
