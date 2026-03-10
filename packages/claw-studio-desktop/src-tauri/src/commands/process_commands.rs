use crate::{
  framework::services::process::{ProcessRequest, ProcessResult},
  state::AppState,
};

#[tauri::command]
pub fn process_run_capture(
  request: ProcessRequest,
  app: tauri::AppHandle,
  state: tauri::State<'_, AppState>,
) -> Result<ProcessResult, String> {
  state
    .context
    .services
    .process
    .run_capture_and_emit(request, &app)
    .map_err(|error| error.to_string())
}
