use crate::{
  commands,
  framework::{context::FrameworkContext, events},
  plugins,
  state::{AppMetadata, AppState},
};
use std::sync::Arc;
use tauri::{Emitter, Manager};

pub fn build() -> tauri::Builder<tauri::Wry> {
  plugins::register(tauri::Builder::default())
    .setup(|app| {
      let app_handle = app.handle().clone();
      let context = Arc::new(FrameworkContext::bootstrap(&app_handle)?);
      context.logger.info("managed desktop state initialized")?;
      let package_info = app.package_info();
      let metadata = AppMetadata::new(
        package_info.name.clone(),
        package_info.version.to_string(),
        crate::platform::current_target().to_string(),
      );

      let state = AppState::from_metadata(metadata, context);
      app.manage(state);
      app.emit(events::APP_READY, ())?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::app_info::app_info,
      commands::get_app_paths::get_app_paths,
      commands::get_app_config::get_app_config,
      commands::get_system_info::get_system_info,
      commands::get_device_id::get_device_id,
      commands::job_commands::job_submit,
      commands::job_commands::job_get,
      commands::job_commands::job_list,
      commands::job_commands::job_cancel,
      commands::list_directory::list_directory,
      commands::create_directory::create_directory,
      commands::remove_path::remove_path,
      commands::copy_path::copy_path,
      commands::move_path::move_path,
      commands::path_exists::path_exists,
      commands::get_path_info::get_path_info,
      commands::read_binary_file::read_binary_file,
      commands::write_binary_file::write_binary_file,
      commands::open_external::open_external,
      commands::process_commands::process_run_capture,
      commands::select_files::select_files,
      commands::save_blob_file::save_blob_file,
      commands::read_text_file::read_text_file,
      commands::write_text_file::write_text_file,
    ])
}
