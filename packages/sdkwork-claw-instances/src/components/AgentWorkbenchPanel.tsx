import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Edit2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@sdkwork/claw-ui';
import type { AgentWorkbenchSnapshot } from '../services';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { AgentWorkbenchDetailSections } from './AgentWorkbenchDetailSections';
import {
  agentWorkbenchTabIds,
  buildAgentWorkbenchTabCounts,
  filterAgentWorkbenchAgents,
  type AgentWorkbenchTabId,
} from './agentWorkbenchPresentation.ts';

interface AgentWorkbenchPanelProps {
  workbench: InstanceWorkbenchSnapshot;
  snapshot: AgentWorkbenchSnapshot | null;
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (agentId: string) => void;
  onOpenAgentMarket: () => void;
  onCreateAgent: () => void;
  onEditAgent: (agent: InstanceWorkbenchSnapshot['agents'][number]) => void;
  onDeleteAgent: (agentId: string) => void;
  onInstallSkill: (slug: string) => void;
  onSetSkillEnabled: (skillKey: string, enabled: boolean) => void;
  onRemoveSkill: (skill: AgentWorkbenchSnapshot['skills'][number]) => void;
  onSaveSkillConfiguration?: (input: {
    skillKey: string;
    enabled: boolean;
    apiKey?: string;
    env?: Record<string, string>;
  }) => Promise<void> | void;
  isSavingSkillSelection?: boolean;
  onSaveSkillSelection?: (
    nextConfiguredSkillNames: string[] | null,
  ) => Promise<void> | void;
  onSaveFile: (
    file: AgentWorkbenchSnapshot['files'][number],
    content: string,
  ) => Promise<void> | void;
  isReadonly: boolean;
  isLoading: boolean;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
}

const tabLabelKeyMap: Record<AgentWorkbenchTabId, string> = {
  overview: 'instances.detail.instanceWorkbench.sidebar.overview',
  channels: 'instances.detail.instanceWorkbench.sections.channels.title',
  cronTasks: 'instances.detail.instanceWorkbench.sections.cronTasks.title',
  skills: 'instances.detail.instanceWorkbench.sections.skills.title',
  tools: 'instances.detail.instanceWorkbench.sections.tools.title',
  files: 'instances.detail.instanceWorkbench.sections.files.title',
};

function getBadgeTone(isActive: boolean) {
  return isActive
    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
    : 'border-zinc-200/70 bg-white/80 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300 dark:hover:bg-zinc-900';
}

export function AgentWorkbenchPanel({
  workbench,
  snapshot,
  selectedAgentId,
  onSelectedAgentIdChange,
  onOpenAgentMarket,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
  onInstallSkill,
  onSetSkillEnabled,
  onRemoveSkill,
  onSaveSkillConfiguration,
  isSavingSkillSelection = false,
  onSaveSkillSelection,
  onSaveFile,
  isReadonly,
  isLoading,
  isInstallingSkill,
  updatingSkillKeys,
  removingSkillKeys,
}: AgentWorkbenchPanelProps) {
  const { t } = useTranslation();
  const [agentQuery, setAgentQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AgentWorkbenchTabId>('overview');

  useEffect(() => {
    if (workbench.agents.length === 0) {
      return;
    }
    const hasSelected = selectedAgentId
      ? workbench.agents.some((agent) => agent.agent.id === selectedAgentId)
      : false;
    if (!hasSelected) {
      onSelectedAgentIdChange(workbench.agents[0]!.agent.id);
    }
  }, [onSelectedAgentIdChange, selectedAgentId, workbench.agents]);

  const filteredAgents = useMemo(
    () => filterAgentWorkbenchAgents(workbench.agents, agentQuery),
    [agentQuery, workbench.agents],
  );
  const selectedAgentRecord = useMemo(
    () =>
      workbench.agents.find((agent) => agent.agent.id === selectedAgentId) ||
      workbench.agents[0] ||
      null,
    [selectedAgentId, workbench.agents],
  );
  const tabCounts = useMemo(
    () => (snapshot ? buildAgentWorkbenchTabCounts(snapshot) : null),
    [snapshot],
  );

  if (workbench.agents.length === 0) {
    return (
      <div className="rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-400">
        {t('instances.detail.instanceWorkbench.empty.agents')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {t('instances.detail.instanceWorkbench.agents.panel.badge')}
              </span>
              {workbench.managedConfigPath ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  {t('instances.detail.instanceWorkbench.agents.panel.managedConfig')}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.panel.descriptionPrefix')}
              <span className="mx-1 font-mono text-xs">
                {t('instances.detail.instanceWorkbench.agents.panel.authProfilesFile')}
              </span>
              {t('instances.detail.instanceWorkbench.agents.panel.descriptionMiddle')}
              <span className="mx-1 font-mono text-xs">
                {t('instances.detail.instanceWorkbench.agents.panel.agentDirInline')}
              </span>
              {t('instances.detail.instanceWorkbench.agents.panel.descriptionSuffix')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={onOpenAgentMarket}
              disabled={isReadonly}
              className="rounded-2xl px-4 py-3"
            >
              <BriefcaseBusiness className="h-4 w-4" />
              {t('sidebar.agentMarket')}
            </Button>
            <Button onClick={onCreateAgent} disabled={isReadonly} className="rounded-2xl px-4 py-3">
              <Plus className="h-4 w-4" />
              {t('instances.detail.instanceWorkbench.agents.panel.newAgent')}
            </Button>
          </div>
        </div>
        {isReadonly ? (
          <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.agents.marketReadonlyNotice')}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[18.5rem_minmax(0,1fr)]">
        <aside
          data-slot="agent-workbench-sidebar"
          className="space-y-4 rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/35"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.sections.agents.title')}
              </div>
              <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {filteredAgents.length}/{workbench.agents.length}
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                value={agentQuery}
                onChange={(event) => setAgentQuery(event.target.value)}
                placeholder={`${t('common.search')} ${t('instances.detail.instanceWorkbench.sections.agents.title')}`}
                className="pl-9"
              />
            </div>
          </div>

          {filteredAgents.length > 0 ? (
            <div className="space-y-3">
              {filteredAgents.map((agentRecord) => {
                const isActive = agentRecord.agent.id === selectedAgentRecord?.agent.id;
                return (
                  <button
                    key={agentRecord.agent.id}
                    type="button"
                    onClick={() => onSelectedAgentIdChange(agentRecord.agent.id)}
                    className={`w-full rounded-[1.3rem] border px-4 py-4 text-left transition-colors ${getBadgeTone(isActive)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${isActive ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950' : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'}`}
                      >
                        {agentRecord.agent.avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold">
                            {agentRecord.agent.name}
                          </div>
                          {agentRecord.isDefault ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${isActive ? 'bg-white/14 text-white dark:bg-zinc-950/10 dark:text-zinc-950' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}
                            >
                              {t('instances.detail.instanceWorkbench.agents.panel.defaultBadge')}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`mt-1 truncate text-xs ${isActive ? 'text-white/75 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                          {agentRecord.model?.primary ||
                            t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                        </div>
                        <div
                          className={`mt-2 line-clamp-2 text-[11px] ${isActive ? 'text-white/70 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                          {agentRecord.focusAreas.join(' / ')}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.3rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
              {t('common.noResults')}
            </div>
          )}
        </aside>

        <div data-slot="agent-workbench-detail" className="space-y-5">
          {isLoading || !snapshot || !selectedAgentRecord ? (
            <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-400">
              {isLoading ? t('common.loading') : t('instances.detail.instanceWorkbench.empty.agents')}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800">
                <div className="scrollbar-hide flex min-w-0 flex-1 gap-2 overflow-x-auto">
                  {agentWorkbenchTabIds.map((tabId) => {
                    const isActive = activeTab === tabId;
                    const count = tabCounts?.[tabId];
                    return (
                      <button
                        key={tabId}
                        type="button"
                        onClick={() => setActiveTab(tabId)}
                        className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-left transition-colors ${getBadgeTone(isActive)}`}
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="text-sm font-semibold">
                            {t(tabLabelKeyMap[tabId])}
                          </div>
                          {typeof count === 'number' ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-white/14 text-white dark:bg-zinc-950/10 dark:text-zinc-950' : 'bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'}`}>
                              {count}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onEditAgent(selectedAgentRecord)}
                    disabled={isReadonly}
                    className="rounded-2xl px-3.5 py-2.5"
                  >
                    <Edit2 className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onDeleteAgent(snapshot.agent.agent.id)}
                    disabled={isReadonly}
                    className="rounded-2xl px-3.5 py-2.5 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </Button>
                </div>
              </div>

              <AgentWorkbenchDetailSections
                activeTab={activeTab}
                snapshot={snapshot}
                onInstallSkill={onInstallSkill}
                onSetSkillEnabled={onSetSkillEnabled}
                onRemoveSkill={onRemoveSkill}
                onSaveSkillConfiguration={onSaveSkillConfiguration}
                isSavingSkillSelection={isSavingSkillSelection}
                onSaveSkillSelection={onSaveSkillSelection}
                onSaveFile={onSaveFile}
                isReadonly={isReadonly}
                isInstallingSkill={isInstallingSkill}
                updatingSkillKeys={updatingSkillKeys}
                removingSkillKeys={removingSkillKeys}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
