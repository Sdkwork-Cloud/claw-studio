import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  useLocalizedText,
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
  const { text, language } = useLocalizedText();

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const data = await apiKeyService.getApiKeys();
        setKeys(data);
      } catch {
        toast.error(text('Failed to load API keys', '\u52a0\u8f7d API \u5bc6\u94a5\u5931\u8d25'));
      }
    };

    void fetchKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(text('Please enter a key name', '\u8bf7\u8f93\u5165\u5bc6\u94a5\u540d\u79f0'));
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
      toast.success(
        text('API key created successfully', 'API \u5bc6\u94a5\u521b\u5efa\u6210\u529f'),
      );
    } catch {
      toast.error(
        text('Failed to create API key', '\u521b\u5efa API \u5bc6\u94a5\u5931\u8d25'),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(
      text(
        'API key copied to clipboard',
        '\u5df2\u5c06 API \u5bc6\u94a5\u590d\u5236\u5230\u526a\u8d34\u677f',
      ),
    );
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
      toast.success(
        text(
          `API key "${keyToRevoke.name}" revoked`,
          `API \u5bc6\u94a5\u201c${keyToRevoke.name}\u201d\u5df2\u540a\u9500`,
        ),
      );
      setIsRevokeModalOpen(false);
      setKeyToRevoke(null);
    } catch {
      toast.error(
        text('Failed to revoke API key', '\u540a\u9500 API \u5bc6\u94a5\u5931\u8d25'),
      );
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {text('API Keys', 'API \u5bc6\u94a5')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {text(
              'Manage API keys to authenticate requests to Claw Studio.',
              '\u7ba1\u7406\u7528\u4e8e Claw Studio \u8bf7\u6c42\u8ba4\u8bc1\u7684 API \u5bc6\u94a5\u3002',
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          {text('Create new secret key', '\u521b\u5efa\u65b0\u5bc6\u94a5')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="whitespace-nowrap border-b border-zinc-100 bg-zinc-50/50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3 font-medium">{text('Name', '\u540d\u79f0')}</th>
                <th className="px-6 py-3 font-medium">
                  {text('Secret Key', '\u5bc6\u94a5')}
                </th>
                <th className="px-6 py-3 font-medium">
                  {text('Created', '\u521b\u5efa\u65f6\u95f4')}
                </th>
                <th className="px-6 py-3 font-medium">
                  {text('Last Used', '\u6700\u540e\u4f7f\u7528')}
                </th>
                <th className="px-6 py-3 font-medium">
                  {text('Usage (MTD)', '\u672c\u6708\u7528\u91cf')}
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  {text('Actions', '\u64cd\u4f5c')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Key className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <p>
                      {text(
                        'No API keys found. Create one to get started.',
                        '\u5c1a\u65e0 API \u5bc6\u94a5\uff0c\u521b\u5efa\u4e00\u4e2a\u5373\u53ef\u5f00\u59cb\u4f7f\u7528\u3002',
                      )}
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
                        : text('Never', '\u4ece\u672a')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(key.monthlyUsageUsd, language)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        onClick={() => confirmRevoke(key)}
                        className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title={text('Revoke key', '\u540a\u9500\u5bc6\u94a5')}
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
            {text('Keep your keys secure', '\u59a5\u5584\u4fdd\u62a4\u5bc6\u94a5')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-700/90 dark:text-amber-400/90">
            {text(
              'Do not share your API keys in publicly accessible areas such as GitHub, client-side code, and so forth. All API requests must be made over HTTPS.',
              '\u8bf7\u4e0d\u8981\u5728 GitHub\u3001\u5ba2\u6237\u7aef\u4ee3\u7801\u7b49\u516c\u5f00\u53ef\u8bbf\u95ee\u7684\u573a\u6240\u5206\u4eab API \u5bc6\u94a5\u3002\u6240\u6709 API \u8bf7\u6c42\u90fd\u5fc5\u987b\u901a\u8fc7 HTTPS \u53d1\u8d77\u3002',
            )}
          </p>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={text('Create new secret key', '\u521b\u5efa\u65b0\u5bc6\u94a5')}
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              {text('Name', '\u540d\u79f0')}
            </Label>
            <Input
              type="text"
              placeholder={text('e.g. Production App', '\u4f8b\u5982\uff1aProduction App')}
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
              {text('Cancel', '\u53d6\u6d88')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateKey}
              disabled={isCreating}
              className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isCreating
                ? text('Creating...', '\u521b\u5efa\u4e2d...')
                : text('Create secret key', '\u521b\u5efa\u5bc6\u94a5')}
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
        title={text('Save your secret key', '\u4fdd\u5b58\u4f60\u7684\u5bc6\u94a5')}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-400">
              {text(
                "Please save this secret key somewhere safe and accessible. For security reasons, you won't be able to view it again through Claw Studio. If you lose this secret key, you'll need to generate a new one.",
                '\u8bf7\u5c06\u6b64\u5bc6\u94a5\u4fdd\u5b58\u5230\u5b89\u5168\u4e14\u53ef\u8bbf\u95ee\u7684\u4f4d\u7f6e\u3002\u51fa\u4e8e\u5b89\u5168\u539f\u56e0\uff0c\u4f60\u65e0\u6cd5\u5728 Claw Studio \u4e2d\u518d\u6b21\u67e5\u770b\u5b83\u3002\u5982\u679c\u4e22\u5931\uff0c\u5219\u9700\u8981\u91cd\u65b0\u751f\u6210\u4e00\u4e2a\u65b0\u5bc6\u94a5\u3002',
              )}
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
              title={text('Copy to clipboard', '\u590d\u5236\u5230\u526a\u8d34\u677f')}
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
              {text('Done', '\u5b8c\u6210')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title={text('Revoke API key', '\u540a\u9500 API \u5bc6\u94a5')}
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {text(
              `Are you sure you want to revoke the key "${keyToRevoke?.name}"? Any applications or scripts using this key will immediately lose access to the Claw Studio API. This action cannot be undone.`,
              `\u786e\u5b9a\u8981\u540a\u9500\u5bc6\u94a5\u201c${keyToRevoke?.name ?? ''}\u201d\u5417\uff1f\u4efb\u4f55\u4ecd\u5728\u4f7f\u7528\u8be5\u5bc6\u94a5\u7684\u5e94\u7528\u6216\u811a\u672c\u90fd\u5c06\u7acb\u5373\u5931\u53bb\u5bf9 Claw Studio API \u7684\u8bbf\u95ee\u6743\u9650\u3002\u6b64\u64cd\u4f5c\u65e0\u6cd5\u64a4\u9500\u3002`,
            )}
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsRevokeModalOpen(false)}
            >
              {text('Cancel', '\u53d6\u6d88')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking
                ? text('Revoking...', '\u540a\u9500\u4e2d...')
                : text('Revoke key', '\u540a\u9500\u5bc6\u94a5')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
