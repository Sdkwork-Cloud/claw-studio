pub fn register(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    eprintln!("[desktop-tauri][plugins] registering dialog, opener, and single-instance plugins");
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            eprintln!("[desktop-tauri][plugins] single-instance callback triggered");
            if let Err(error) = crate::app::bootstrap::show_main_window(app) {
                eprintln!("[desktop-tauri][plugins] failed to show main window for existing instance: {error}");
            }
        }))
}
