mod app;
mod commands;
mod framework;
mod internal_cli;
mod platform;
mod plugins;
mod state;

fn trace_lifecycle(message: &str) {
    eprintln!("[desktop-tauri][lib] {message}");
}

pub fn run() {
    trace_lifecycle("run() entered");
    if internal_cli::maybe_handle_internal_cli_action() {
        trace_lifecycle("internal CLI action handled; exiting early");
        return;
    }

    trace_lifecycle("building Tauri application");
    let result = app::bootstrap::build().run(tauri::generate_context!());
    if let Err(error) = result.as_ref() {
        eprintln!("[desktop-tauri][lib] tauri run failed: {error}");
    } else {
        trace_lifecycle("tauri event loop exited cleanly");
    }

    result.expect("failed to run claw studio desktop");
}
