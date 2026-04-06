import type { ProviderConfigRecord } from './services/index.ts';

export type ProviderConfigCenterRowActionId = 'quickApply' | 'edit' | 'delete' | 'test';

export function listProviderConfigCenterRowActionIds(
  record: Pick<ProviderConfigRecord, 'managedBy'>,
): ProviderConfigCenterRowActionId[] {
  const actions: ProviderConfigCenterRowActionId[] = ['quickApply'];

  if (record.managedBy === 'user') {
    actions.push('edit', 'delete');
  }

  actions.push('test');
  return actions;
}
