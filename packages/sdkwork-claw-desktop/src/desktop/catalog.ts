export const DESKTOP_COMMANDS = {
  appInfo: 'app_info',
  appPaths: 'get_app_paths',
  appConfig: 'get_app_config',
  setAppLanguage: 'set_app_language',
  systemInfo: 'get_system_info',
  desktopComponentCatalog: 'desktop_component_catalog',
  desktopComponentControl: 'desktop_component_control',
  desktopKernelInfo: 'desktop_kernel_info',
  desktopStorageInfo: 'desktop_storage_info',
  storageGetText: 'storage_get_text',
  storagePutText: 'storage_put_text',
  storageDelete: 'storage_delete',
  storageListKeys: 'storage_list_keys',
  listDirectory: 'list_directory',
  pathExists: 'path_exists',
  getPathInfo: 'get_path_info',
  createDirectory: 'create_directory',
  removePath: 'remove_path',
  copyPath: 'copy_path',
  movePath: 'move_path',
  readBinaryFile: 'read_binary_file',
  writeBinaryFile: 'write_binary_file',
  readTextFile: 'read_text_file',
  writeTextFile: 'write_text_file',
  getDeviceId: 'get_device_id',
  jobSubmit: 'job_submit',
  jobSubmitProcess: 'job_submit_process',
  jobGet: 'job_get',
  jobList: 'job_list',
  jobCancel: 'job_cancel',
  inspectHubInstall: 'inspect_hub_install',
  runHubInstall: 'run_hub_install',
  runHubUninstall: 'run_hub_uninstall',
  installApiRouterClientSetup: 'install_api_router_client_setup',
  openExternal: 'open_external',
  selectFiles: 'select_files',
  saveBlobFile: 'save_blob_file',
} as const;

export type DesktopCommandName =
  (typeof DESKTOP_COMMANDS)[keyof typeof DESKTOP_COMMANDS];

export const DESKTOP_EVENTS = {
  appReady: 'app://ready',
  hubInstallProgress: 'hub-installer:progress',
  jobUpdated: 'job://updated',
  processOutput: 'process://output',
  trayNavigate: 'tray://navigate',
} as const;

export type DesktopEventName = (typeof DESKTOP_EVENTS)[keyof typeof DESKTOP_EVENTS];
