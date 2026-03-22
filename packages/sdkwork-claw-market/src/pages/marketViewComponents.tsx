import React from 'react';
import {
  Apple,
  Box,
  CheckCircle2,
  ChevronRight,
  Download,
  Loader2,
  Package2,
  Search,
  Server,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import type { Skill, SkillPack } from '@sdkwork/claw-types';
import type { Instance } from '../services';

const SKILL_ACCENTS = [
  'bg-amber-100 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/12 dark:text-sky-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/12 dark:text-rose-200',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/12 dark:text-indigo-200',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/12 dark:text-lime-200',
] as const;
const SKILL_SKELETON_GRID_TEMPLATE = 'repeat(auto-fit, minmax(min(100%, 19rem), 1fr))';
const PACK_SKELETON_GRID_TEMPLATE = 'repeat(auto-fit, minmax(min(100%, 23rem), 29rem))';

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAccentClass(value: string) {
  return SKILL_ACCENTS[hashString(value) % SKILL_ACCENTS.length];
}

function isImageLikeIcon(icon: string | undefined) {
  return Boolean(icon && /^(data:|https?:\/\/|\/)/.test(icon));
}

function ActionButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: 'primary' | 'danger';
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const className =
    tone === 'danger'
      ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
      : 'border border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${className}`}
    >
      {tone === 'danger' ? <Trash2 className="h-4 w-4" /> : null}
      {label}
      {tone === 'primary' ? <ChevronRight className="h-4 w-4" /> : null}
    </button>
  );
}

function CardSurfaceButton({
  label,
  onClick,
  roundedClassName,
}: {
  label: string;
  onClick: () => void;
  roundedClassName: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900 ${roundedClassName}`}
    />
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  count,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h2>
          {typeof count === 'number' ? (
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

export function SkillAvatar({ skill }: { skill: Skill }) {
  if (isImageLikeIcon(skill.icon)) {
    return (
      <img
        src={skill.icon}
        alt={skill.name}
        className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
      />
    );
  }

  if (skill.icon && skill.icon.trim().length <= 2) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        {skill.icon}
      </div>
    );
  }

  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${getAccentClass(
        skill.id,
      )} text-sm font-semibold uppercase tracking-[0.18em]`}
    >
      {skill.name.slice(0, 2)}
    </div>
  );
}

export function SkillCard({
  skill,
  statusLabel,
  actionLabel,
  actionTone,
  officialLabel,
  versionLabel,
  onOpen,
  onAction,
  formatDownloadCount,
}: {
  skill: Skill;
  statusLabel?: string;
  actionLabel: string;
  actionTone: 'primary' | 'danger';
  officialLabel: string;
  versionLabel: string;
  onOpen: () => void;
  onAction: () => void;
  formatDownloadCount: (value: number) => string;
}) {
  const isOfficial = /sdkwork|openclaw/i.test(skill.author);

  return (
    <div className="group relative flex h-full min-h-[150px] w-full flex-col rounded-2xl border border-zinc-200 bg-white px-5 py-5 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <CardSurfaceButton label={skill.name} onClick={onOpen} roundedClassName="rounded-2xl" />

      <div className="pointer-events-none relative z-10 flex items-start gap-4">
        <SkillAvatar skill={skill} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {skill.name}
            </h3>
            {isOfficial ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                {officialLabel}
              </span>
            ) : null}
            {statusLabel ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {statusLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{skill.author}</span>
            <span>{skill.category}</span>
            <span className="inline-flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {formatDownloadCount(skill.downloads)}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Star className="h-3.5 w-3.5 fill-current" />
              {skill.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {skill.description}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <div className="pointer-events-none flex flex-wrap items-center gap-3">
          <span>{versionLabel}</span>
          <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            {skill.category}
          </span>
        </div>
        <div className="pointer-events-auto">
          <ActionButton label={actionLabel} tone={actionTone} onClick={() => onAction()} />
        </div>
      </div>
    </div>
  );
}

export function PackCard({
  pack,
  badge,
  actionLabel,
  skillsLabel,
  onOpen,
  onAction,
  formatDownloadCount,
}: {
  pack: SkillPack;
  badge: string;
  actionLabel: string;
  skillsLabel: string;
  onOpen: () => void;
  onAction: () => void;
  formatDownloadCount: (value: number) => string;
}) {
  return (
    <div className="group relative flex h-full min-h-[188px] w-full flex-col rounded-2xl border border-zinc-200 bg-white px-5 py-5 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <CardSurfaceButton label={pack.name} onClick={onOpen} roundedClassName="rounded-2xl" />

      <div className="pointer-events-none relative z-10 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
          <Package2 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {pack.name}
            </h3>
            <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
              {badge}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{pack.author}</span>
            <span>{pack.category}</span>
            <span className="inline-flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {formatDownloadCount(pack.downloads)}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Star className="h-3.5 w-3.5 fill-current" />
              {pack.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {pack.description}
          </p>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-5 flex flex-wrap gap-2">
        {pack.skills.slice(0, 4).map((skill) => (
          <span
            key={skill.id}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {skill.name}
          </span>
        ))}
        {pack.skills.length > 4 ? (
          <span className="rounded-full border border-dashed border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            +{pack.skills.length - 4}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <div className="pointer-events-none flex flex-wrap items-center gap-3">
          <span>{skillsLabel}</span>
          <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            {pack.category}
          </span>
        </div>
        <div className="pointer-events-auto">
          <ActionButton label={actionLabel} tone="primary" onClick={() => onAction()} />
        </div>
      </div>
    </div>
  );
}

export function FeaturedPackCard({
  pack,
  badge,
  actionLabel,
  skillsLabel,
  onOpen,
  onAction,
  formatDownloadCount,
}: {
  pack: SkillPack;
  badge: string;
  actionLabel: string;
  skillsLabel: string;
  onOpen: () => void;
  onAction: () => void;
  formatDownloadCount: (value: number) => string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <CardSurfaceButton label={pack.name} onClick={onOpen} roundedClassName="rounded-2xl" />
      <div className="relative z-10 flex h-full flex-col gap-6">
        <div className="pointer-events-none flex items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
              {badge}
            </span>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {pack.name}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {pack.description}
              </p>
            </div>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
            <Package2 className="h-6 w-6" />
          </div>
        </div>

        <div className="pointer-events-none flex flex-wrap gap-2">
          {pack.skills.slice(0, 4).map((skill) => (
            <span
              key={skill.id}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {skill.name}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-4 border-t border-zinc-100 pt-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
          <div className="pointer-events-none flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>{skillsLabel}</span>
            <span className="inline-flex items-center gap-1">
              <Download className="h-4 w-4" />
              {formatDownloadCount(pack.downloads)}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Star className="h-4 w-4 fill-current" />
              {pack.rating.toFixed(1)}
            </span>
          </div>
          <div className="pointer-events-auto">
            <ActionButton label={actionLabel} tone="primary" onClick={() => onAction()} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-5" style={{ gridTemplateColumns: PACK_SKELETON_GRID_TEMPLATE }}>
        {[1, 2].map((item) => (
          <div key={item} className="h-64 rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: SKILL_SKELETON_GRID_TEMPLATE }}>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="h-40 rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        ))}
      </div>
    </div>
  );
}

export function InstanceSelectionList({
  instances,
  selectedInstanceIds,
  setSelectedInstanceIds,
  formatInstanceStatus,
}: {
  instances: Instance[];
  selectedInstanceIds: string[];
  setSelectedInstanceIds: React.Dispatch<React.SetStateAction<string[]>>;
  formatInstanceStatus: (status: Instance['status']) => string;
}) {
  return (
    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
      {instances.map((instance) => {
        const isSelected = selectedInstanceIds.includes(instance.id);
        return (
          <button
            type="button"
            key={instance.id}
            onClick={() => {
              setSelectedInstanceIds((previous) =>
                previous.includes(instance.id)
                  ? previous.filter((currentId) => currentId !== instance.id)
                  : [...previous, instance.id],
              );
            }}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${
              isSelected
                ? 'border-primary-300 bg-primary-50 text-zinc-950 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-zinc-50'
                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                isSelected
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {instance.iconType === 'apple' ? (
                <Apple className="h-5 w-5" />
              ) : instance.iconType === 'server' ? (
                <Server className="h-5 w-5" />
              ) : (
                <Box className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{instance.name}</div>
              <div
                className={`truncate text-xs ${
                  isSelected
                    ? 'text-zinc-600 dark:text-zinc-300'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {formatInstanceStatus(instance.status)} - {instance.ip}
              </div>
            </div>
            {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function SearchEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <EmptyState icon={<Search className="h-6 w-6" />} title={title} description={description} />;
}

export function PendingButtonLabel({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  if (!pending) {
    return <>{label}</>;
  }

  return (
    <>
      <Loader2 className="h-4 w-4" />
      {label}
    </>
  );
}
