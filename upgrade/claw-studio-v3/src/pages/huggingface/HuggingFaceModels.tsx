import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { RepositoryCard } from '../../components/RepositoryCard';
import { useTaskStore } from '../../store/useTaskStore';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import { huggingfaceService, HuggingFaceModel } from '../../services/huggingfaceService';

export function HuggingFaceModels() {
  const [searchQuery, setSearchQuery] = useState('');
  const [models, setModels] = useState<HuggingFaceModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addTask, updateTask } = useTaskStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const data = await huggingfaceService.getModels();
        setModels(data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (parentRef.current) {
        const containerWidth = parentRef.current.offsetWidth;
        if (containerWidth < 640) {
          setColumns(1);
        } else if (containerWidth < 1024) {
          setColumns(2);
        } else {
          setColumns(3);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  const handleInstall = async (id: string, name: string) => {
    toast.success(`Started downloading ${name}`);
    
    const taskId = addTask({
      title: `Downloading ${name}`,
      subtitle: 'Fetching weights and configuration files...',
      type: 'download'
    });

    try {
      await huggingfaceService.downloadModel(id, name);
      updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Download complete' });
      toast.success(`${name} downloaded successfully`);
    } catch (error) {
      updateTask(taskId, { status: 'error', subtitle: 'Download failed' });
      toast.error(`Failed to download ${name}`);
    }
  };

  const fuse = useMemo(() => new Fuse(models, {
    keys: ['name', 'author', 'tags'],
    threshold: 0.3,
  }), [models]);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, fuse, models]);

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredModels.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260, // Estimated height of a row (card height + gap)
    overscan: 5,
  });

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-400 rounded-xl flex items-center justify-center shadow-md border border-primary-500/20">
              <span className="text-2xl leading-none">🤗</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Hugging Face Models</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Download and deploy state-of-the-art AI models ({filteredModels.length} items)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search models, authors, tasks..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-2xl text-sm font-medium transition-all outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400 shadow-sm"
              />
            </div>
            <button className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
              <Filter className="w-5 h-5" />
            </button>
            <button className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
              <ArrowUpDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide px-8 pt-8">
        <div className="max-w-7xl mx-auto w-full">
          {filteredModels.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-6xl mb-4 block opacity-50 grayscale">🤗</span>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No models found</h3>
              <p className="text-zinc-500 dark:text-zinc-400">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.index}
                  className="absolute top-0 left-0 w-full flex gap-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {Array.from({ length: columns }).map((_, colIndex) => {
                    const itemIndex = virtualRow.index * columns + colIndex;
                    const model = filteredModels[itemIndex];
                    
                    return (
                      <div key={model ? model.id : `empty-${colIndex}`} className="flex-1 min-w-0 pb-6">
                        {model ? (
                          <RepositoryCard
                            {...model}
                            type="huggingface"
                            onInstall={handleInstall}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
