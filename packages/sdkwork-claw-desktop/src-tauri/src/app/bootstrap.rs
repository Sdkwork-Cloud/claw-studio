use crate::{
    commands,
    framework::{
        config::{
            normalize_app_language_preference, APP_LANGUAGE_PREFERENCE_ENGLISH,
            APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE,
        },
        context::FrameworkContext,
        events,
        services::api_router_runtime::ApiRouterRuntimeMode,
        services::openclaw_runtime::ActivatedOpenClawRuntime,
        services::studio::StudioInstanceStatus,
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
    Item {
        id: &'static str,
        label: String,
    },
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
            activate_bundled_openclaw(&app_handle, context.as_ref())?;
            inspect_api_router_runtime_on_startup(&app_handle, context.as_ref())?;
            context.logger.info("managed desktop state initialized")?;
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
            commands::app_info::app_info,
            commands::component_commands::desktop_component_catalog,
            commands::component_commands::desktop_component_control,
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
            commands::studio_commands::studio_list_instances,
            commands::studio_commands::studio_get_instance,
            commands::studio_commands::studio_get_instance_detail,
            commands::studio_commands::studio_create_instance,
            commands::studio_commands::studio_update_instance,
            commands::studio_commands::studio_delete_instance,
            commands::studio_commands::studio_start_instance,
            commands::studio_commands::studio_stop_instance,
            commands::studio_commands::studio_restart_instance,
            commands::studio_commands::studio_get_instance_config,
            commands::studio_commands::studio_update_instance_config,
            commands::studio_commands::studio_get_instance_logs,
            commands::studio_commands::studio_create_instance_task,
            commands::studio_commands::studio_update_instance_task,
            commands::studio_commands::studio_update_instance_file_content,
            commands::studio_commands::studio_update_instance_llm_provider_config,
            commands::studio_commands::studio_clone_instance_task,
            commands::studio_commands::studio_run_instance_task_now,
            commands::studio_commands::studio_list_instance_task_executions,
            commands::studio_commands::studio_update_instance_task_status,
            commands::studio_commands::studio_delete_instance_task,
            commands::studio_commands::studio_list_conversations,
            commands::studio_commands::studio_put_conversation,
            commands::studio_commands::studio_delete_conversation,
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
            commands::hub_install_catalog::list_hub_install_catalog,
            commands::run_hub_install::inspect_hub_install,
            commands::run_hub_install::run_hub_dependency_install,
            commands::run_hub_install::run_hub_install,
            commands::run_hub_uninstall::run_hub_uninstall,
            commands::install_api_router_client_setup::install_api_router_client_setup,
            commands::api_router_runtime::get_api_router_admin_bootstrap_session,
            commands::api_router_runtime::get_api_router_runtime_status,
            commands::read_binary_file::read_binary_file,
            commands::write_binary_file::write_binary_file,
            commands::open_external::open_external,
            commands::process_commands::process_run_capture,
            commands::select_files::select_files,
            commands::save_blob_file::save_blob_file,
            commands::fetch_remote_url::fetch_remote_url,
            commands::capture_screenshot::capture_screenshot,
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
        TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY => Some(TrayAction::RestartManagedService(
            SERVICE_ID_OPENCLAW_GATEWAY,
        )),
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
    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        FrameworkError::Internal("default window icon is not available".to_string())
    })?;
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
                log_runtime_error(
                    app,
                    &format!("failed to show main window from tray: {error}"),
                );
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

    state
        .context
        .services
        .supervisor
        .restart_openclaw_gateway(&state.paths)?;
    let mut planned_services = vec![SERVICE_ID_OPENCLAW_GATEWAY.to_string()];
    planned_services.push(SERVICE_ID_WEB_SERVER.to_string());
    state
        .context
        .services
        .supervisor
        .restart_web_server(&state.paths)?;
    if state
        .context
        .services
        .supervisor
        .configured_api_router_runtime()?
        .is_some()
    {
        state
            .context
            .services
            .supervisor
            .restart_api_router(&state.paths)?;
        planned_services.push(SERVICE_ID_API_ROUTER.to_string());
    }
    state.context.logger.info(&format!(
        "tray requested background service restart plan: {}",
        planned_services.join(", ")
    ))?;
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

    if service_id == SERVICE_ID_OPENCLAW_GATEWAY {
        state
            .context
            .services
            .supervisor
            .restart_openclaw_gateway(&state.paths)?;
    } else if service_id == SERVICE_ID_WEB_SERVER {
        state
            .context
            .services
            .supervisor
            .restart_web_server(&state.paths)?;
    } else if service_id == SERVICE_ID_API_ROUTER {
        state
            .context
            .services
            .supervisor
            .restart_api_router(&state.paths)?;
    } else {
        state
            .context
            .services
            .supervisor
            .request_restart(service_id)?;
    }
    state.context.logger.info(&format!(
        "tray requested managed service restart: {service_id}"
    ))?;
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
    app.opener()
        .open_path(
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
    app.opener()
        .open_path(
            state.paths.integrations_dir.to_string_lossy().into_owned(),
            None::<&str>,
        )
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn open_plugins_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener()
        .open_path(
            state.paths.plugins_dir.to_string_lossy().into_owned(),
            None::<&str>,
        )
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn request_explicit_quit<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        if let Err(error) = perform_explicit_shutdown(&app) {
            log_runtime_error(
                &app,
                &format!("graceful shutdown encountered an error: {error}"),
            );
        }
        app.exit(0);
    });
}

fn activate_bundled_openclaw<R: Runtime>(
    app: &AppHandle<R>,
    context: &FrameworkContext,
) -> FrameworkResult<()> {
    let runtime = context
        .services
        .openclaw_runtime
        .ensure_bundled_runtime(app, &context.paths)?;
    finalize_openclaw_activation(context, runtime)
}

fn finalize_openclaw_activation(
    context: &FrameworkContext,
    runtime: ActivatedOpenClawRuntime,
) -> FrameworkResult<()> {
    context
        .services
        .path_registration
        .install_openclaw_shims(&context.paths, &runtime)?;
    context
        .services
        .path_registration
        .ensure_user_bin_on_path(&context.paths)?;
    context
        .services
        .supervisor
        .configure_openclaw_gateway(&runtime)?;
    context
        .services
        .supervisor
        .start_openclaw_gateway(&context.paths)?;
    if let Err(error) = context.services.studio.set_instance_status(
        &context.paths,
        &context.config,
        &context.services.storage,
        "local-built-in",
        StudioInstanceStatus::Online,
    ) {
        let _ = context.logger.warn(&format!(
            "failed to mark built-in instance online during activation: {error}"
        ));
    }
    Ok(())
}

fn activate_bundled_api_router<R: Runtime>(
    app: &AppHandle<R>,
    context: &FrameworkContext,
) -> FrameworkResult<bool> {
    let runtime = match context
        .services
        .api_router_managed_runtime
        .ensure_bundled_runtime(app, &context.paths)
    {
        Ok(runtime) => runtime,
        Err(FrameworkError::NotFound(_)) => return Ok(false),
        Err(error) => return Err(error),
    };

    context
        .services
        .supervisor
        .configure_api_router_runtime(&runtime)?;
    context
        .services
        .supervisor
        .start_api_router(&context.paths)?;
    Ok(true)
}

fn resolve_api_router_runtime_status(
    context: &FrameworkContext,
) -> FrameworkResult<crate::framework::services::api_router_runtime::ApiRouterRuntimeStatus> {
    let managed_active = context
        .services
        .supervisor
        .is_service_running(SERVICE_ID_API_ROUTER)?;

    context
        .services
        .api_router_runtime
        .inspect(&context.paths)
        .map(|status| status.with_managed_active(managed_active))
}

fn inspect_api_router_runtime_on_startup<R: Runtime>(
    app: &AppHandle<R>,
    context: &FrameworkContext,
) -> FrameworkResult<()> {
    let status = resolve_api_router_runtime_status(context)?;
    let message = format!(
        "api router startup inspection: mode={} configSource={} adminBind={} gatewayBind={} reason={}",
        api_router_runtime_mode_label(&status.mode),
        api_router_config_source_label(&status.config_source),
        status.admin.bind_addr,
        status.gateway.bind_addr,
        status.reason,
    );
    let web_server_ready = if status.mode != ApiRouterRuntimeMode::Conflicted {
        if let Err(error) = context.services.supervisor.start_web_server(&context.paths) {
            context.logger.warn(&format!(
                "{message}; attempted built-in sdkwork-api-router web server start but it failed: {error}"
            ))?;
            false
        } else {
            true
        }
    } else {
        false
    };

    match status.mode {
        ApiRouterRuntimeMode::AttachedExternal => {
            context.logger.info(&message)?;
            if web_server_ready {
                log_api_router_public_endpoints(context, &status)?;
            }
        }
        ApiRouterRuntimeMode::ManagedActive => {
            context.logger.info(&message)?;
            if web_server_ready {
                log_api_router_public_endpoints(context, &status)?;
            }
        }
        ApiRouterRuntimeMode::NeedsManagedStart => match activate_bundled_api_router(app, context) {
            Ok(true) => {
                let managed_status = resolve_api_router_runtime_status(context)?;
                context.logger.info(&format!(
                    "api router managed startup activated: mode={} configSource={} adminBind={} gatewayBind={} reason={}",
                    api_router_runtime_mode_label(&managed_status.mode),
                    api_router_config_source_label(&managed_status.config_source),
                    managed_status.admin.bind_addr,
                    managed_status.gateway.bind_addr,
                    managed_status.reason,
                ))?;
                log_api_router_public_endpoints(context, &managed_status)?;
            }
            Ok(false) => context.logger.warn(&format!(
                "{message}; independent sdkwork-api-router was not detected, and no bundled managed runtime is available yet."
            ))?,
            Err(error) => context.logger.warn(&format!(
                "{message}; attempted bundled managed startup but it failed: {error}"
            ))?,
        },
        ApiRouterRuntimeMode::Conflicted => context.logger.warn(&message)?,
    }

    Ok(())
}

#[cfg(test)]
fn activate_bundled_openclaw_from_resource_root(
    context: &FrameworkContext,
    resource_root: &std::path::Path,
) -> FrameworkResult<()> {
    let runtime = context
        .services
        .openclaw_runtime
        .ensure_bundled_runtime_from_root(&context.paths, resource_root)?;
    finalize_openclaw_activation(context, runtime)
}

#[cfg(test)]
fn activate_bundled_api_router_from_resource_root(
    context: &FrameworkContext,
    resource_root: &std::path::Path,
) -> FrameworkResult<()> {
    let runtime = context
        .services
        .api_router_managed_runtime
        .ensure_bundled_runtime_from_root(&context.paths, resource_root)?;
    context
        .services
        .supervisor
        .configure_api_router_runtime(&runtime)?;
    context
        .services
        .supervisor
        .start_api_router(&context.paths)?;
    Ok(())
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
    let normalized = locale
        .unwrap_or_default()
        .trim()
        .to_lowercase()
        .replace('_', "-");

    if normalized.starts_with("zh") {
        return TrayLanguage::Zh;
    }

    TrayLanguage::En
}

fn api_router_runtime_mode_label(mode: &ApiRouterRuntimeMode) -> &'static str {
    match mode {
        ApiRouterRuntimeMode::AttachedExternal => "attached_external",
        ApiRouterRuntimeMode::ManagedActive => "managed_active",
        ApiRouterRuntimeMode::NeedsManagedStart => "needs_managed_start",
        ApiRouterRuntimeMode::Conflicted => "conflicted",
    }
}

fn api_router_config_source_label(
    source: &crate::framework::services::api_router_runtime::ApiRouterConfigSource,
) -> &'static str {
    match source {
        crate::framework::services::api_router_runtime::ApiRouterConfigSource::Defaults => {
            "defaults"
        }
        crate::framework::services::api_router_runtime::ApiRouterConfigSource::File => "file",
        crate::framework::services::api_router_runtime::ApiRouterConfigSource::Env => "env",
    }
}

fn api_router_public_endpoint_lines(
    status: &crate::framework::services::api_router_runtime::ApiRouterRuntimeStatus,
) -> Vec<String> {
    let mut lines = Vec::new();

    if let Some(gateway_base_url) = status.gateway.public_base_url.as_deref() {
        lines.push(format!(
            "sdkwork-api-router gateway API: {gateway_base_url}/v1/*"
        ));
    }

    if let Some(admin_api_url) = status.admin.public_base_url.as_deref() {
        lines.push(format!("sdkwork-api-router admin API: {admin_api_url}"));
    }

    if let Some(portal_api_url) = status.portal.public_base_url.as_deref() {
        lines.push(format!("sdkwork-api-router portal API: {portal_api_url}"));
    }

    if let Some(admin_site_url) = status.admin_site_base_url.as_deref() {
        lines.push(format!("sdkwork-api-router admin UI: {admin_site_url}"));
    }

    if let Some(portal_site_url) = status.portal_site_base_url.as_deref() {
        lines.push(format!("sdkwork-api-router portal UI: {portal_site_url}"));
    }

    lines
}

fn log_api_router_public_endpoints(
    context: &FrameworkContext,
    status: &crate::framework::services::api_router_runtime::ApiRouterRuntimeStatus,
) -> FrameworkResult<()> {
    for line in api_router_public_endpoint_lines(status) {
        println!("{line}");
        context.logger.info(&line)?;
    }

    Ok(())
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
            open_window: "\u{6253}\u{5f00}\u{7a97}\u{53e3}",
            navigate: "\u{5bfc}\u{822a}",
            dashboard: "\u{5de5}\u{4f5c}\u{53f0}",
            install: "\u{5b89}\u{88c5}",
            apps: "\u{5e94}\u{7528}",
            instances: "\u{5b9e}\u{4f8b}",
            tasks: "\u{4efb}\u{52a1}",
            api_router: "API \u{8def}\u{7531}",
            settings: "\u{8bbe}\u{7f6e}",
            services: "\u{670d}\u{52a1}",
            restart_openclaw_gateway: "\u{91cd}\u{542f} OpenClaw Gateway",
            restart_web_server: "\u{91cd}\u{542f} Web Server",
            restart_api_router: "\u{91cd}\u{542f} API-Router",
            restart_all_background_services:
                "\u{91cd}\u{542f}\u{5168}\u{90e8}\u{540e}\u{53f0}\u{670d}\u{52a1}",
            diagnostics: "\u{8bca}\u{65ad}",
            open_logs_directory: "\u{6253}\u{5f00}\u{65e5}\u{5fd7}\u{76ee}\u{5f55}",
            reveal_main_log: "\u{5b9a}\u{4f4d}\u{4e3b}\u{65e5}\u{5fd7}",
            open_integrations_directory: "\u{6253}\u{5f00}\u{96c6}\u{6210}\u{76ee}\u{5f55}",
            open_plugins_directory: "\u{6253}\u{5f00}\u{63d2}\u{4ef6}\u{76ee}\u{5f55}",
            quit_app: "\u{9000}\u{51fa} Claw Studio",
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
        .text(
            TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY,
            labels.open_plugins_directory,
        )
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
        activate_bundled_api_router_from_resource_root,
        activate_bundled_openclaw_from_resource_root, build_tray_menu_spec,
        api_router_public_endpoint_lines, resolve_api_router_runtime_status, resolve_tray_language, should_prevent_main_window_close,
        tray_action_for_menu_id, TrayAction, TrayLanguage, TrayMenuEntry, TRAY_MENU_ID_QUIT_APP,
        TRAY_MENU_ID_RESTART_API_ROUTER, TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
        TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY, TRAY_MENU_ID_RESTART_WEB_SERVER,
        TRAY_MENU_ID_SHOW_WINDOW,
    };
    use crate::framework::{
        config::AppConfig,
        context::FrameworkContext,
        layout::ActiveState,
        logging::init_logger,
        paths::resolve_paths_for_root,
        services::{
            api_router_managed_runtime::BundledApiRouterManifest,
            api_router_runtime::ApiRouterRuntimeMode,
            openclaw_runtime::BundledOpenClawManifest,
            supervisor::{
                ManagedServiceLifecycle, SERVICE_ID_API_ROUTER, SERVICE_ID_OPENCLAW_GATEWAY,
            },
        },
    };
    use std::fs;

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
        assert_eq!(
            resolve_tray_language("system", Some("zh-CN")),
            TrayLanguage::Zh
        );
        assert_eq!(resolve_tray_language("en", Some("zh-CN")), TrayLanguage::En);
    }

    #[test]
    fn tray_menu_labels_localize_to_simplified_chinese() {
        let spec = build_tray_menu_spec(TrayLanguage::Zh);

        assert_eq!(
            spec.first(),
            Some(&TrayMenuEntry::Item {
                id: TRAY_MENU_ID_SHOW_WINDOW,
                label: "\u{6253}\u{5f00}\u{7a97}\u{53e3}".to_string(),
            })
        );
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, .. } if label == "\u{5bfc}\u{822a}"
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, items }
                    if label == "\u{670d}\u{52a1}"
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY
                                    && label == "\u{91cd}\u{542f} OpenClaw Gateway"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_WEB_SERVER
                                    && label == "\u{91cd}\u{542f} Web Server"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_API_ROUTER
                                    && label == "\u{91cd}\u{542f} API-Router"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES
                                    && label
                                        == "\u{91cd}\u{542f}\u{5168}\u{90e8}\u{540e}\u{53f0}\u{670d}\u{52a1}"
                        ))
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Item { id, label }
                    if *id == TRAY_MENU_ID_QUIT_APP
                        && label == "\u{9000}\u{51fa} Claw Studio"
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

    #[test]
    fn bundled_openclaw_activation_installs_runtime_shims_and_starts_gateway() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths.clone(), AppConfig::default(), logger);
        let resource_root = create_bundled_gateway_fixture(root.path());

        activate_bundled_openclaw_from_resource_root(&context, &resource_root)
            .expect("activate bundled openclaw");

        assert!(paths.user_bin_dir.join("openclaw.cmd").exists());
        assert!(paths.user_bin_dir.join("openclaw.ps1").exists());
        assert!(paths.user_bin_dir.join("openclaw").exists());

        let active = serde_json::from_str::<ActiveState>(
            &fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        assert_eq!(
            active
                .runtimes
                .get("openclaw")
                .and_then(|entry| entry.active_version.as_deref()),
            Some(
                format!(
                    "2026.3.13-{}-{}",
                    normalized_openclaw_platform(),
                    normalized_openclaw_arch()
                )
                .as_str()
            )
        );

        let snapshot = context.services.supervisor.snapshot().expect("snapshot");
        let openclaw = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Running);
        assert!(openclaw.pid.is_some());

        context
            .services
            .supervisor
            .begin_shutdown()
            .expect("shutdown");
        context
            .services
            .supervisor
            .complete_shutdown()
            .expect("complete shutdown");
    }

    #[test]
    fn bundled_api_router_activation_starts_managed_process_group_and_reports_managed_active() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths.clone(), AppConfig::default(), logger);
        let resource_root = create_bundled_api_router_fixture(root.path());

        activate_bundled_api_router_from_resource_root(&context, &resource_root)
            .expect("activate bundled api router");

        let snapshot = context.services.supervisor.snapshot().expect("snapshot");
        let api_router = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_API_ROUTER)
            .expect("api router service");
        assert_eq!(api_router.lifecycle, ManagedServiceLifecycle::Running);
        assert!(api_router.pid.is_some());

        let status = resolve_api_router_runtime_status(&context).expect("runtime status");
        assert_eq!(status.mode, ApiRouterRuntimeMode::ManagedActive);
        assert!(status.admin.healthy);
        assert!(status.gateway.healthy);

        context
            .services
            .supervisor
            .begin_shutdown()
            .expect("shutdown");
        context
            .services
            .supervisor
            .complete_shutdown()
            .expect("complete shutdown");
    }

    #[test]
    fn api_router_public_endpoint_lines_surface_single_port_admin_portal_and_api_urls() {
        let status = crate::framework::services::api_router_runtime::ApiRouterRuntimeStatus {
            mode: ApiRouterRuntimeMode::ManagedActive,
            recommended_managed_mode: None,
            shared_root_dir: "C:/Users/admin/.sdkwork/router".to_string(),
            config_dir: "C:/Users/admin/.sdkwork/router".to_string(),
            config_source: crate::framework::services::api_router_runtime::ApiRouterConfigSource::Defaults,
            resolved_config_file: Some("C:/Users/admin/.sdkwork/router/config.json".to_string()),
            admin: crate::framework::services::api_router_runtime::ApiRouterEndpointRuntimeStatus {
                bind_addr: "127.0.0.1:12101".to_string(),
                health_url: "http://127.0.0.1:12101/admin/health".to_string(),
                enabled: true,
                public_base_url: Some("http://127.0.0.1:12103/api/admin".to_string()),
                healthy: true,
                port_available: false,
            },
            portal: crate::framework::services::api_router_runtime::ApiRouterEndpointRuntimeStatus {
                bind_addr: "127.0.0.1:12102".to_string(),
                health_url: "http://127.0.0.1:12102/portal/health".to_string(),
                enabled: true,
                public_base_url: Some("http://127.0.0.1:12103/api/portal".to_string()),
                healthy: true,
                port_available: false,
            },
            gateway: crate::framework::services::api_router_runtime::ApiRouterEndpointRuntimeStatus {
                bind_addr: "127.0.0.1:12100".to_string(),
                health_url: "http://127.0.0.1:12100/health".to_string(),
                enabled: true,
                public_base_url: Some("http://127.0.0.1:12103/api".to_string()),
                healthy: true,
                port_available: false,
            },
            admin_site_base_url: Some("http://127.0.0.1:12103/admin".to_string()),
            portal_site_base_url: Some("http://127.0.0.1:12103/portal".to_string()),
            reason: "Claw Studio is managing the sdkwork-api-router runtime for this session."
                .to_string(),
        };

        let lines = api_router_public_endpoint_lines(&status);

        assert!(lines.iter().any(|line| line.contains("http://127.0.0.1:12103/api/v1/*")));
        assert!(lines.iter().any(|line| line.contains("http://127.0.0.1:12103/api/admin")));
        assert!(lines.iter().any(|line| line.contains("http://127.0.0.1:12103/api/portal")));
        assert!(lines.iter().any(|line| line.contains("http://127.0.0.1:12103/admin")));
        assert!(lines.iter().any(|line| line.contains("http://127.0.0.1:12103/portal")));
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|paths| std::env::split_paths(&paths).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for bundled gateway tests")
    }

    #[cfg(windows)]
    fn create_bundled_gateway_fixture(root: &std::path::Path) -> std::path::PathBuf {
        let resource_root = root.join("bundled-openclaw");
        let runtime_root = resource_root.join("runtime");
        let cli_path = runtime_root.join("package").join("openclaw.mjs");
        let node_path = resolve_test_node_executable();

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &cli_path,
            "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst port = config?.gateway?.port ?? 18789;\nconst server = net.createServer();\nserver.listen(port, '127.0.0.1');\nsetInterval(() => {}, 1000);\n",
        )
        .expect("cli file");

        let manifest = BundledOpenClawManifest {
            schema_version: 1,
            runtime_id: "openclaw".to_string(),
            openclaw_version: "2026.3.13".to_string(),
            node_version: "22.16.0".to_string(),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            node_relative_path: node_path.to_string_lossy().into_owned(),
            cli_relative_path: "runtime/package/openclaw.mjs".to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");

        resource_root
    }

    #[cfg(not(windows))]
    fn create_bundled_gateway_fixture(root: &std::path::Path) -> std::path::PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let resource_root = root.join("bundled-openclaw");
        let runtime_root = resource_root.join("runtime");
        let node_path = runtime_root.join("node").join("node");
        let cli_path = runtime_root.join("package").join("openclaw.mjs");

        fs::create_dir_all(node_path.parent().expect("node parent")).expect("node dir");
        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&node_path, "#!/bin/sh\nexec node \"$@\"\n").expect("node shim");
        let mut permissions = fs::metadata(&node_path)
            .expect("node metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&node_path, permissions).expect("node permissions");
        fs::write(
            &cli_path,
            "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst port = config?.gateway?.port ?? 18789;\nconst server = net.createServer();\nserver.listen(port, '127.0.0.1');\nsetInterval(() => {}, 1000);\n",
        )
        .expect("cli file");

        let manifest = BundledOpenClawManifest {
            schema_version: 1,
            runtime_id: "openclaw".to_string(),
            openclaw_version: "2026.3.13".to_string(),
            node_version: "22.16.0".to_string(),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            node_relative_path: "runtime/node/node".to_string(),
            cli_relative_path: "runtime/package/openclaw.mjs".to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");

        resource_root
    }

    #[cfg(windows)]
    fn create_bundled_api_router_fixture(root: &std::path::Path) -> std::path::PathBuf {
        let resource_root = root.join("bundled-api-router");
        let runtime_root = resource_root.join("runtime");
        let gateway_cmd_path = runtime_root.join("gateway-service.cmd");
        let admin_cmd_path = runtime_root.join("admin-api-service.cmd");
        let portal_cmd_path = runtime_root.join("portal-api-service.cmd");
        let gateway_script_path = runtime_root.join("gateway-service.mjs");
        let admin_script_path = runtime_root.join("admin-api-service.mjs");
        let portal_script_path = runtime_root.join("portal-api-service.mjs");
        let admin_site_index_path = runtime_root.join("sites").join("admin").join("index.html");
        let portal_site_index_path = runtime_root.join("sites").join("portal").join("index.html");
        let router_root = root.join("router");

        fs::create_dir_all(gateway_cmd_path.parent().expect("gateway parent"))
            .expect("gateway dir");
        fs::create_dir_all(admin_cmd_path.parent().expect("admin parent")).expect("admin dir");
        fs::create_dir_all(portal_cmd_path.parent().expect("portal parent")).expect("portal dir");
        fs::create_dir_all(admin_site_index_path.parent().expect("admin site parent"))
            .expect("admin site dir");
        fs::create_dir_all(portal_site_index_path.parent().expect("portal site parent"))
            .expect("portal site dir");
        fs::create_dir_all(&router_root).expect("router root");
        fs::write(
            &gateway_script_path,
            "import net from 'node:net';\nconst root = process.env.SDKWORK_CONFIG_DIR;\nconst fs = await import('node:fs');\nconst config = JSON.parse(fs.readFileSync(`${root}/config.json`, 'utf8'));\nconst bind = config.gateway_bind ?? '127.0.0.1:12100';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {\n  socket.once('data', (chunk) => {\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${status}\\r\\nContent-Length: ${body.length}\\r\\nConnection: close\\r\\n\\r\\n${body}`);\n  });\n});\nserver.listen(Number(port), host);\nsetInterval(() => {}, 1000);\n",
        )
        .expect("gateway script");
        fs::write(
            &admin_script_path,
            "import net from 'node:net';\nconst root = process.env.SDKWORK_CONFIG_DIR;\nconst fs = await import('node:fs');\nconst config = JSON.parse(fs.readFileSync(`${root}/config.json`, 'utf8'));\nconst bind = config.admin_bind ?? '127.0.0.1:12101';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {\n  socket.once('data', (chunk) => {\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /admin/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${status}\\r\\nContent-Length: ${body.length}\\r\\nConnection: close\\r\\n\\r\\n${body}`);\n  });\n});\nserver.listen(Number(port), host);\nsetInterval(() => {}, 1000);\n",
        )
        .expect("admin script");
        fs::write(
            &portal_script_path,
            "import net from 'node:net';\nconst root = process.env.SDKWORK_CONFIG_DIR;\nconst fs = await import('node:fs');\nconst config = JSON.parse(fs.readFileSync(`${root}/config.json`, 'utf8'));\nconst bind = config.portal_bind ?? '127.0.0.1:12102';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {\n  socket.once('data', (chunk) => {\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /portal/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${status}\\r\\nContent-Length: ${body.length}\\r\\nConnection: close\\r\\n\\r\\n${body}`);\n  });\n});\nserver.listen(Number(port), host);\nsetInterval(() => {}, 1000);\n",
        )
        .expect("portal script");
        fs::write(
            &gateway_cmd_path,
            "@echo off\r\nnode \"%~dp0gateway-service.mjs\"\r\n",
        )
        .expect("gateway cmd");
        fs::write(
            &admin_cmd_path,
            "@echo off\r\nnode \"%~dp0admin-api-service.mjs\"\r\n",
        )
        .expect("admin cmd");
        fs::write(
            &portal_cmd_path,
            "@echo off\r\nnode \"%~dp0portal-api-service.mjs\"\r\n",
        )
        .expect("portal cmd");
        fs::write(&admin_site_index_path, "<!doctype html><title>admin</title>")
            .expect("admin site");
        fs::write(&portal_site_index_path, "<!doctype html><title>portal</title>")
            .expect("portal site");
        fs::write(
            router_root.join("config.json"),
            "{\"gateway_bind\":\"127.0.0.1:29080\",\"admin_bind\":\"127.0.0.1:29081\",\"portal_bind\":\"127.0.0.1:29082\",\"web_bind\":\"127.0.0.1:29083\"}\n",
        )
        .expect("router config");

        let manifest = BundledApiRouterManifest {
            schema_version: 1,
            runtime_id: "sdkwork-api-router".to_string(),
            router_version: "2026.3.20".to_string(),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            gateway_relative_path: "runtime/gateway-service.cmd".to_string(),
            admin_relative_path: "runtime/admin-api-service.cmd".to_string(),
            portal_relative_path: "runtime/portal-api-service.cmd".to_string(),
        };
        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest");
        resource_root
    }

    #[cfg(not(windows))]
    fn create_bundled_api_router_fixture(root: &std::path::Path) -> std::path::PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let resource_root = root.join("bundled-api-router");
        let runtime_root = resource_root.join("runtime");
        let gateway_path = runtime_root.join("gateway-service");
        let admin_path = runtime_root.join("admin-api-service");
        let portal_path = runtime_root.join("portal-api-service");
        let admin_site_index_path = runtime_root.join("sites").join("admin").join("index.html");
        let portal_site_index_path = runtime_root.join("sites").join("portal").join("index.html");
        let router_root = root.join("router");

        fs::create_dir_all(gateway_path.parent().expect("gateway parent")).expect("gateway dir");
        fs::create_dir_all(admin_path.parent().expect("admin parent")).expect("admin dir");
        fs::create_dir_all(portal_path.parent().expect("portal parent")).expect("portal dir");
        fs::create_dir_all(admin_site_index_path.parent().expect("admin site parent"))
            .expect("admin site dir");
        fs::create_dir_all(portal_site_index_path.parent().expect("portal site parent"))
            .expect("portal site dir");
        fs::create_dir_all(&router_root).expect("router root");
        fs::write(
            &gateway_path,
            "#!/bin/sh\nexec node \"$(dirname \"$0\")/gateway-service.mjs\"\n",
        )
        .expect("gateway shim");
        fs::write(
            &admin_path,
            "#!/bin/sh\nexec node \"$(dirname \"$0\")/admin-api-service.mjs\"\n",
        )
        .expect("admin shim");
        fs::write(
            &portal_path,
            "#!/bin/sh\nexec node \"$(dirname \"$0\")/portal-api-service.mjs\"\n",
        )
        .expect("portal shim");
        let mut gateway_permissions = fs::metadata(&gateway_path)
            .expect("gateway metadata")
            .permissions();
        gateway_permissions.set_mode(0o755);
        fs::set_permissions(&gateway_path, gateway_permissions).expect("gateway permissions");
        let mut admin_permissions = fs::metadata(&admin_path)
            .expect("admin metadata")
            .permissions();
        admin_permissions.set_mode(0o755);
        fs::set_permissions(&admin_path, admin_permissions).expect("admin permissions");
        let mut portal_permissions = fs::metadata(&portal_path)
            .expect("portal metadata")
            .permissions();
        portal_permissions.set_mode(0o755);
        fs::set_permissions(&portal_path, portal_permissions).expect("portal permissions");
        fs::write(
            runtime_root.join("gateway-service.mjs"),
            "import fs from 'node:fs';\nimport net from 'node:net';\nconst root = process.env.SDKWORK_CONFIG_DIR;\nconst config = JSON.parse(fs.readFileSync(`${root}/config.json`, 'utf8'));\nconst bind = config.gateway_bind ?? '127.0.0.1:12100';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {\n  socket.once('data', (chunk) => {\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${status}\\r\\nContent-Length: ${body.length}\\r\\nConnection: close\\r\\n\\r\\n${body}`);\n  });\n});\nserver.listen(Number(port), host);\nsetInterval(() => {}, 1000);\n",
        )
        .expect("gateway script");
        fs::write(
            runtime_root.join("admin-api-service.mjs"),
            "import fs from 'node:fs';\nimport net from 'node:net';\nconst root = process.env.SDKWORK_CONFIG_DIR;\nconst config = JSON.parse(fs.readFileSync(`${root}/config.json`, 'utf8'));\nconst bind = config.admin_bind ?? '127.0.0.1:12101';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {\n  socket.once('data', (chunk) => {\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /admin/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${status}\\r\\nContent-Length: ${body.length}\\r\\nConnection: close\\r\\n\\r\\n${body}`);\n  });\n});\nserver.listen(Number(port), host);\nsetInterval(() => {}, 1000);\n",
        )
        .expect("admin script");
        fs::write(
            runtime_root.join("portal-api-service.mjs"),
            "import fs from 'node:fs';\nimport net from 'node:net';\nconst root = process.env.SDKWORK_CONFIG_DIR;\nconst config = JSON.parse(fs.readFileSync(`${root}/config.json`, 'utf8'));\nconst bind = config.portal_bind ?? '127.0.0.1:12102';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {\n  socket.once('data', (chunk) => {\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /portal/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${status}\\r\\nContent-Length: ${body.length}\\r\\nConnection: close\\r\\n\\r\\n${body}`);\n  });\n});\nserver.listen(Number(port), host);\nsetInterval(() => {}, 1000);\n",
        )
        .expect("portal script");
        fs::write(&admin_site_index_path, "<!doctype html><title>admin</title>")
            .expect("admin site");
        fs::write(&portal_site_index_path, "<!doctype html><title>portal</title>")
            .expect("portal site");

        let manifest = BundledApiRouterManifest {
            schema_version: 1,
            runtime_id: "sdkwork-api-router".to_string(),
            router_version: "2026.3.20".to_string(),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            gateway_relative_path: "runtime/gateway-service".to_string(),
            admin_relative_path: "runtime/admin-api-service".to_string(),
            portal_relative_path: "runtime/portal-api-service".to_string(),
        };
        fs::write(
            router_root.join("config.json"),
            "{\"gateway_bind\":\"127.0.0.1:29080\",\"admin_bind\":\"127.0.0.1:29081\",\"portal_bind\":\"127.0.0.1:29082\",\"web_bind\":\"127.0.0.1:29083\"}\n",
        )
        .expect("router config");

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest");

        resource_root
    }

    fn normalized_openclaw_platform() -> &'static str {
        match crate::platform::current_target() {
            "windows" => "windows",
            "macos" => "macos",
            "linux" => "linux",
            other => other,
        }
    }

    fn normalized_openclaw_arch() -> &'static str {
        match crate::platform::current_arch() {
            "x86_64" => "x64",
            "aarch64" => "arm64",
            other => other,
        }
    }
}
