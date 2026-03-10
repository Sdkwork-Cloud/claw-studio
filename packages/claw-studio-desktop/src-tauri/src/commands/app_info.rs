use crate::state::AppState;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
  pub name: String,
  pub version: String,
  pub target: String,
}

#[tauri::command]
pub fn app_info(state: tauri::State<'_, AppState>) -> AppInfo {
  AppInfo {
    name: state.app_name.clone(),
    version: state.app_version.clone(),
    target: state.target.clone(),
  }
}
