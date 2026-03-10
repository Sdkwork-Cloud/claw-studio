use crate::{
  framework::services::process::{ProcessRequest, ProcessResult},
  state::AppState,
};

#[tauri::command]
pub fn process_run_capture(
  request: ProcessRequest,
  state: tauri::State<'_, AppState>,
) -> Result<ProcessResult, String> {
  state
    .context
    .services
    .process
    .run_capture(request)
    .map_err(|error| error.to_string())
}
