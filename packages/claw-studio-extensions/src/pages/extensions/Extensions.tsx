import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Download, Puzzle, Search, Settings, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { extensionService, type Extension } from '../../services';

export function Extensions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'installed'>('discover');
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchExtensions() {
      setIsLoading(true);
      try {
        const result = await extensionService.getExtensions();
        setExtensions(result.items);
      } catch (error) {
        console.error('Failed to fetch extensions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchExtensions();
  }, []);

  async function handleInstall(id: string) {
    try {
      await extensionService.installExtension(id);
      setExtensions((current) => current.map((extension) => (
        extension.id === id ? { ...extension, installed: true } : extension
      )));
      toast.success('Extension installed successfully');
    } catch {
      toast.error('Failed to install extension');
    }
  }

  async function handleUninstall(id: string) {
    if (!window.confirm('Are you sure you want to uninstall this extension?')) {
      return;
    }

    try {
      await extensionService.uninstallExtension(id);
      setExtensions((current) => current.map((extension) => (
        extension.id === id ? { ...extension, installed: false } : extension
      )));
      toast.success('Extension uninstalled successfully');
    } catch {
      toast.error('Failed to uninstall extension');
    }
  }

  const filteredExtensions = extensions.filter((extension) => {
    const matchesSearch = extension.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      extension.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'discover' ? true : extension.installed;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto scrollbar-hide">
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Puzzle className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Extensions</h1>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {(['discover', 'installed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm font-medium transition-all outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400 shadow-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'discover' && !searchQuery ? (
              <div className="mb-10">
                <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-[2rem] p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10 max-w-2xl">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider border border-white/10 mb-4 inline-block">Featured</span>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Supercharge Your Workflow</h2>
                    <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
                      Discover powerful extensions to customize your Claw environment. Add new tools, integrations, and capabilities with just one click.
                    </p>
                    <button className="bg-white text-indigo-900 px-6 py-3 rounded-full font-bold hover:bg-indigo-50 transition-colors shadow-lg flex items-center gap-2">
                      Browse Top Extensions <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExtensions.map((extension) => (
                <motion.div
                  key={extension.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <img src={extension.icon} alt={extension.name} className="w-14 h-14 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 object-cover" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{extension.name}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{extension.author}</p>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 flex-1 line-clamp-3 leading-relaxed">
                    {extension.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <Star className="w-3.5 h-3.5 fill-zinc-400 dark:text-zinc-400" />
                        {extension.rating}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <Download className="w-3.5 h-3.5" />
                        {(extension.downloads / 1000).toFixed(1)}k
                      </span>
                    </div>

                    {extension.installed ? (
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void handleUninstall(extension.id)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Uninstall"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => void handleInstall(extension.id)}
                        className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-1.5 rounded-full text-xs font-bold transition-colors"
                      >
                        Install
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {filteredExtensions.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                  <Puzzle className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No extensions found</h3>
                  <p className="text-zinc-500 dark:text-zinc-400">Try adjusting your search terms or filters.</p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
