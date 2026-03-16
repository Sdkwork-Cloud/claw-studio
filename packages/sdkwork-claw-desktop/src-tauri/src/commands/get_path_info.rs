use crate::{framework::filesystem::ManagedPathInfo, state::AppState};

#[tauri::command]
pub fn get_path_info(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<ManagedPathInfo, String> {
    state
        .context
        .services
        .filesystem
        .get_path_info(&state.context.paths, &path)
        .map_err(|error| error.to_string())
}
