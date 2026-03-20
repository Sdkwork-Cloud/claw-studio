import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Database,
  FileText,
  FolderOpen,
  Link2,
  ShieldAlert,
} from 'lucide-react';
import type {
  HubInstallAssessmentDataItem,
  HubInstallAssessmentInstallation,
  HubInstallAssessmentInstallationDirectory,
  HubInstallAssessmentMigrationStrategy,
  HubInstallAssessmentResult,
} from '@sdkwork/claw-infrastructure';
import { platform } from '@sdkwork/claw-infrastructure';
import { useTranslation } from 'react-i18next';

type Variant = 'compact' | 'full';
type DirectoryKey = 'installRoot' | 'workRoot' | 'binDir' | 'dataRoot' | 'additional';

interface HubInstallDescriptorSummaryProps {
  assessment: HubInstallAssessmentResult;
  variant?: Variant;
}

function humanizeToken(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function collectDirectories(installation?: HubInstallAssessmentInstallation | null) {
  const directories = installation?.directories;
  if (!directories) {
    return [] as Array<{ key: DirectoryKey; directory: HubInstallAssessmentInstallationDirectory }>;
  }

  const items: Array<{ key: DirectoryKey; directory: HubInstallAssessmentInstallationDirectory }> = [];
  if (directories.installRoot) {
    items.push({ key: 'installRoot', directory: directories.installRoot });
  }
  if (directories.workRoot) {
    items.push({ key: 'workRoot', directory: directories.workRoot });
  }
  if (directories.binDir) {
    items.push({ key: 'binDir', directory: directories.binDir });
  }
  if (directories.dataRoot) {
    items.push({ key: 'dataRoot', directory: directories.dataRoot });
  }
  directories.additional.forEach((directory) => {
    items.push({ key: 'additional', directory });
  });

  return items;
}

function getDirectoryTitle(
  t: ReturnType<typeof useTranslation>['t'],
  key: DirectoryKey,
  directory: HubInstallAssessmentInstallationDirectory,
) {
  if (key === 'additional') {
    return directory.id
      ? humanizeToken(directory.id)
      : t('install.page.assessment.installation.directoryKinds.additional');
  }

  return t(`install.page.assessment.installation.directoryKinds.${key}`);
}

function getSupportTone(supported?: boolean | null) {
  if (supported === true) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (supported === false) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getPolicyTone(policy: HubInstallAssessmentDataItem['uninstallByDefault']) {
  if (policy === 'preserve') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (policy === 'manual') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
}

function getMigrationModeTone(mode: HubInstallAssessmentMigrationStrategy['mode']) {
  if (mode === 'command') {
    return 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300';
  }
  if (mode === 'manual') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export function HubInstallDescriptorSummary({
  assessment,
  variant = 'full',
}: HubInstallDescriptorSummaryProps) {
  const { t } = useTranslation();
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const directories = collectDirectories(assessment.installation);
  const dataItemLabels = new Map(
    assessment.dataItems.map((item) => [item.id, item.title] as const),
  );
  const isCompact = variant === 'compact';
  const sectionClass = isCompact
    ? 'rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'
    : 'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';
  const itemClass = isCompact
    ? 'rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60'
    : 'rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60';
  const darkCommandCardClass =
    'rounded-[1.25rem] border border-zinc-800 bg-zinc-950 p-4 shadow-inner';

  if (
    !assessment.installation &&
    !assessment.dataItems.length &&
    !assessment.migrationStrategies.length
  ) {
    return null;
  }

  const copyCommand = async (commandLine: string, commandId: string) => {
    await platform.copy(commandLine);
    setCopiedCommandId(commandId);
    window.setTimeout(() => {
      setCopiedCommandId((previous) => (previous === commandId ? null : previous));
    }, 1500);
  };

  return (
    <div className="space-y-5">
      <section className={sectionClass}>
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary-200 bg-primary-50 text-primary-600 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.page.assessment.sections.installation')}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('install.page.assessment.installation.description')}
            </p>
          </div>
        </div>

        {assessment.installation ? (
          <div className="mt-5 space-y-4">
            <div className={itemClass}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
                  {t('install.page.assessment.installation.primaryMethod')}
                </span>
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {assessment.installation.method.label}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getSupportTone(
                    assessment.installation.method.supported,
                  )}`}
                >
                  {t(
                    assessment.installation.method.supported === true
                      ? 'install.page.assessment.installation.supported'
                      : assessment.installation.method.supported === false
                        ? 'install.page.assessment.installation.documentedOnly'
                        : 'install.page.assessment.installation.declared',
                  )}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {t(`install.page.assessment.methodType.${assessment.installation.method.type}`, {
                    defaultValue: humanizeToken(assessment.installation.method.type),
                  })}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {assessment.installation.method.summary}
              </p>

              {(assessment.installation.method.documentationUrl ||
                assessment.installation.method.notes.length > 0) && (
                <div className="mt-4 space-y-3">
                  {assessment.installation.method.documentationUrl && (
                    <a
                      href={assessment.installation.method.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
                    >
                      <Link2 className="h-4 w-4" />
                      {t('install.page.assessment.installation.documentation')}
                    </a>
                  )}
                  {assessment.installation.method.notes.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('install.page.assessment.installation.notes')}
                      </div>
                      <div className="space-y-2">
                        {assessment.installation.method.notes.map((note) => (
                          <div
                            key={note}
                            className="rounded-xl border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={itemClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.assessment.installation.alternatives')}
                </div>
                <div className="mt-4 space-y-3">
                  {assessment.installation.alternatives.length > 0 ? (
                    assessment.installation.alternatives.map((method) => (
                      <div
                        key={method.id}
                        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {method.label}
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getSupportTone(
                              method.supported,
                            )}`}
                          >
                            {t(
                              method.supported === true
                                ? 'install.page.assessment.installation.supported'
                                : method.supported === false
                                  ? 'install.page.assessment.installation.documentedOnly'
                                  : 'install.page.assessment.installation.declared',
                            )}
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {t(`install.page.assessment.methodType.${method.type}`, {
                              defaultValue: humanizeToken(method.type),
                            })}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {method.summary}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                      {t('install.page.assessment.installation.noAlternatives')}
                    </div>
                  )}
                </div>
              </div>

              <div className={itemClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.assessment.installation.directories')}
                </div>
                <div className="mt-4 space-y-3">
                  {directories.length > 0 ? (
                    directories.map(({ key, directory }) => (
                      <div
                        key={`${key}-${directory.id ?? directory.path}`}
                        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {getDirectoryTitle(t, key, directory)}
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {t(
                              directory.customizable
                                ? 'install.page.assessment.installation.customizable'
                                : 'install.page.assessment.installation.fixed',
                            )}
                          </span>
                        </div>
                        <div className="mt-2 break-all text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          {directory.path}
                        </div>
                        {directory.purpose && (
                          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                            {directory.purpose}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                      {t('install.page.assessment.installation.noDirectories')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
            {t('install.page.assessment.installation.notAvailable')}
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.page.assessment.sections.dataLayout')}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('install.page.assessment.dataLayout.description')}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {assessment.dataItems.length > 0 ? (
            assessment.dataItems.map((item) => (
              <div key={item.id} className={itemClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {t(`install.page.assessment.dataKind.${item.kind}`, {
                          defaultValue: humanizeToken(item.kind),
                        })}
                      </span>
                      {item.sensitive && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                          {t('install.page.assessment.dataLayout.sensitive')}
                        </span>
                      )}
                      {item.backupByDefault && (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                          {t('install.page.assessment.dataLayout.backupByDefault')}
                        </span>
                      )}
                    </div>
                    {item.path && (
                      <div className="mt-2 break-all text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {item.path}
                      </div>
                    )}
                    {item.description && (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getPolicyTone(
                      item.uninstallByDefault,
                    )}`}
                  >
                    {t(
                      `install.page.assessment.uninstallPolicy.${item.uninstallByDefault}`,
                      {
                        defaultValue: humanizeToken(item.uninstallByDefault),
                      },
                    )}
                  </span>
                </div>

                {item.includes.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {t('install.page.assessment.dataLayout.includes')}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.includes.map((entry) => (
                        <span
                          key={`${item.id}-${entry}`}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {entry}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
              {t('install.page.assessment.dataLayout.empty')}
            </div>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.page.assessment.sections.migration')}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('install.page.assessment.migration.description')}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {assessment.migrationStrategies.length > 0 ? (
            assessment.migrationStrategies.map((strategy) => (
              <div key={strategy.id} className={itemClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {strategy.title}
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getMigrationModeTone(
                          strategy.mode,
                        )}`}
                      >
                        {t(`install.page.assessment.migration.mode.${strategy.mode}`, {
                          defaultValue: humanizeToken(strategy.mode),
                        })}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {t('install.page.assessment.migration.fromSource', {
                          source: humanizeToken(strategy.source),
                        })}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getSupportTone(
                          strategy.supported,
                        )}`}
                      >
                        {t(
                          strategy.supported === true
                            ? 'install.page.assessment.migration.supported'
                            : strategy.supported === false
                              ? 'install.page.assessment.migration.reviewRequired'
                              : 'install.page.assessment.installation.declared',
                        )}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {strategy.summary}
                    </p>
                  </div>

                  {strategy.documentationUrl && (
                    <a
                      href={strategy.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
                    >
                      <Link2 className="h-4 w-4" />
                      {t('install.page.assessment.installation.documentation')}
                    </a>
                  )}
                </div>

                {strategy.dataItemIds.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {t('install.page.assessment.migration.affectedData')}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {strategy.dataItemIds.map((dataItemId) => (
                        <span
                          key={`${strategy.id}-${dataItemId}`}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {dataItemLabels.get(dataItemId) ?? humanizeToken(dataItemId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {strategy.warnings.length > 0 && (
                  <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                          {t('install.page.assessment.migration.warnings')}
                        </div>
                        {strategy.warnings.map((warning) => (
                          <div
                            key={`${strategy.id}-${warning}`}
                            className="text-sm leading-relaxed text-amber-800 dark:text-amber-200"
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(strategy.previewCommands.length > 0 || strategy.applyCommands.length > 0) && (
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {[
                      {
                        key: 'previewCommands',
                        title: t('install.page.assessment.migration.previewCommands'),
                        commands: strategy.previewCommands,
                      },
                      {
                        key: 'applyCommands',
                        title: t('install.page.assessment.migration.applyCommands'),
                        commands: strategy.applyCommands,
                      },
                    ].map((group) =>
                      group.commands.length > 0 ? (
                        <div key={`${strategy.id}-${group.key}`} className={darkCommandCardClass}>
                          <div className="flex items-center gap-2 text-zinc-100">
                            {group.key === 'previewCommands' ? (
                              <FileText className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <Database className="h-4 w-4 text-zinc-400" />
                            )}
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                              {group.title}
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {group.commands.map((command, index) => {
                              const commandId = `${strategy.id}-${group.key}-${index}`;
                              return (
                                <div
                                  key={commandId}
                                  className="rounded-xl border border-zinc-800 bg-black/30 p-4"
                                >
                                  <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="text-sm font-medium text-zinc-100">
                                      {command.description}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void copyCommand(command.commandLine, commandId)}
                                      className="rounded-lg border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
                                    >
                                      {copiedCommandId === commandId
                                        ? t('common.copied')
                                        : t('common.copy')}
                                    </button>
                                  </div>
                                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-emerald-300">
                                    {command.commandLine}
                                  </pre>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
              {t('install.page.assessment.migration.empty')}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
