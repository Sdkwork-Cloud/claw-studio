import React, { useState } from 'react';

export function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
        <h3 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

export function ToggleRow({ title, description, enabled, onToggle }: { title: string, description: string, enabled: boolean, onToggle?: () => void }) {
  const [localEnabled, setLocalEnabled] = useState(enabled);

  // Sync local state with prop if it changes
  React.useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const handleToggle = () => {
    setLocalEnabled(!localEnabled);
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
      </div>
      <button 
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
          localEnabled ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          localEnabled ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}
