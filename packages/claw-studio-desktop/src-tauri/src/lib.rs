mod app;
mod commands;
mod platform;
mod state;

pub fn run() {
  app::bootstrap::build()
    .run(tauri::generate_context!())
    .expect("failed to run claw studio desktop");
}
