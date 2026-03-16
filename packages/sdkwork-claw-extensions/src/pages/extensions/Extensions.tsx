import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Apple,
  Box,
  ChevronRight,
  Download,
  Loader2,
  Puzzle,
  Search,
  Server,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInstanceStore } from '@sdkwork/claw-core';
import { Modal } from '@sdkwork/claw-ui';
import { extensionService, type Extension } from '../../services';

interface ExtensionInstance {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'starting' | 'error';
  ip: string;
  iconType?: 'apple' | 'box' | 'server';
}

async function loadInstances(): Promise<ExtensionInstance[]> {
  try {
    const response = await fetch('/api/instances');
    if (!response.ok) {
      throw new Error('Failed to fetch instances');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch instances for extensions:', error);
    return [];
  }
}

export function Extensions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'installed'>('discover');
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [instances, setInstances] = useState<ExtensionInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [installModalExt, setInstallModalExt] = useState<Extension | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const { activeInstanceId } = useInstanceStore();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [extensionResult, instanceResult] = await Promise.all([
          extensionService.getExtensions(),
          loadInstances(),
        ]);
        setExtensions(extensionResult.items);
        setInstances(instanceResult);
      } catch (error) {
        console.error('Failed to fetch extensions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchData();
  }, []);

  useEffect(() => {
    if (instances.length > 0 && selectedInstanceIds.length === 0) {
      setSelectedInstanceIds([activeInstanceId || instances[0].id]);
    }
  }, [activeInstanceId, instances, selectedInstanceIds.length]);

  function handleInstallClick(extension: Extension) {
    setInstallModalExt(extension);
  }

  async function confirmInstall() {
    if (!installModalExt || selectedInstanceIds.length === 0) {
      return;
    }

    setIsInstalling(true);
    try {
      await Promise.all(
        selectedInstanceIds.map((instanceId) =>
          extensionService.installExtension(installModalExt.id, instanceId),
        ),
      );
      setExtensions((current) =>
        current.map((extension) =>
          extension.id === installModalExt.id ? { ...extension, installed: true } : extension,
        ),
      );
      toast.success('Extension installed successfully');
      setInstallModalExt(null);
    } catch {
      toast.error('Failed to install extension');
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleUninstall(id: string) {
    if (!window.confirm('Are you sure you want to uninstall this extension?')) {
      return;
    }

    try {
      await extensionService.uninstallExtension(id);
      setExtensions((current) =>
        current.map((extension) => (extension.id === id ? { ...extension, installed: false } : extension)),
      );
      toast.success('Extension uninstalled successfully');
    } catch {
      toast.error('Failed to uninstall extension');
    }
  }

  const filteredExtensions = extensions.filter((extension) => {
    const matchesSearch =
      extension.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      extension.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'discover' ? true : extension.installed;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 scrollbar-hide dark:bg-zinc-950">
      <div className="sticky top-0 z-20 flex flex-col justify-between gap-4 border-b border-zinc-200 bg-white/80 px-8 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
            <Puzzle className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Extensions
          </h1>
        </div>

        <div className="flex w-full items-center gap-4 md:w-auto">
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                activeTab === 'discover'
                  ? 'rounded-md bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                activeTab === 'installed'
                  ? 'rounded-md bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              Installed
            </button>
          </div>

          <div className="group relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-indigo-500 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-100/80 py-2 pl-9 pr-4 text-sm font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-500 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:bg-zinc-900"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {activeTab === 'discover' && !searchQuery ? (
              <div className="mb-10">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-indigo-900 to-purple-900 p-8 text-white shadow-xl md:p-12">
                  <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
                  <div className="relative z-10 max-w-2xl">
                    <span className="mb-4 inline-block rounded-full border border-white/10 bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                      Featured
                    </span>
                    <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                      Supercharge Your Workflow
                    </h2>
                    <p className="mb-8 text-lg leading-relaxed text-indigo-100">
                      Discover powerful extensions to customize your Claw environment. Add new
                      tools, integrations, and capabilities with just one click.
                    </p>
                    <button className="flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-indigo-900 shadow-lg transition-colors hover:bg-indigo-50">
                      Browse Top Extensions <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredExtensions.map((extension) => (
                <motion.div
                  key={extension.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-4 flex items-start gap-4">
                    <img
                      src={extension.icon}
                      alt={extension.name}
                      className="h-14 w-14 rounded-xl border border-zinc-100 object-cover shadow-sm dark:border-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {extension.name}
                      </h3>
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {extension.author}
                      </p>
                    </div>
                  </div>

                  <p className="mb-6 flex-1 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {extension.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <Star className="h-3.5 w-3.5 fill-zinc-400 dark:text-zinc-400" />
                        {extension.rating}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <Download className="h-3.5 w-3.5" />
                        {(extension.downloads / 1000).toFixed(1)}k
                      </span>
                    </div>

                    {extension.installed ? (
                      <div className="flex items-center gap-2">
                        <button className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void handleUninstall(extension.id)}
                          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          title="Uninstall"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInstallClick(extension)}
                        className="rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
                      >
                        Install
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {filteredExtensions.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                  <Puzzle className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                  <h3 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    No extensions found
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Try adjusting your search terms or filters.
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={!!installModalExt} onClose={() => setInstallModalExt(null)} title="Install Extension">
        {installModalExt ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <img
                src={installModalExt.icon}
                alt={installModalExt.name}
                className="h-12 w-12 rounded-xl border border-zinc-200 object-cover shadow-sm dark:border-zinc-700"
                referrerPolicy="no-referrer"
              />
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{installModalExt.name}</h4>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  by {installModalExt.author}
                </p>
              </div>
            </div>

            {instances.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-500">
                <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-80" />
                <p className="text-sm font-bold">No instances available</p>
                <p className="mt-1 text-xs opacity-80">Please create an instance first.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Select Target Instances
                  </label>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {instances.map((instance) => {
                      const isSelected = selectedInstanceIds.includes(instance.id);
                      return (
                        <div
                          key={instance.id}
                          onClick={() => {
                            setSelectedInstanceIds((current) =>
                              current.includes(instance.id)
                                ? current.filter((id) => id !== instance.id)
                                : [...current, instance.id],
                            );
                          }}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-500/10'
                              : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-primary-500 text-white'
                                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
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
                          <div>
                            <h4
                              className={`text-sm font-bold ${
                                isSelected
                                  ? 'text-primary-900 dark:text-primary-100'
                                  : 'text-zinc-900 dark:text-zinc-100'
                              }`}
                            >
                              {instance.name}
                            </h4>
                            <p
                              className={`text-xs ${
                                isSelected
                                  ? 'text-primary-600 dark:text-primary-400'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {instance.status === 'online' ? 'Online' : 'Offline'} • {instance.ip}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => void confirmInstall()}
                  disabled={isInstalling || selectedInstanceIds.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-primary-300 dark:disabled:bg-primary-800"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Install to Instance
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
