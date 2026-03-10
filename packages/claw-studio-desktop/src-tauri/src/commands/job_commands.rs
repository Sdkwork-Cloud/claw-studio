use crate::{
  framework::services::jobs::JobRecord,
  state::AppState,
};

#[tauri::command]
pub fn job_submit(
  kind: String,
  app: tauri::AppHandle,
  state: tauri::State<'_, AppState>,
) -> Result<String, String> {
  state
    .context
    .services
    .jobs
    .submit_and_emit(&kind, &app)
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
pub fn job_cancel(
  id: String,
  app: tauri::AppHandle,
  state: tauri::State<'_, AppState>,
) -> Result<JobRecord, String> {
  state
    .context
    .services
    .jobs
    .cancel_and_emit(&id, &app)
    .map_err(|error| error.to_string())
}
