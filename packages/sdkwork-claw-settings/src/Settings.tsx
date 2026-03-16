import React, { useEffect, useState } from 'react';
import {
  Bell,
  Code,
  Database,
  Key,
  Monitor,
  Receipt,
  Router as RouterIcon,
  Search,
  Shield,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { Account } from '@sdkwork/claw-account';
import { AccountSettings } from './AccountSettings';
import { ApiKeysSettings } from './ApiKeysSettings';
import { BillingSettings } from './BillingSettings';
import { DataPrivacySettings } from './DataPrivacySettings';
import { GeneralSettings } from './GeneralSettings';
import { LLMSettings } from './LLMSettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Monitor },
  { id: 'llm', label: 'LLM Configuration', icon: Sparkles },
  { id: 'billing', label: 'Billing & Usage', icon: Receipt },
  { id: 'wallet', label: 'Account', icon: Wallet },
  { id: 'account', label: 'Profile Settings', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'data', label: 'Data & Privacy', icon: Database },
  { id: 'codebox', label: 'CodeBox', icon: Code },
  { id: 'api-router', label: 'Api Router', icon: RouterIcon },
];

export function Settings() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (location.pathname === '/settings/llm') {
      setActiveTab('llm');
    }
  }, [location]);

  const filteredTabs = SETTINGS_TABS.filter((tab) =>
    tab.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="p-6 pb-4">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Settings
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-[13px] text-zinc-900 shadow-sm transition-all placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-primary-500"
            />
          </div>
        </div>
        <nav className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-4 pb-6">
          {filteredTabs.length > 0 ? (
            filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'border-zinc-200/50 bg-white text-primary-600 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-primary-400'
                      : 'border-transparent text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                  }`}
                >
                  <tab.icon
                    className={`h-4 w-4 ${
                      isActive
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  />
                  {tab.label}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No settings found.
            </div>
          )}
        </nav>
      </div>

      <div className="scrollbar-hide flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl p-8 md:p-12">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'llm' && <LLMSettings />}
            {activeTab === 'billing' && <BillingSettings />}
            {activeTab === 'wallet' && <Account />}
            {activeTab === 'account' && <AccountSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'api' && <ApiKeysSettings />}
            {activeTab === 'data' && <DataPrivacySettings />}
            {activeTab === 'codebox' && (
              <PlaceholderPanel
                icon={Code}
                title="CodeBox Integration"
                description="This is a placeholder for the third-party CodeBox component integration. The implementation will be provided by an external library."
              />
            )}
            {activeTab === 'api-router' && (
              <PlaceholderPanel
                icon={RouterIcon}
                title="Api Router Integration"
                description="This is a placeholder for the third-party Api Router component integration. The implementation will be provided by an external library."
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mx-auto max-w-md text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}
