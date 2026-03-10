use crate::{commands, state::AppState};

pub fn build() -> tauri::Builder<tauri::Wry> {
  tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![commands::app_info::app_info])
}
