use crate::{
  framework::services::jobs::JobRecord,
  state::AppState,
};

#[tauri::command]
pub fn job_submit(kind: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
  state
    .context
    .services
    .jobs
    .submit(&kind)
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn job_get(id: String, state: tauri::State<'_, AppState>) -> Result<JobRecord, String> {
  state
    .context
    .services
    .jobs
    .get(&id)
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn job_list(state: tauri::State<'_, AppState>) -> Result<Vec<JobRecord>, String> {
  state
    .context
    .services
    .jobs
    .list()
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn job_cancel(id: String, state: tauri::State<'_, AppState>) -> Result<JobRecord, String> {
  state
    .context
    .services
    .jobs
    .cancel(&id)
    .map_err(|error| error.to_string())
}
