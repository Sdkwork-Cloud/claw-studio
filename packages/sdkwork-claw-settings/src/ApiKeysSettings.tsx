import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
} from '@sdkwork/claw-i18n';
import { Button, Input, Label, Modal } from '@sdkwork/claw-ui';
import { type ApiKey, apiKeyService } from './services';

export function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const data = await apiKeyService.getApiKeys();
        setKeys(data);
      } catch {
        toast.error(t('settings.apiKeys.toasts.loadFailed'));
      }
    };

    void fetchKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(t('settings.apiKeys.toasts.enterName'));
      return;
    }

    setIsCreating(true);
    try {
      const { key, fullToken } = await apiKeyService.createApiKey(newKeyName);
      setKeys([key, ...keys]);
      setCreatedKey(fullToken);
      setCopied(false);
      setNewKeyName('');
      setIsCreateModalOpen(false);
      toast.success(t('settings.apiKeys.toasts.created'));
    } catch {
      toast.error(t('settings.apiKeys.toasts.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(t('settings.apiKeys.toasts.copied'));
    window.setTimeout(() => setCopied(false), 2000);
  };

  const confirmRevoke = (key: ApiKey) => {
    setKeyToRevoke(key);
    setIsRevokeModalOpen(true);
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) {
      return;
    }

    setIsRevoking(true);
    try {
      await apiKeyService.revokeApiKey(keyToRevoke.id);
      setKeys(keys.filter((key) => key.id !== keyToRevoke.id));
      toast.success(t('settings.apiKeys.toasts.revoked', { name: keyToRevoke.name }));
      setIsRevokeModalOpen(false);
      setKeyToRevoke(null);
    } catch {
      toast.error(t('settings.apiKeys.toasts.revokeFailed'));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('settings.apiKeys.title')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('settings.apiKeys.description')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          {t('settings.apiKeys.createNew')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="whitespace-nowrap border-b border-zinc-100 bg-zinc-50/50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3 font-medium">{t('settings.apiKeys.table.name')}</th>
                <th className="px-6 py-3 font-medium">
                  {t('settings.apiKeys.table.secretKey')}
                </th>
                <th className="px-6 py-3 font-medium">
                  {t('settings.apiKeys.table.created')}
                </th>
                <th className="px-6 py-3 font-medium">
                  {t('settings.apiKeys.table.lastUsed')}
                </th>
                <th className="px-6 py-3 font-medium">
                  {t('settings.apiKeys.table.usageMtd')}
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  {t('settings.apiKeys.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Key className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <p>
                      {t('settings.apiKeys.empty')}
                    </p>
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr
                    key={key.id}
                    className="group transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="min-w-[150px] px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {key.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-zinc-600 dark:text-zinc-400">
                      {key.token}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {formatDate(key.createdAt, language, { dateStyle: 'medium' })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {key.lastUsedAt
                        ? formatRelativeTime(key.lastUsedAt, language)
                        : t('settings.apiKeys.never')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(key.monthlyUsageUsd, language)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        onClick={() => confirmRevoke(key)}
                        className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title={t('settings.apiKeys.revokeKey')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-500">
            {t('settings.apiKeys.securityTitle')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-700/90 dark:text-amber-400/90">
            {t('settings.apiKeys.securityDescription')}
          </p>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('settings.apiKeys.createModal.title')}
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              {t('settings.apiKeys.createModal.name')}
            </Label>
            <Input
              type="text"
              placeholder={t('settings.apiKeys.createModal.namePlaceholder')}
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateKey}
              disabled={isCreating}
              className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isCreating
                ? t('settings.apiKeys.createModal.creating')
                : t('settings.apiKeys.createModal.create')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!createdKey}
        onClose={() => {
          setCreatedKey(null);
          setCopied(false);
        }}
        title={t('settings.apiKeys.saveModal.title')}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-400">
              {t('settings.apiKeys.saveModal.description')}
            </p>
          </div>

          <div className="relative mt-4">
            <Input
              type="text"
              readOnly
              value={createdKey || ''}
              className="pr-12 font-mono"
            />
            <button
              onClick={() => handleCopy(createdKey || '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title={t('settings.apiKeys.copyToClipboard')}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreatedKey(null);
                setCopied(false);
              }}
              className="w-full bg-zinc-900 text-white hover:bg-zinc-800 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {t('common.done')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title={t('settings.apiKeys.revokeModal.title')}
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('settings.apiKeys.revokeModal.description', { name: keyToRevoke?.name ?? '' })}
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsRevokeModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking
                ? t('settings.apiKeys.revokeModal.revoking')
                : t('settings.apiKeys.revokeModal.revoke')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
