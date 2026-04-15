import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@sdkwork/claw-ui';
import type { AgentWorkbenchSnapshot, OpenClawAgentFormState } from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { AgentWorkbenchPanel } from './AgentWorkbenchPanel.tsx';

type AgentModelOption = {
  value: string;
  label: string;
};

type AgentDialogFieldKey =
  | 'id'
  | 'name'
  | 'avatar'
  | 'primaryModel'
  | 'fallbackModelsText'
  | 'workspace'
  | 'agentDir'
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'timeoutMs';

export interface InstanceDetailAgentsSectionProps {
  workbench: InstanceWorkbenchSnapshot;
  snapshot: AgentWorkbenchSnapshot | null;
  errorMessage?: string | null;
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (agentId: string) => void;
  onOpenAgentMarket: () => void;
  onCreateAgent: () => void;
  onEditAgent: (agent: InstanceWorkbenchSnapshot['agents'][number]) => void;
  onRequestDeleteAgent: (agentId: string) => void;
  onInstallSkill: (slug: string) => void;
  onSetSkillEnabled: (skillKey: string, enabled: boolean) => void;
  onRemoveSkill: (skill: AgentWorkbenchSnapshot['skills'][number]) => void;
  isReadonly: boolean;
  isLoading: boolean;
  isFilesLoading: boolean;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
  onReload: () => Promise<void> | void;
  isAgentDialogOpen: boolean;
  editingAgentId: string | null;
  agentDialogDraft: OpenClawAgentFormState;
  availableAgentModelOptions: AgentModelOption[];
  isSavingAgentDialog: boolean;
  onAgentDialogOpenChange: (open: boolean) => void;
  onAgentDialogFieldChange: (field: AgentDialogFieldKey, value: string) => void;
  onAgentDialogDefaultChange: (checked: boolean) => void;
  onAgentDialogStreamingModeChange: (mode: OpenClawAgentFormState['streamingMode']) => void;
  onSaveAgentDialog: () => Promise<void> | void;
  agentDeleteId: string | null;
  onAgentDeleteDialogOpenChange: (open: boolean) => void;
  onDeleteAgentConfirm: () => Promise<void> | void;
}

function formatAgentConfigSource(
  source: 'agent' | 'defaults' | 'runtime',
  translate: (key: string) => string,
) {
  return translate(`instances.detail.instanceWorkbench.agents.modelSources.${source}`);
}

function formatAgentStreamingMode(
  mode: OpenClawAgentFormState['streamingMode'],
  translate: (key: string) => string,
) {
  if (mode === 'enabled') {
    return translate('instances.detail.instanceWorkbench.state.enabled');
  }
  if (mode === 'disabled') {
    return translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
  }
  return translate('instances.detail.instanceWorkbench.agents.panel.inheritDefaults');
}

function formatAgentStreamingValue(value: boolean, translate: (key: string) => string) {
  return value
    ? translate('instances.detail.instanceWorkbench.state.enabled')
    : translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
}

const INHERITED_CONFIG_SEPARATOR = ' / ';

export function InstanceDetailAgentsSection({
  workbench,
  snapshot,
  errorMessage,
  selectedAgentId,
  onSelectedAgentIdChange,
  onOpenAgentMarket,
  onCreateAgent,
  onEditAgent,
  onRequestDeleteAgent,
  onInstallSkill,
  onSetSkillEnabled,
  onRemoveSkill,
  isReadonly,
  isLoading,
  isFilesLoading,
  isInstallingSkill,
  updatingSkillKeys,
  removingSkillKeys,
  onReload,
  isAgentDialogOpen,
  editingAgentId,
  agentDialogDraft,
  availableAgentModelOptions,
  isSavingAgentDialog,
  onAgentDialogOpenChange,
  onAgentDialogFieldChange,
  onAgentDialogDefaultChange,
  onAgentDialogStreamingModeChange,
  onSaveAgentDialog,
  agentDeleteId,
  onAgentDeleteDialogOpenChange,
  onDeleteAgentConfirm,
}: InstanceDetailAgentsSectionProps) {
  const { t } = useTranslation();

  return (
    <div data-slot="instance-detail-agents-section" className="space-y-6">
      <AgentWorkbenchPanel
        workbench={workbench}
        snapshot={snapshot}
        errorMessage={errorMessage}
        selectedAgentId={selectedAgentId}
        onSelectedAgentIdChange={onSelectedAgentIdChange}
        onOpenAgentMarket={onOpenAgentMarket}
        onCreateAgent={onCreateAgent}
        onEditAgent={onEditAgent}
        onDeleteAgent={onRequestDeleteAgent}
        onInstallSkill={onInstallSkill}
        onSetSkillEnabled={onSetSkillEnabled}
        onRemoveSkill={onRemoveSkill}
        isReadonly={isReadonly}
        isLoading={isLoading}
        isFilesLoading={isFilesLoading}
        isInstallingSkill={isInstallingSkill}
        updatingSkillKeys={updatingSkillKeys}
        removingSkillKeys={removingSkillKeys}
        onReload={onReload}
      />

      <Dialog open={isAgentDialogOpen} onOpenChange={onAgentDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingAgentId
                ? t('instances.detail.instanceWorkbench.agents.dialog.titleEdit')
                : t('instances.detail.instanceWorkbench.agents.dialog.titleCreate')}
            </DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.agents.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.dialog.agentId')}
              </Label>
              <Input
                value={agentDialogDraft.id}
                onChange={(event) => onAgentDialogFieldChange('id', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.agentId')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.dialog.displayName')}
              </Label>
              <Input
                value={agentDialogDraft.name}
                onChange={(event) => onAgentDialogFieldChange('name', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.displayName')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.dialog.avatar')}
              </Label>
              <Input
                value={agentDialogDraft.avatar}
                onChange={(event) => onAgentDialogFieldChange('avatar', event.target.value)}
                placeholder="*"
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.panel.primaryModel')}
              </Label>
              <Select
                value={agentDialogDraft.primaryModel || '__inherit__'}
                onValueChange={(value) =>
                  onAgentDialogFieldChange('primaryModel', value === '__inherit__' ? '' : value)
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__inherit__">
                    {t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                  </SelectItem>
                  {availableAgentModelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agentDialogDraft.fieldSources.model === 'defaults' &&
              (agentDialogDraft.inherited.primaryModel ||
                agentDialogDraft.inherited.fallbackModelsText) ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatAgentConfigSource(agentDialogDraft.fieldSources.model, t)}
                  {INHERITED_CONFIG_SEPARATOR}
                  {agentDialogDraft.inherited.primaryModel || t('common.none')}
                </div>
              ) : null}
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.panel.fallbackModels')}
              </Label>
              <Textarea
                value={agentDialogDraft.fallbackModelsText}
                onChange={(event) =>
                  onAgentDialogFieldChange('fallbackModelsText', event.target.value)
                }
                placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.fallbackModels')}
                rows={4}
              />
              {agentDialogDraft.fieldSources.model === 'defaults' &&
              agentDialogDraft.inherited.fallbackModelsText ? (
                <div className="mt-2 whitespace-pre-line text-xs text-zinc-500 dark:text-zinc-400">
                  {formatAgentConfigSource(agentDialogDraft.fieldSources.model, t)}
                  {INHERITED_CONFIG_SEPARATOR}
                  {agentDialogDraft.inherited.fallbackModelsText}
                </div>
              ) : null}
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.dialog.workspace')}
              </Label>
              <Input
                value={agentDialogDraft.workspace}
                onChange={(event) => onAgentDialogFieldChange('workspace', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.workspace')}
              />
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.dialog.agentDir')}
              </Label>
              <Input
                value={agentDialogDraft.agentDir}
                onChange={(event) => onAgentDialogFieldChange('agentDir', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.agentDir')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.llmProviders.temperature')}
              </Label>
              <Input
                value={agentDialogDraft.temperature}
                onChange={(event) => onAgentDialogFieldChange('temperature', event.target.value)}
                placeholder={agentDialogDraft.inherited.temperature || '0.2'}
              />
              {agentDialogDraft.fieldSources.temperature === 'defaults' &&
              agentDialogDraft.inherited.temperature ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatAgentConfigSource(agentDialogDraft.fieldSources.temperature, t)}
                  {INHERITED_CONFIG_SEPARATOR}
                  {agentDialogDraft.inherited.temperature}
                </div>
              ) : null}
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.topP')}</Label>
              <Input
                value={agentDialogDraft.topP}
                onChange={(event) => onAgentDialogFieldChange('topP', event.target.value)}
                placeholder={agentDialogDraft.inherited.topP || '1'}
              />
              {agentDialogDraft.fieldSources.topP === 'defaults' &&
              agentDialogDraft.inherited.topP ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatAgentConfigSource(agentDialogDraft.fieldSources.topP, t)}
                  {INHERITED_CONFIG_SEPARATOR}
                  {agentDialogDraft.inherited.topP}
                </div>
              ) : null}
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.llmProviders.maxTokens')}
              </Label>
              <Input
                value={agentDialogDraft.maxTokens}
                onChange={(event) => onAgentDialogFieldChange('maxTokens', event.target.value)}
                placeholder={agentDialogDraft.inherited.maxTokens || '32000'}
              />
              {agentDialogDraft.fieldSources.maxTokens === 'defaults' &&
              agentDialogDraft.inherited.maxTokens ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatAgentConfigSource(agentDialogDraft.fieldSources.maxTokens, t)}
                  {INHERITED_CONFIG_SEPARATOR}
                  {agentDialogDraft.inherited.maxTokens}
                </div>
              ) : null}
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.llmProviders.timeoutMs')}
              </Label>
              <Input
                value={agentDialogDraft.timeoutMs}
                onChange={(event) => onAgentDialogFieldChange('timeoutMs', event.target.value)}
                placeholder={agentDialogDraft.inherited.timeoutMs || '60000'}
              />
              {agentDialogDraft.fieldSources.timeoutMs === 'defaults' &&
              agentDialogDraft.inherited.timeoutMs ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatAgentConfigSource(agentDialogDraft.fieldSources.timeoutMs, t)}
                  {INHERITED_CONFIG_SEPARATOR}
                  {agentDialogDraft.inherited.timeoutMs}
                </div>
              ) : null}
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
              <div>
                <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {t('instances.detail.instanceWorkbench.agents.dialog.defaultAgent')}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.dialog.defaultAgentDescription')}
                </div>
              </div>
              <Switch
                checked={agentDialogDraft.isDefault}
                onCheckedChange={onAgentDialogDefaultChange}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {t('instances.detail.instanceWorkbench.llmProviders.streaming')}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.dialog.streamingDescription')}
                </div>
                {agentDialogDraft.fieldSources.streaming === 'defaults' &&
                agentDialogDraft.inherited.streaming !== null ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.streaming, t)}
                    {INHERITED_CONFIG_SEPARATOR}
                    {formatAgentStreamingValue(agentDialogDraft.inherited.streaming, t)}
                  </div>
                ) : null}
              </div>
              <Select
                value={agentDialogDraft.streamingMode}
                onValueChange={(value) =>
                  onAgentDialogStreamingModeChange(
                    value as OpenClawAgentFormState['streamingMode'],
                  )
                }
              >
                <SelectTrigger className="w-[12rem] rounded-2xl">
                  <SelectValue>
                    {formatAgentStreamingMode(agentDialogDraft.streamingMode, t)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">
                    {t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                  </SelectItem>
                  <SelectItem value="enabled">
                    {t('instances.detail.instanceWorkbench.state.enabled')}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t('instances.detail.instanceWorkbench.agents.skillStates.disabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAgentDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void onSaveAgentDialog()} disabled={isSavingAgentDialog}>
              {isSavingAgentDialog ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(agentDeleteId)}
        onOpenChange={(open) => onAgentDeleteDialogOpenChange(open)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('instances.detail.instanceWorkbench.agents.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.agents.deleteDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAgentDeleteDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void onDeleteAgentConfirm()}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
