use crate::{
    commands,
    framework::{
        config::{
            normalize_app_language_preference, APP_LANGUAGE_PREFERENCE_ENGLISH,
            APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE,
        },
        context::FrameworkContext,
        events,
        services::supervisor::{
            SERVICE_ID_API_ROUTER, SERVICE_ID_OPENCLAW_GATEWAY, SERVICE_ID_WEB_SERVER,
        },
        FrameworkError, Result as FrameworkResult,
    },
    plugins,
    state::{AppMetadata, AppState},
};
use std::{sync::Arc, thread};
use tauri::{
    menu::{Menu, MenuBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, Window, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ICON_ID: &str = "main_tray";
const ROUTE_DASHBOARD: &str = "/dashboard";
const ROUTE_INSTALL: &str = "/install";
const ROUTE_APPS: &str = "/apps";
const ROUTE_INSTANCES: &str = "/instances";
const ROUTE_TASKS: &str = "/tasks";
const ROUTE_API_ROUTER: &str = "/api-router";
const ROUTE_SETTINGS: &str = "/settings";

pub(crate) const TRAY_MENU_ID_SHOW_WINDOW: &str = "show_window";
pub(crate) const TRAY_MENU_ID_OPEN_DASHBOARD: &str = "open_dashboard";
pub(crate) const TRAY_MENU_ID_OPEN_INSTALL: &str = "open_install";
pub(crate) const TRAY_MENU_ID_OPEN_APPS: &str = "open_apps";
pub(crate) const TRAY_MENU_ID_OPEN_INSTANCES: &str = "open_instances";
pub(crate) const TRAY_MENU_ID_OPEN_TASKS: &str = "open_tasks";
pub(crate) const TRAY_MENU_ID_OPEN_API_ROUTER: &str = "open_api_router";
pub(crate) const TRAY_MENU_ID_OPEN_SETTINGS: &str = "open_settings";
pub(crate) const TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY: &str = "restart_openclaw_gateway";
pub(crate) const TRAY_MENU_ID_RESTART_WEB_SERVER: &str = "restart_web_server";
pub(crate) const TRAY_MENU_ID_RESTART_API_ROUTER: &str = "restart_api_router";
pub(crate) const TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES: &str = "restart_background_services";
pub(crate) const TRAY_MENU_ID_OPEN_LOGS_DIRECTORY: &str = "open_logs_directory";
pub(crate) const TRAY_MENU_ID_REVEAL_MAIN_LOG: &str = "reveal_main_log";
pub(crate) const TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY: &str = "open_integrations_directory";
pub(crate) const TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY: &str = "open_plugins_directory";
pub(crate) const TRAY_MENU_ID_QUIT_APP: &str = "quit_app";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TrayAction {
    ShowWindow,
    OpenRoute(&'static str),
    RestartManagedService(&'static str),
    RestartBackgroundServices,
    OpenLogsDirectory,
    RevealMainLog,
    OpenIntegrationsDirectory,
    OpenPluginsDirectory,
    QuitApp,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayNavigatePayload {
    route: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TrayLanguage {
    En,
    Zh,
}

#[cfg(test)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum TrayMenuEntry {
    Item { id: &'static str, label: String },
    Separator,
    Submenu {
        label: String,
        items: Vec<TrayMenuEntry>,
    },
}

#[derive(Clone, Copy, Debug)]
struct TrayLabels {
    open_window: &'static str,
    navigate: &'static str,
    dashboard: &'static str,
    install: &'static str,
    apps: &'static str,
    instances: &'static str,
    tasks: &'static str,
    api_router: &'static str,
    settings: &'static str,
    services: &'static str,
    restart_openclaw_gateway: &'static str,
    restart_web_server: &'static str,
    restart_api_router: &'static str,
    restart_all_background_services: &'static str,
    diagnostics: &'static str,
    open_logs_directory: &'static str,
    reveal_main_log: &'static str,
    open_integrations_directory: &'static str,
    open_plugins_directory: &'static str,
    quit_app: &'static str,
}

pub fn build() -> tauri::Builder<tauri::Wry> {
    plugins::register(tauri::Builder::default())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let context = Arc::new(FrameworkContext::bootstrap(&app_handle)?);
            context.logger.info("managed desktop state initialized")?;
            if let Err(error) = ensure_api_router_runtime(context.as_ref()) {
                let _ = context
                    .logger
                    .error(&format!("failed to initialize sdkwork-api-router runtime: {error}"));
            }
            let package_info = app.package_info();
            let metadata = AppMetadata::new(
                package_info.name.clone(),
                package_info.version.to_string(),
                crate::platform::current_target().to_string(),
            );

            let state = AppState::from_metadata(metadata, context);
            app.manage(state);
            create_tray(&app_handle)?;
            app.emit(events::APP_READY, ())?;

            Ok(())
        })
        .on_window_event(handle_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::api_router_auth::sync_auth_session,
            commands::api_router_auth::clear_auth_session,
            commands::api_router_auth::get_api_router_admin_token,
            commands::api_router_control::get_api_router_runtime_status,
            commands::api_router_control::get_api_router_channels,
            commands::api_router_control::get_api_router_groups,
            commands::api_router_control::get_api_router_proxy_providers,
            commands::api_router_control::create_api_router_proxy_provider,
            commands::api_router_control::update_api_router_proxy_provider_group,
            commands::api_router_control::update_api_router_proxy_provider_status,
            commands::api_router_control::update_api_router_proxy_provider,
            commands::api_router_control::delete_api_router_proxy_provider,
            commands::api_router_control::get_api_router_usage_record_api_keys,
            commands::api_router_control::get_api_router_usage_record_summary,
            commands::api_router_control::get_api_router_usage_records,
            commands::api_router_control::get_api_router_unified_api_keys,
            commands::api_router_control::create_api_router_unified_api_key,
            commands::api_router_control::update_api_router_unified_api_key_group,
            commands::api_router_control::update_api_router_unified_api_key_status,
            commands::api_router_control::assign_api_router_unified_api_key_model_mapping,
            commands::api_router_control::update_api_router_unified_api_key,
            commands::api_router_control::delete_api_router_unified_api_key,
            commands::api_router_control::get_api_router_model_catalog,
            commands::api_router_control::get_api_router_model_mappings,
            commands::api_router_control::create_api_router_model_mapping,
            commands::api_router_control::update_api_router_model_mapping,
            commands::api_router_control::update_api_router_model_mapping_status,
            commands::api_router_control::delete_api_router_model_mapping,
            commands::app_info::app_info,
            commands::desktop_kernel::desktop_kernel_info,
            commands::desktop_kernel::desktop_storage_info,
            commands::get_app_paths::get_app_paths,
            commands::get_app_config::get_app_config,
            commands::set_app_language::set_app_language,
            commands::get_system_info::get_system_info,
            commands::get_device_id::get_device_id,
            commands::storage_commands::storage_get_text,
            commands::storage_commands::storage_put_text,
            commands::storage_commands::storage_delete,
            commands::storage_commands::storage_list_keys,
            commands::job_commands::job_submit,
            commands::job_commands::job_submit_process,
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
            commands::run_hub_install::inspect_hub_install,
            commands::run_hub_install::run_hub_install,
            commands::run_hub_uninstall::run_hub_uninstall,
            commands::install_api_router_client_setup::install_api_router_client_setup,
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

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| FrameworkError::NotFound("main window".to_string()))?;

    let _ = window.unminimize();
    window.show()?;
    window.set_focus()?;
    Ok(())
}

pub(crate) fn should_prevent_main_window_close(shutdown_requested: bool) -> bool {
    !shutdown_requested
}

pub(crate) fn tray_action_for_menu_id(id: &str) -> Option<TrayAction> {
    match id {
        TRAY_MENU_ID_SHOW_WINDOW => Some(TrayAction::ShowWindow),
        TRAY_MENU_ID_OPEN_DASHBOARD => Some(TrayAction::OpenRoute(ROUTE_DASHBOARD)),
        TRAY_MENU_ID_OPEN_INSTALL => Some(TrayAction::OpenRoute(ROUTE_INSTALL)),
        TRAY_MENU_ID_OPEN_APPS => Some(TrayAction::OpenRoute(ROUTE_APPS)),
        TRAY_MENU_ID_OPEN_INSTANCES => Some(TrayAction::OpenRoute(ROUTE_INSTANCES)),
        TRAY_MENU_ID_OPEN_TASKS => Some(TrayAction::OpenRoute(ROUTE_TASKS)),
        TRAY_MENU_ID_OPEN_API_ROUTER => Some(TrayAction::OpenRoute(ROUTE_API_ROUTER)),
        TRAY_MENU_ID_OPEN_SETTINGS => Some(TrayAction::OpenRoute(ROUTE_SETTINGS)),
        TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY => {
            Some(TrayAction::RestartManagedService(SERVICE_ID_OPENCLAW_GATEWAY))
        }
        TRAY_MENU_ID_RESTART_WEB_SERVER => {
            Some(TrayAction::RestartManagedService(SERVICE_ID_WEB_SERVER))
        }
        TRAY_MENU_ID_RESTART_API_ROUTER => {
            Some(TrayAction::RestartManagedService(SERVICE_ID_API_ROUTER))
        }
        TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES => Some(TrayAction::RestartBackgroundServices),
        TRAY_MENU_ID_OPEN_LOGS_DIRECTORY => Some(TrayAction::OpenLogsDirectory),
        TRAY_MENU_ID_REVEAL_MAIN_LOG => Some(TrayAction::RevealMainLog),
        TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY => Some(TrayAction::OpenIntegrationsDirectory),
        TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY => Some(TrayAction::OpenPluginsDirectory),
        TRAY_MENU_ID_QUIT_APP => Some(TrayAction::QuitApp),
        _ => None,
    }
}

pub(crate) fn resolve_tray_language(
    configured_language: &str,
    system_locale: Option<&str>,
) -> TrayLanguage {
    match normalize_app_language_preference(configured_language) {
        APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE => TrayLanguage::Zh,
        APP_LANGUAGE_PREFERENCE_ENGLISH => TrayLanguage::En,
        _ => system_locale_to_tray_language(system_locale),
    }
}

#[cfg(test)]
pub(crate) fn build_tray_menu_spec(language: TrayLanguage) -> Vec<TrayMenuEntry> {
    let labels = tray_labels_for(language);

    vec![
        TrayMenuEntry::Item {
            id: TRAY_MENU_ID_SHOW_WINDOW,
            label: labels.open_window.to_string(),
        },
        TrayMenuEntry::Separator,
        TrayMenuEntry::Submenu {
            label: labels.navigate.to_string(),
            items: vec![
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_DASHBOARD,
                    label: labels.dashboard.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_INSTALL,
                    label: labels.install.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_APPS,
                    label: labels.apps.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_INSTANCES,
                    label: labels.instances.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_TASKS,
                    label: labels.tasks.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_API_ROUTER,
                    label: labels.api_router.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_SETTINGS,
                    label: labels.settings.to_string(),
                },
            ],
        },
        TrayMenuEntry::Submenu {
            label: labels.services.to_string(),
            items: vec![
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY,
                    label: labels.restart_openclaw_gateway.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_RESTART_WEB_SERVER,
                    label: labels.restart_web_server.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_RESTART_API_ROUTER,
                    label: labels.restart_api_router.to_string(),
                },
                TrayMenuEntry::Separator,
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
                    label: labels.restart_all_background_services.to_string(),
                },
            ],
        },
        TrayMenuEntry::Submenu {
            label: labels.diagnostics.to_string(),
            items: vec![
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_LOGS_DIRECTORY,
                    label: labels.open_logs_directory.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_REVEAL_MAIN_LOG,
                    label: labels.reveal_main_log.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY,
                    label: labels.open_integrations_directory.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY,
                    label: labels.open_plugins_directory.to_string(),
                },
            ],
        },
        TrayMenuEntry::Separator,
        TrayMenuEntry::Item {
            id: TRAY_MENU_ID_QUIT_APP,
            label: labels.quit_app.to_string(),
        },
    ]
}

fn create_tray<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| FrameworkError::Internal("default window icon is not available".to_string()))?;
    let menu = build_tray_menu(app, active_tray_language(app))?;

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .tooltip(app.package_info().name.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_tray_menu_event(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| handle_tray_icon_event(tray.app_handle(), event))
        .build(app)?;

    Ok(())
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let tray = app
        .tray_by_id(TRAY_ICON_ID)
        .ok_or_else(|| FrameworkError::NotFound("main tray".to_string()))?;
    let menu = build_tray_menu(app, active_tray_language(app))?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        let app = window.app_handle();
        let Some(state) = app.try_state::<AppState>() else {
            return;
        };

        if should_prevent_main_window_close(state.shutdown_intent.is_requested()) {
            api.prevent_close();
            if let Err(error) = window.hide() {
                log_runtime_error(&app, &format!("failed to hide main window: {error}"));
            }
        }
    }
}

fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: &str) {
    let Some(action) = tray_action_for_menu_id(menu_id) else {
        return;
    };

    match action {
        TrayAction::ShowWindow => {
            if let Err(error) = show_main_window(app) {
                log_runtime_error(app, &format!("failed to show main window from tray: {error}"));
            }
        }
        TrayAction::OpenRoute(route) => {
            if let Err(error) = open_route_from_tray(app, route) {
                log_runtime_error(app, &format!("failed to open route from tray: {error}"));
            }
        }
        TrayAction::RestartManagedService(service_id) => {
            if let Err(error) = restart_managed_service(app, service_id) {
                log_runtime_error(
                    app,
                    &format!("failed to restart managed service from tray: {error}"),
                );
            }
        }
        TrayAction::RestartBackgroundServices => {
            if let Err(error) = restart_background_services(app) {
                log_runtime_error(
                    app,
                    &format!("failed to restart background services from tray: {error}"),
                );
            }
        }
        TrayAction::OpenLogsDirectory => {
            if let Err(error) = open_logs_directory(app) {
                log_runtime_error(app, &format!("failed to open logs directory: {error}"));
            }
        }
        TrayAction::RevealMainLog => {
            if let Err(error) = reveal_main_log(app) {
                log_runtime_error(app, &format!("failed to reveal main log: {error}"));
            }
        }
        TrayAction::OpenIntegrationsDirectory => {
            if let Err(error) = open_integrations_directory(app) {
                log_runtime_error(
                    app,
                    &format!("failed to open integrations directory: {error}"),
                );
            }
        }
        TrayAction::OpenPluginsDirectory => {
            if let Err(error) = open_plugins_directory(app) {
                log_runtime_error(app, &format!("failed to open plugins directory: {error}"));
            }
        }
        TrayAction::QuitApp => request_explicit_quit(app.clone()),
    }
}

fn handle_tray_icon_event<R: Runtime>(app: &AppHandle<R>, event: TrayIconEvent) {
    if matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        }
    ) {
        if let Err(error) = show_main_window(app) {
            log_runtime_error(
                app,
                &format!("failed to restore main window from tray click: {error}"),
            );
        }
    }
}

fn restart_background_services<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    if state.shutdown_intent.is_requested() {
        return Err(FrameworkError::Conflict(
            "application shutdown has already been requested".to_string(),
        ));
    }

    let planned_services = state.context.services.supervisor.request_restart_all()?;
    state.context.logger.info(&format!(
        "tray requested background service restart plan: {}",
        planned_services.join(", ")
    ))?;

    if planned_services.iter().any(|service_id| service_id == SERVICE_ID_API_ROUTER) {
        restart_api_router_runtime(state.context.as_ref())?;
    }
    Ok(())
}

fn restart_managed_service<R: Runtime>(
    app: &AppHandle<R>,
    service_id: &'static str,
) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    if state.shutdown_intent.is_requested() {
        return Err(FrameworkError::Conflict(
            "application shutdown has already been requested".to_string(),
        ));
    }

    if service_id == SERVICE_ID_API_ROUTER {
        restart_api_router_runtime(state.context.as_ref())?;
        state
            .context
            .logger
            .info("tray requested managed service restart: api_router")?;
        return Ok(());
    }

    state.context.services.supervisor.request_restart(service_id)?;
    state
        .context
        .logger
        .info(&format!("tray requested managed service restart: {service_id}"))?;
    Ok(())
}

fn open_route_from_tray<R: Runtime>(app: &AppHandle<R>, route: &str) -> FrameworkResult<()> {
    show_main_window(app)?;

    let payload = TrayNavigatePayload {
        route: route.to_string(),
    };
    app.emit(events::TRAY_NAVIGATE, &payload)?;

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let route_literal = serde_json::to_string(route)?;
        let script = format!(
            "window.__CLAW_PENDING_TRAY_ROUTE__ = {route}; window.dispatchEvent(new CustomEvent('claw:tray-navigate', {{ detail: {{ route: {route} }} }}));",
            route = route_literal
        );
        window.eval(script.as_str())?;
    }

    Ok(())
}

fn open_logs_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener().open_path(
        state.paths.logs_dir.to_string_lossy().into_owned(),
        None::<&str>,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn reveal_main_log<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener()
        .reveal_item_in_dir(&state.paths.main_log_file)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn open_integrations_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener().open_path(
        state.paths.integrations_dir.to_string_lossy().into_owned(),
        None::<&str>,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn open_plugins_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener().open_path(
        state.paths.plugins_dir.to_string_lossy().into_owned(),
        None::<&str>,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn request_explicit_quit<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        if let Err(error) = perform_explicit_shutdown(&app) {
            log_runtime_error(&app, &format!("graceful shutdown encountered an error: {error}"));
        }
        app.exit(0);
    });
}

fn perform_explicit_shutdown<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    let first_request = state.shutdown_intent.request();
    if first_request {
        state
            .context
            .logger
            .info("explicit application shutdown requested from tray")?;
    }

    state.context.services.supervisor.begin_shutdown()?;

    if let Err(error) = state.context.services.api_router_runtime.stop_managed() {
        let _ = state.context.logger.warn(&format!(
            "failed to stop managed sdkwork-api-router children during shutdown: {error}"
        ));
    } else {
        let _ = state
            .context
            .services
            .supervisor
            .record_stopped(SERVICE_ID_API_ROUTER, None, None);
    }

    if let Err(error) = state.context.services.process.cancel_all() {
        let _ = state.context.logger.warn(&format!(
            "failed to terminate all active child processes during shutdown: {error}"
        ));
    }

    if let Err(error) = state.context.services.supervisor.complete_shutdown() {
        let _ = state.context.logger.warn(&format!(
            "failed to finalize supervisor shutdown state: {error}"
        ));
    }

    Ok(())
}

fn ensure_api_router_runtime(context: &FrameworkContext) -> FrameworkResult<()> {
    match context.services.api_router_runtime.ensure_started_or_attached() {
        Ok(snapshot) => {
            sync_api_router_supervisor(context, &snapshot)?;
            context.logger.info(&format!(
                "sdkwork-api-router runtime ready with ownership {:?}",
                snapshot.ownership
            ))?;
            Ok(())
        }
        Err(error) => {
            let _ = context.services.supervisor.record_stopped(
                SERVICE_ID_API_ROUTER,
                None,
                Some(error.to_string()),
            );
            Err(error)
        }
    }
}

fn restart_api_router_runtime(context: &FrameworkContext) -> FrameworkResult<()> {
    if let Err(error) = context.services.api_router_runtime.stop_managed() {
        let _ = context.logger.warn(&format!(
            "failed to stop managed sdkwork-api-router children before restart: {error}"
        ));
    }

    ensure_api_router_runtime(context)
}

fn sync_api_router_supervisor(
    context: &FrameworkContext,
    snapshot: &crate::framework::services::api_router_runtime::ApiRouterRuntimeSnapshot,
) -> FrameworkResult<()> {
    match snapshot.ownership {
        crate::framework::services::api_router_runtime::ApiRouterOwnershipMode::Attached => {
            context
                .services
                .supervisor
                .record_running(SERVICE_ID_API_ROUTER, None)
        }
        crate::framework::services::api_router_runtime::ApiRouterOwnershipMode::Managed => context
            .services
            .supervisor
            .record_running(SERVICE_ID_API_ROUTER, snapshot.gateway_pid.or(snapshot.admin_pid)),
        crate::framework::services::api_router_runtime::ApiRouterOwnershipMode::Stopped
        | crate::framework::services::api_router_runtime::ApiRouterOwnershipMode::Uninitialized => {
            context
                .services
                .supervisor
                .record_stopped(SERVICE_ID_API_ROUTER, None, None)
        }
    }
}

fn log_runtime_error<R: Runtime>(app: &AppHandle<R>, message: &str) {
    if let Some(state) = app.try_state::<AppState>() {
        let _ = state.context.logger.error(message);
    }
}

fn active_tray_language<R: Runtime>(app: &AppHandle<R>) -> TrayLanguage {
    let system_locale = sys_locale::get_locale();

    app.try_state::<AppState>()
        .map(|state| {
            let config = state.config_snapshot();
            resolve_tray_language(&config.language, system_locale.as_deref())
        })
        .unwrap_or_else(|| resolve_tray_language("system", system_locale.as_deref()))
}

fn system_locale_to_tray_language(locale: Option<&str>) -> TrayLanguage {
    let normalized = locale.unwrap_or_default().trim().to_lowercase().replace('_', "-");

    if normalized.starts_with("zh") {
        return TrayLanguage::Zh;
    }

    TrayLanguage::En
}

fn tray_labels_for(language: TrayLanguage) -> TrayLabels {
    match language {
        TrayLanguage::En => TrayLabels {
            open_window: "Open Window",
            navigate: "Navigate",
            dashboard: "Dashboard",
            install: "Install",
            apps: "Apps",
            instances: "Instances",
            tasks: "Tasks",
            api_router: "API-Router",
            settings: "Settings",
            services: "Services",
            restart_openclaw_gateway: "Restart OpenClaw Gateway",
            restart_web_server: "Restart Web Server",
            restart_api_router: "Restart API-Router",
            restart_all_background_services: "Restart All Background Services",
            diagnostics: "Diagnostics",
            open_logs_directory: "Open Logs Directory",
            reveal_main_log: "Reveal Main Log",
            open_integrations_directory: "Open Integrations Directory",
            open_plugins_directory: "Open Plugins Directory",
            quit_app: "Quit Claw Studio",
        },
        TrayLanguage::Zh => TrayLabels {
            open_window: "打开窗口",
            navigate: "导航",
            dashboard: "工作台",
            install: "安装",
            apps: "应用",
            instances: "实例",
            tasks: "任务",
            api_router: "API 路由",
            settings: "设置",
            services: "服务",
            restart_openclaw_gateway: "重启 OpenClaw Gateway",
            restart_web_server: "重启 Web Server",
            restart_api_router: "重启 API-Router",
            restart_all_background_services: "重启全部后台服务",
            diagnostics: "诊断",
            open_logs_directory: "打开日志目录",
            reveal_main_log: "定位主日志",
            open_integrations_directory: "打开集成目录",
            open_plugins_directory: "打开插件目录",
            quit_app: "退出 Claw Studio",
        },
    }
}

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    language: TrayLanguage,
) -> FrameworkResult<Menu<R>> {
    let labels = tray_labels_for(language);
    let open_menu = SubmenuBuilder::new(app, labels.navigate)
        .text(TRAY_MENU_ID_OPEN_DASHBOARD, labels.dashboard)
        .text(TRAY_MENU_ID_OPEN_INSTALL, labels.install)
        .text(TRAY_MENU_ID_OPEN_APPS, labels.apps)
        .text(TRAY_MENU_ID_OPEN_INSTANCES, labels.instances)
        .text(TRAY_MENU_ID_OPEN_TASKS, labels.tasks)
        .text(TRAY_MENU_ID_OPEN_API_ROUTER, labels.api_router)
        .text(TRAY_MENU_ID_OPEN_SETTINGS, labels.settings)
        .build()?;
    let services_menu = SubmenuBuilder::new(app, labels.services)
        .text(
            TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY,
            labels.restart_openclaw_gateway,
        )
        .text(TRAY_MENU_ID_RESTART_WEB_SERVER, labels.restart_web_server)
        .text(TRAY_MENU_ID_RESTART_API_ROUTER, labels.restart_api_router)
        .separator()
        .text(
            TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
            labels.restart_all_background_services,
        )
        .build()?;
    let diagnostics_menu = SubmenuBuilder::new(app, labels.diagnostics)
        .text(TRAY_MENU_ID_OPEN_LOGS_DIRECTORY, labels.open_logs_directory)
        .text(TRAY_MENU_ID_REVEAL_MAIN_LOG, labels.reveal_main_log)
        .text(
            TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY,
            labels.open_integrations_directory,
        )
        .text(TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY, labels.open_plugins_directory)
        .build()?;

    MenuBuilder::new(app)
        .text(TRAY_MENU_ID_SHOW_WINDOW, labels.open_window)
        .separator()
        .item(&open_menu)
        .item(&services_menu)
        .item(&diagnostics_menu)
        .separator()
        .text(TRAY_MENU_ID_QUIT_APP, labels.quit_app)
        .build()
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::{
        build_tray_menu_spec, resolve_tray_language, should_prevent_main_window_close,
        tray_action_for_menu_id, TrayAction, TrayLanguage, TrayMenuEntry, TRAY_MENU_ID_QUIT_APP,
        TRAY_MENU_ID_RESTART_API_ROUTER, TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
        TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY, TRAY_MENU_ID_RESTART_WEB_SERVER,
        TRAY_MENU_ID_SHOW_WINDOW,
    };

    #[test]
    fn close_request_is_intercepted_until_shutdown_is_requested() {
        assert!(should_prevent_main_window_close(false));
        assert!(!should_prevent_main_window_close(true));
    }

    #[test]
    fn tray_menu_promotes_open_window_to_the_first_level() {
        let spec = build_tray_menu_spec(TrayLanguage::En);

        assert_eq!(
            spec.first(),
            Some(&TrayMenuEntry::Item {
                id: TRAY_MENU_ID_SHOW_WINDOW,
                label: "Open Window".to_string(),
            })
        );
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, .. } if label == "Services"
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, items }
                    if label == "Services"
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY
                                    && label == "Restart OpenClaw Gateway"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_WEB_SERVER
                                    && label == "Restart Web Server"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_API_ROUTER
                                    && label == "Restart API-Router"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES
                                    && label == "Restart All Background Services"
                        ))
            )
        }));
    }

    #[test]
    fn tray_language_uses_explicit_preference_before_system_locale() {
        assert_eq!(resolve_tray_language("system", Some("zh-CN")), TrayLanguage::Zh);
        assert_eq!(resolve_tray_language("en", Some("zh-CN")), TrayLanguage::En);
    }

    #[test]
    fn tray_menu_labels_localize_to_simplified_chinese() {
        let spec = build_tray_menu_spec(TrayLanguage::Zh);

        assert_eq!(
            spec.first(),
            Some(&TrayMenuEntry::Item {
                id: TRAY_MENU_ID_SHOW_WINDOW,
                label: "打开窗口".to_string(),
            })
        );
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, .. } if label == "导航"
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, items }
                    if label == "服务"
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY
                                    && label == "重启 OpenClaw Gateway"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_WEB_SERVER
                                    && label == "重启 Web Server"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_API_ROUTER
                                    && label == "重启 API-Router"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES
                                    && label == "重启全部后台服务"
                        ))
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Item { id, label }
                    if *id == TRAY_MENU_ID_QUIT_APP && label == "退出 Claw Studio"
            )
        }));
    }

    #[test]
    fn tray_menu_ids_map_to_expected_actions() {
        assert_eq!(
            tray_action_for_menu_id(TRAY_MENU_ID_SHOW_WINDOW),
            Some(TrayAction::ShowWindow)
        );
        assert_eq!(
            tray_action_for_menu_id("open_dashboard"),
            Some(TrayAction::OpenRoute("/dashboard"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_install"),
            Some(TrayAction::OpenRoute("/install"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_apps"),
            Some(TrayAction::OpenRoute("/apps"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_instances"),
            Some(TrayAction::OpenRoute("/instances"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_tasks"),
            Some(TrayAction::OpenRoute("/tasks"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_api_router"),
            Some(TrayAction::OpenRoute("/api-router"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_settings"),
            Some(TrayAction::OpenRoute("/settings"))
        );
        assert_eq!(
            tray_action_for_menu_id("restart_openclaw_gateway"),
            Some(TrayAction::RestartManagedService("openclaw_gateway"))
        );
        assert_eq!(
            tray_action_for_menu_id("restart_web_server"),
            Some(TrayAction::RestartManagedService("web_server"))
        );
        assert_eq!(
            tray_action_for_menu_id("restart_api_router"),
            Some(TrayAction::RestartManagedService("api_router"))
        );
        assert_eq!(
            tray_action_for_menu_id(TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES),
            Some(TrayAction::RestartBackgroundServices)
        );
        assert_eq!(
            tray_action_for_menu_id("open_logs_directory"),
            Some(TrayAction::OpenLogsDirectory)
        );
        assert_eq!(
            tray_action_for_menu_id("reveal_main_log"),
            Some(TrayAction::RevealMainLog)
        );
        assert_eq!(
            tray_action_for_menu_id("open_integrations_directory"),
            Some(TrayAction::OpenIntegrationsDirectory)
        );
        assert_eq!(
            tray_action_for_menu_id("open_plugins_directory"),
            Some(TrayAction::OpenPluginsDirectory)
        );
        assert_eq!(
            tray_action_for_menu_id(TRAY_MENU_ID_QUIT_APP),
            Some(TrayAction::QuitApp)
        );
        assert_eq!(tray_action_for_menu_id("missing"), None);
    }
}
