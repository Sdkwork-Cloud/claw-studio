use crate::{
    framework::{runtime, services::jobs::JobRecord},
    state::AppState,
};

#[tauri::command]
pub async fn job_submit(
    kind: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.submit", move || {
        state.context.services.jobs.submit_and_emit(&kind, &app)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_submit_process(
    profile_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.submit_process", move || {
        state.context.services.jobs.submit_process_and_emit(
            state.context.services.process.clone(),
            &profile_id,
            app,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_get(id: String, state: tauri::State<'_, AppState>) -> Result<JobRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.get", move || state.context.services.jobs.get(&id))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_list(state: tauri::State<'_, AppState>) -> Result<Vec<JobRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.list", move || state.context.services.jobs.list())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_cancel(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<JobRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.cancel", move || {
        let current = state.context.services.jobs.get(&id)?;

        if let Some(process_id) = current.process_id.as_deref() {
            match state.context.services.process.cancel(process_id) {
                Ok(()) => {}
                Err(crate::framework::FrameworkError::NotFound(_)) => {}
                Err(error) => return Err(error),
            }
        }

        state.context.services.jobs.cancel_and_emit(&id, &app)
    })
    .await
    .map_err(|error| error.to_string())
}
