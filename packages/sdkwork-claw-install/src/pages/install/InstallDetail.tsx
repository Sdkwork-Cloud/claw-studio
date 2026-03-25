import React from 'react';
import {
  ArrowLeft,
  Cloud,
  ExternalLink,
  Github,
  Info,
  Package,
  Server,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveOpenClawInstallDetail, type OpenClawInstallDetail } from '../../services';

function renderDetailIcon(detail: OpenClawInstallDetail) {
  if (detail.id === 'docker' || detail.id === 'podman' || detail.id === 'ansible') {
    return <Server className="h-7 w-7" />;
  }

  if (detail.id === 'cloud') {
    return <Cloud className="h-7 w-7" />;
  }

  if (detail.id === 'git' || detail.id === 'source') {
    return <Github className="h-7 w-7" />;
  }

  if (
    detail.id === 'installerCli' ||
    detail.id === 'npm' ||
    detail.id === 'pnpm' ||
    detail.id === 'bun' ||
    detail.id === 'nix'
  ) {
    return <Package className="h-7 w-7" />;
  }

  return <Sparkles className="h-7 w-7" />;
}

function formatHost(
  host: OpenClawInstallDetail['supportedHosts'][number],
  translate: (key: string) => string,
) {
  if (host === 'macos') {
    return translate('install.detail.hosts.macos');
  }

  if (host === 'linux') {
    return translate('install.detail.hosts.linux');
  }

  return translate('install.detail.hosts.windows');
}

function DetailSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function InstallDetail() {
  const { t } = useTranslation();
  const { method } = useParams<{ method: string }>();
  const navigate = useNavigate();
  const detail = resolveOpenClawInstallDetail(method);

  if (!detail) {
    return (
      <div className="min-h-full bg-zinc-50 p-4 dark:bg-zinc-950 md:p-8">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('install.detail.notFound.title')}
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {t('install.detail.notFound.description')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/install')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('install.detail.notFound.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 p-4 dark:bg-zinc-950 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/install')}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('install.detail.back')}
        </button>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300">
                {renderDetailIcon(detail)}
                {t('install.detail.eyebrow')}
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {detail.title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
                {detail.summary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {detail.supportedHosts.map((host) => (
                  <span
                    key={host}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                  >
                    {formatHost(host, t)}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
              <a
                href={detail.docs[0]?.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t('install.detail.actions.openOfficialGuide')}
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {t('install.detail.profileHint')}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <DetailSection title={t('install.detail.sections.bestFit')} items={detail.bestFor} />

          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.detail.sections.officialDocs')}
            </h2>
            <div className="mt-4 space-y-3">
              {detail.docs.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 transition-colors hover:border-primary-500/30 hover:bg-primary-500/5 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {link.label}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {link.description}
                      </div>
                    </div>
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <DetailSection
            title={t('install.detail.sections.beforeYouStart')}
            items={detail.prerequisites}
          />
          <DetailSection
            title={t('install.detail.sections.platformNotes')}
            items={detail.platformNotes}
          />
          <DetailSection
            title={t('install.detail.sections.afterInstall')}
            items={detail.followUp}
          />
        </div>

        <section className="flex items-start gap-4 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
          <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t('install.detail.footerNote')}
          </div>
        </section>
      </div>
    </div>
  );
}
