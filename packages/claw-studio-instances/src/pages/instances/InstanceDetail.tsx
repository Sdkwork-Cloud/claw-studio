import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Settings, Terminal, Shield, RefreshCw, Power, Save, Trash2, Copy, Check, Info } from 'lucide-react';
import { instanceService, Instance } from '../../services';

export function InstanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock configuration state
  const [config, setConfig] = useState({
    port: '18789',
    sandbox: true,
    autoUpdate: false,
    logLevel: 'info',
    corsOrigins: '*'
  });

  useEffect(() => {
    const fetchInstance = async () => {
      setIsLoading(true);
      try {
        if (id) {
          const data = await instanceService.getInstanceById(id);
          if (data) setInstance(data);
        }
      } catch (error) {
        console.error('Failed to fetch instance:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInstance();
  }, [id]);

  const handleCopyToken = () => {
    // Mock token for now
    navigator.clipboard.writeText('oc_token_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c');
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Instance Not Found</h2>
        <button onClick={() => navigate('/instances')} className="text-primary-600 dark:text-primary-400 hover:underline">
          Return to Instances
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <button 
        onClick={() => navigate('/instances')}
        className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-sm font-medium mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Instances
      </button>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-100 dark:border-zinc-700 shadow-sm shrink-0">
              <Server className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{instance.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  instance.status === 'online' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                }`}>
                  {instance.status === 'online' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
                  {instance.status}
                </span>
                <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">{instance.ip}</span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500">Uptime: {instance.uptime}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
              <RefreshCw className="w-4 h-4" />
              Restart
            </button>
            <button className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
              <Power className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'config' 
              ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'logs' 
              ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Daemon Logs
        </button>
      </div>

      {activeTab === 'config' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Connection Settings */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
              <Server className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
              Connection Settings
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Gateway Port</label>
                <input 
                  type="text" 
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">The port the Claw Studio daemon listens on.</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">CORS Origins</label>
                <input 
                  type="text" 
                  value={config.corsOrigins}
                  onChange={(e) => setConfig({ ...config, corsOrigins: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Allowed origins for API requests (comma separated).</p>
              </div>
            </div>

            <div className="mt-8">
              <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">API Token</label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  value={(instance as any).token || 'sk-local-123456789'}
                  readOnly
                  className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 font-mono"
                />
                <button 
                  onClick={handleCopyToken}
                  className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  {copiedToken ? <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedToken ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Use this token to authenticate external applications with this gateway.</p>
            </div>
          </div>

          {/* Security & Behavior */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
              Security & Behavior
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Agent Sandbox</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Isolate skill execution in a secure sandbox environment.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={config.sandbox}
                    onChange={(e) => setConfig({ ...config, sandbox: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 dark:after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Auto-Update</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Automatically download and install daemon updates.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={config.autoUpdate}
                    onChange={(e) => setConfig({ ...config, autoUpdate: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 dark:after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Log Level</label>
                <select 
                  value={config.logLevel}
                  onChange={(e) => setConfig({ ...config, logLevel: e.target.value })}
                  className="w-full md:w-1/2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-red-900 dark:text-red-400 mb-4">Danger Zone</h2>
            <p className="text-sm text-red-700 dark:text-red-300 mb-6">Irreversible actions for this instance. Proceed with caution.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
                <RefreshCw className="w-4 h-4" />
                Factory Reset
              </button>
              <button className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-md shadow-red-600/20">
                <Trash2 className="w-4 h-4" />
                Uninstall Instance
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-primary-500/20 disabled:opacity-50"
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> Save Configuration</>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col h-[600px]">
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Live Daemon Logs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-mono text-emerald-400">Connected</span>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs md:text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              <span className="text-zinc-500">[2023-10-27 14:32:01]</span> <span className="text-primary-400">INFO</span> Starting OpenClaw Daemon v0.2.1...{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:32:01]</span> <span className="text-primary-400">INFO</span> Loading configuration from ~/.openclaw/config.json{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:32:02]</span> <span className="text-primary-400">INFO</span> Initializing Sandbox environment...{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:32:03]</span> <span className="text-emerald-400">SUCCESS</span> Sandbox initialized successfully.{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:32:03]</span> <span className="text-primary-400">INFO</span> Starting HTTP server on port 18789...{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:32:03]</span> <span className="text-emerald-400">SUCCESS</span> Server listening on http://127.0.0.1:18789{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:35:12]</span> <span className="text-primary-400">INFO</span> Incoming connection from 127.0.0.1{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:35:12]</span> <span className="text-primary-400">INFO</span> Authenticated client successfully.{'\n'}
              <span className="text-zinc-500">[2023-10-27 14:40:05]</span> <span className="text-yellow-400">WARN</span> Skill 'weather-fetcher' took longer than 500ms to respond.{'\n'}
              <span className="text-zinc-500">[2023-10-27 15:01:22]</span> <span className="text-primary-400">INFO</span> Syncing device state...{'\n'}
              <span className="text-zinc-500">[2023-10-27 15:01:23]</span> <span className="text-emerald-400">SUCCESS</span> State synced.{'\n'}
              <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse mt-2 align-middle"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
