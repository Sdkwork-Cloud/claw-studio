import { useState } from 'react';
import {
  Bell,
  Database,
  Key,
  Monitor,
  Receipt,
  Search,
  Shield,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { Account } from '@sdkwork/claw-account';
import { useLocalizedText } from '@sdkwork/claw-i18n';
import { Input } from '@sdkwork/claw-ui';
import { AccountSettings } from './AccountSettings';
import { ApiKeysSettings } from './ApiKeysSettings';
import { BillingSettings } from './BillingSettings';
import { DataPrivacySettings } from './DataPrivacySettings';
import { GeneralSettings } from './GeneralSettings';
import { LLMSettings } from './LLMSettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const { text } = useLocalizedText();

  const settingsTabs = [
    { id: 'general', label: text('General', '\u901a\u7528'), icon: Monitor },
    { id: 'llm', label: text('LLM Configuration', 'LLM \u914d\u7f6e'), icon: Sparkles },
    { id: 'billing', label: text('Billing & Usage', '\u8d26\u5355\u4e0e\u7528\u91cf'), icon: Receipt },
    { id: 'wallet', label: text('Account', '\u8d26\u6237'), icon: Wallet },
    { id: 'account', label: text('Profile Settings', '\u4e2a\u4eba\u8d44\u6599\u8bbe\u7f6e'), icon: User },
    { id: 'notifications', label: text('Notifications', '\u901a\u77e5'), icon: Bell },
    { id: 'security', label: text('Security', '\u5b89\u5168'), icon: Shield },
    { id: 'api', label: text('API Keys', 'API \u5bc6\u94a5'), icon: Key },
    { id: 'data', label: text('Data & Privacy', '\u6570\u636e\u4e0e\u9690\u79c1'), icon: Database },
  ];

  const requestedTab = searchParams.get('tab');
  const activeTab = settingsTabs.some((tab) => tab.id === requestedTab) ? requestedTab || 'general' : 'general';

  const filteredTabs = settingsTabs.filter((tab) =>
    tab.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="p-6 pb-4">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {text('Settings', '\u8bbe\u7f6e')}
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              type="text"
              placeholder={text('Search settings...', '\u641c\u7d22\u8bbe\u7f6e...')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="py-2.5 pl-9 pr-4 text-[13px]"
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
                  onClick={() => {
                    const nextSearchParams = new URLSearchParams(searchParams);
                    if (tab.id === 'general') {
                      nextSearchParams.delete('tab');
                    } else {
                      nextSearchParams.set('tab', tab.id);
                    }
                    setSearchParams(nextSearchParams, { replace: true });
                  }}
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
              {text('No settings found.', '\u672a\u627e\u5230\u5339\u914d\u7684\u8bbe\u7f6e\u9879\u3002')}
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
