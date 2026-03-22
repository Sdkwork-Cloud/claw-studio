import {
  type RuntimeBundledComponentId,
  WebComponentPlatform,
  type RuntimeDesktopComponentCatalogInfo,
  type RuntimeDesktopComponentControlAction,
  type RuntimeDesktopComponentControlResult,
} from '@sdkwork/claw-infrastructure';
import { DESKTOP_COMMANDS } from './catalog';
import { invokeDesktopCommand, runDesktopOrFallback } from './runtime';

const webComponentPlatform = new WebComponentPlatform();

export interface DesktopComponentCatalogInfo extends RuntimeDesktopComponentCatalogInfo {}
export interface DesktopComponentControlResultInfo extends RuntimeDesktopComponentControlResult {}

export async function listDesktopComponents(): Promise<DesktopComponentCatalogInfo> {
  return runDesktopOrFallback(
    'components.list',
    () =>
      invokeDesktopCommand<DesktopComponentCatalogInfo>(
        DESKTOP_COMMANDS.desktopComponentCatalog,
        undefined,
        { operation: 'components.list' },
      ),
    () => webComponentPlatform.listComponents(),
  );
}

export async function controlDesktopComponent(
  componentId: RuntimeBundledComponentId,
  action: RuntimeDesktopComponentControlAction,
): Promise<DesktopComponentControlResultInfo> {
  return runDesktopOrFallback(
    `components.${action}`,
    () =>
      invokeDesktopCommand<DesktopComponentControlResultInfo>(
        DESKTOP_COMMANDS.desktopComponentControl,
        { componentId, action },
        { operation: `components.${action}` },
      ),
    () => webComponentPlatform.controlComponent({ componentId, action }),
  );
}

export async function startDesktopComponent(
  componentId: RuntimeBundledComponentId,
): Promise<DesktopComponentControlResultInfo> {
  return controlDesktopComponent(componentId, 'start');
}

export async function stopDesktopComponent(
  componentId: RuntimeBundledComponentId,
): Promise<DesktopComponentControlResultInfo> {
  return controlDesktopComponent(componentId, 'stop');
}

export async function restartDesktopComponent(
  componentId: RuntimeBundledComponentId,
): Promise<DesktopComponentControlResultInfo> {
  return controlDesktopComponent(componentId, 'restart');
}

export const desktopComponentsApi = {
  list: listDesktopComponents,
  control: controlDesktopComponent,
  start: startDesktopComponent,
  stop: stopDesktopComponent,
  restart: restartDesktopComponent,
};
