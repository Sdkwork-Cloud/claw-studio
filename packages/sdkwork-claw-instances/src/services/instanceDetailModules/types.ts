import { createElement, lazy, type ComponentType } from 'react';
import type { KernelDetailModuleRegistration } from '@sdkwork/claw-core';
import type { InstanceDetailSource } from '../instanceDetailSource.ts';
import type { InstanceBaseDetail } from '../instanceBaseDetail.ts';
import type { InstanceDetailModulePayload } from '../instanceDetailModulePayload.ts';
import type { Instance } from '../../types/index.ts';

export type SupportedInstanceDetailModuleChrome = 'sharedWorkbench' | 'kernelOwned';

export interface InstanceDetailModulePayloadLoadContext {
  instance: Instance;
  loadBaseDetail: () => Promise<InstanceBaseDetail | null>;
}

export interface SupportedInstanceDetailModule {
  chrome: SupportedInstanceDetailModuleChrome;
  loadModulePayload: (
    instanceId: string,
    context: InstanceDetailModulePayloadLoadContext,
  ) => Promise<InstanceDetailModulePayload | null>;
  DetailPage: ComponentType<{ source: InstanceDetailSource }>;
}

export type SupportedInstanceDetailModuleRegistration =
  KernelDetailModuleRegistration<SupportedInstanceDetailModule>;

export function createLazyInstanceDetailModulePage(
  loader: () => Promise<{ default: ComponentType<{ source: InstanceDetailSource }> }>,
): ComponentType<{ source: InstanceDetailSource }> {
  const LazyInstanceDetailPage = lazy(loader);

  function RegisteredInstanceDetailModulePage({
    source,
  }: {
    source: InstanceDetailSource;
  }) {
    return createElement(LazyInstanceDetailPage, { source });
  }

  return RegisteredInstanceDetailModulePage;
}
