import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Power,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Terminal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInstanceStore } from '@sdkwork/claw-core';
import { instanceService } from '../services';
import { Instance, InstanceConfig } from '../types';

export function InstanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState('');
  const [config, setConfig] = useState<InstanceConfig>({
    port: '18789',
    sandbox: true,
    autoUpdate: false,
    logLevel: 'info',
    corsOrigins: '*',
  });

  useEffect(() => {
    const fetchInstanceData = async () => {
      setIsLoading(true);
      try {
        if (!id) {
          return;
        }

        const [instanceData, configData, tokenData, logsData] = await Promise.all([
          instanceService.getInstanceById(id),
          instanceService.getInstanceConfig(id),
          instanceService.getInstanceToken(id),
          instanceService.getInstanceLogs(id),
        ]);

        if (instanceData) {
          setInstance(instanceData);
        }
        if (configData) {
          setConfig(configData);
        }
        if (tokenData) {
          setToken(tokenData);
        }
        if (logsData) {
          setLogs(logsData);
        }
      } catch (error) {
        console.error('Failed to fetch instance data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchInstanceData();
  }, [id]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSave = async () => {
    if (!id) {
      return;
    }

    setIsSaving(true);
    try {
      await instanceService.updateInstanceConfig(id, config);
      toast.success('Configuration saved successfully');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = async () => {
    if (!id) {
      return;
    }

    try {
      await instanceService.restartInstance(id);
      toast.success('Instance restarted successfully');
      setInstance((current) => (current ? { ...current, status: 'online' } : null));
    } catch (error: any) {
      toast.error(error.message || 'Failed to restart instance');
    }
  };

  const handleStop = async () => {
    if (!id) {
      return;
    }

    try {
      await instanceService.stopInstance(id);
      toast.success('Instance stopped successfully');
      setInstance((current) => (current ? { ...current, status: 'offline' } : null));
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop instance');
    }
  };

  const handleStart = async () => {
    if (!id) {
      return;
    }

    try {
      await instanceService.startInstance(id);
      toast.success('Instance started successfully');
      setInstance((current) => (current ? { ...current, status: 'online' } : null));
    } catch (error: any) {
      toast.error(error.message || 'Failed to start instance');
    }
  };

  const handleDelete = async () => {
    if (!id) {
      return;
    }

    if (!window.confirm('Are you sure you want to uninstall this instance? This action cannot be undone.')) {
      return;
    }

    try {
      await instanceService.deleteInstance(id);
      toast.success('Instance uninstalled successfully');
      if (activeInstanceId === id) {
        setActiveInstanceId(null);
      }
      navigate('/instances');
    } catch (error: any) {
      toast.error(error.message || 'Failed to uninstall instance');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-5xl items-center justify-center p-4 md:p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="mx-auto max-w-5xl p-4 text-center md:p-8">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Instance Not Found
        </h2>
        <button
          onClick={() => navigate('/instances')}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          Return to Instances
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <button
        onClick={() => navigate('/instances')}
        className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Instances
      </button>

      <div className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <Server className="h-8 w-8 text-primary-500 dark:text-primary-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {instance.name}
                </h1>
                {activeInstanceId === instance.id && (
                  <div className="flex items-center gap-1 rounded-md border border-primary-500/20 bg-primary-500/10 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Active Instance
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    instance.status === 'online'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {instance.status === 'online' && <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
                  {instance.status}
                </span>
                <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">{instance.ip}</span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500">Uptime: {instance.uptime}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeInstanceId !== instance.id && instance.status === 'online' && (
              <button
                onClick={() => setActiveInstanceId(instance.id)}
                className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Set as Active
              </button>
            )}
            {instance.status === 'online' ? (
              <>
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                >
                  <Power className="h-4 w-4" />
                  Stop
                </button>
              </>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
              >
                <Power className="h-4 w-4" />
                Start
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'config'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'logs'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <Terminal className="h-4 w-4" />
          Daemon Logs
        </button>
      </div>

      {activeTab === 'config' && (
        <div className="animate-in slide-in-from-bottom-4 space-y-8 fade-in duration-500">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              <Server className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              Connection Settings
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Gateway Port
                </label>
                <input
                  type="text"
                  value={config.port}
                  onChange={(event) => setConfig({ ...config, port: event.target.value })}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-mono text-zinc-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  The port the Claw Studio daemon listens on.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  CORS Origins
                </label>
                <input
                  type="text"
                  value={config.corsOrigins}
                  onChange={(event) => setConfig({ ...config, corsOrigins: event.target.value })}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-mono text-zinc-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Allowed origins for API requests (comma separated).
                </p>
              </div>
            </div>

            <div className="mt-8">
              <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                API Token
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={token || ''}
                  readOnly
                  className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-mono text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  onClick={handleCopyToken}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {copiedToken ? (
                    <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedToken ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Use this token to authenticate external applications with this gateway.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              <Shield className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              Security & Behavior
            </h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800/50">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Agent Sandbox</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Isolate skill execution in a secure sandbox environment.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={config.sandbox}
                    onChange={(event) => setConfig({ ...config, sandbox: event.target.checked })}
                  />
                  <div className="h-6 w-11 rounded-full bg-zinc-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-500 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-zinc-700 dark:after:border-zinc-600" />
                </label>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800/50">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Auto-Update</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Automatically download and install daemon updates.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={config.autoUpdate}
                    onChange={(event) => setConfig({ ...config, autoUpdate: event.target.checked })}
                  />
                  <div className="h-6 w-11 rounded-full bg-zinc-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-500 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-zinc-700 dark:after:border-zinc-600" />
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Log Level
                </label>
                <select
                  value={config.logLevel}
                  onChange={(event) => setConfig({ ...config, logLevel: event.target.value })}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 md:w-1/2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-500/20 dark:bg-red-500/5 md:p-8">
            <h2 className="mb-4 text-lg font-bold text-red-900 dark:text-red-400">Danger Zone</h2>
            <p className="mb-6 text-sm text-red-700 dark:text-red-300">
              Irreversible actions for this instance. Proceed with caution.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-6 py-3 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 dark:border-red-500/30 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-500/10">
                <RefreshCw className="h-4 w-4" />
                Factory Reset
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-colors hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Uninstall Instance
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-500">
          <div className="flex h-[600px] flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-zinc-400" />
                <span className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                  Live Daemon Logs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-emerald-400">Connected</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap p-6 font-mono text-xs leading-relaxed text-zinc-300 md:text-sm">
              {logs}
              <span className="ml-1 inline-block h-4 w-2 animate-pulse align-middle bg-zinc-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
