mod app;
mod commands;
mod framework;
mod platform;
mod plugins;
mod state;

pub fn run() {
    app::bootstrap::build()
        .run(tauri::generate_context!())
        .expect("failed to run claw studio desktop");
}
