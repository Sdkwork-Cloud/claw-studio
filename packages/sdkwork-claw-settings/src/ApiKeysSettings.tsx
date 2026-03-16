import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@sdkwork/claw-ui';
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

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const data = await apiKeyService.getApiKeys();
        setKeys(data);
      } catch (error) {
        toast.error('Failed to load API keys');
      }
    };

    fetchKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    setIsCreating(true);
    try {
      const { key, fullToken } = await apiKeyService.createApiKey(newKeyName);
      setKeys([key, ...keys]);
      setCreatedKey(fullToken);
      setNewKeyName('');
      setIsCreateModalOpen(false);
      toast.success('API Key created successfully');
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('API Key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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
      toast.success(`API Key "${keyToRevoke.name}" revoked`);
      setIsRevokeModalOpen(false);
      setKeyToRevoke(null);
    } catch (error) {
      toast.error('Failed to revoke API key');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            API Keys
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage API keys to authenticate requests to Claw Studio.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          Create new secret key
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="whitespace-nowrap border-b border-zinc-100 bg-zinc-50/50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3 font-medium">NAME</th>
                <th className="px-6 py-3 font-medium">SECRET KEY</th>
                <th className="px-6 py-3 font-medium">CREATED</th>
                <th className="px-6 py-3 font-medium">LAST USED</th>
                <th className="px-6 py-3 font-medium">USAGE (MTD)</th>
                <th className="px-6 py-3 text-right font-medium">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Key className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <p>No API keys found. Create one to get started.</p>
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
                      {key.created}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {key.lastUsed}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      ${(Math.random() * 50).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        onClick={() => confirmRevoke(key)}
                        className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title="Revoke Key"
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
            Keep your keys secure
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-700/90 dark:text-amber-400/90">
            Do not share your API keys in publicly accessible areas such as GitHub,
            client-side code, and so forth. All API requests must be made over HTTPS.
          </p>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create new secret key"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Production App"
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateKey}
              disabled={isCreating}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isCreating ? 'Creating...' : 'Create secret key'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!createdKey}
        onClose={() => setCreatedKey(null)}
        title="Save your secret key"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-400">
              Please save this secret key somewhere safe and accessible. For security
              reasons, <strong>you won't be able to view it again</strong> through your
              OpenClaw account. If you lose this secret key, you'll need to generate a
              new one.
            </p>
          </div>

          <div className="relative mt-4">
            <input
              type="text"
              readOnly
              value={createdKey || ''}
              className="block w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 pr-12 font-mono text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              onClick={() => handleCopy(createdKey || '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setCreatedKey(null)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Revoke API key"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to revoke the key <strong>"{keyToRevoke?.name}"</strong>?
            Any applications or scripts using this key will immediately lose access to
            the OpenClaw API. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsRevokeModalOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleRevoke}
              disabled={isRevoking}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {isRevoking ? 'Revoking...' : 'Revoke key'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
