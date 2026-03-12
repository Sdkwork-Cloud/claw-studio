import React, { useState, useEffect } from 'react';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Check, AlertCircle, MoreVertical } from 'lucide-react';
import { Modal } from '@sdkwork/claw-studio-shared-ui';
import { Section } from './Shared';
import { toast } from 'sonner';
import { apiKeyService, type ApiKey } from '../../services';

export function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(true);
      try {
        const data = await apiKeyService.getApiKeys();
        setKeys(data);
      } catch (error) {
        toast.error('Failed to load API keys');
      } finally {
        setIsLoading(false);
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
    if (keyToRevoke) {
      setIsRevoking(true);
      try {
        await apiKeyService.revokeApiKey(keyToRevoke.id);
        setKeys(keys.filter(k => k.id !== keyToRevoke.id));
        toast.success(`API Key "${keyToRevoke.name}" revoked`);
        setIsRevokeModalOpen(false);
        setKeyToRevoke(null);
      } catch (error) {
        toast.error('Failed to revoke API key');
      } finally {
        setIsRevoking(false);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">API Keys</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage API keys to authenticate requests to Claw Studio.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create new secret key
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              <tr>
                <th className="px-6 py-3 font-medium">NAME</th>
                <th className="px-6 py-3 font-medium">SECRET KEY</th>
                <th className="px-6 py-3 font-medium">CREATED</th>
                <th className="px-6 py-3 font-medium">LAST USED</th>
                <th className="px-6 py-3 font-medium">USAGE (MTD)</th>
                <th className="px-6 py-3 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Key className="w-8 h-8 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                    <p>No API keys found. Create one to get started.</p>
                  </td>
                </tr>
              ) : (
                keys.map(key => (
                  <tr key={key.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 min-w-[150px]">{key.name}</td>
                    <td className="px-6 py-4 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{key.token}</td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{key.created}</td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{key.lastUsed}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">${(Math.random() * 50).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button 
                        onClick={() => confirmRevoke(key)}
                        className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Revoke Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl p-4 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-500">Keep your keys secure</h3>
          <p className="text-sm text-amber-700/90 dark:text-amber-400/90 mt-1 leading-relaxed">
            Do not share your API keys in publicly accessible areas such as GitHub, client-side code, and so forth. 
            All API requests must be made over HTTPS.
          </p>
        </div>
      </div>

      {/* Create Key Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create new secret key">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Name</label>
            <input 
              type="text" 
              placeholder="e.g. Production App" 
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors"
              autoFocus
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateKey}
              className="px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors shadow-sm"
            >
              Create secret key
            </button>
          </div>
        </div>
      </Modal>

      {/* Show Created Key Modal */}
      <Modal isOpen={!!createdKey} onClose={() => setCreatedKey(null)} title="Save your secret key">
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-lg p-3 flex gap-2.5 items-start">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
              Please save this secret key somewhere safe and accessible. For security reasons, <strong>you won't be able to view it again</strong> through your OpenClaw account. If you lose this secret key, you'll need to generate a new one.
            </p>
          </div>
          
          <div className="relative mt-4">
            <input 
              type="text" 
              readOnly 
              value={createdKey || ''}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm rounded-lg block p-3 pr-12 outline-none"
            />
            <button 
              onClick={() => handleCopy(createdKey || '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              onClick={() => setCreatedKey(null)}
              className="px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors shadow-sm w-full sm:w-auto"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Revoke Key Modal */}
      <Modal isOpen={isRevokeModalOpen} onClose={() => setIsRevokeModalOpen(false)} title="Revoke API key">
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to revoke the key <strong>"{keyToRevoke?.name}"</strong>? 
            Any applications or scripts using this key will immediately lose access to the OpenClaw API. This action cannot be undone.
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button 
              onClick={() => setIsRevokeModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleRevoke}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors shadow-sm"
            >
              Revoke key
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
