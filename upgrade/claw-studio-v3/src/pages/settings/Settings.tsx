import React, { useState, useEffect } from 'react';
import { User, Bell, Monitor, Shield, Database, Key, Search, Sparkles, Receipt } from 'lucide-react';
import { motion } from 'motion/react';
import { GeneralSettings } from './GeneralSettings';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';
import { ApiKeysSettings } from './ApiKeysSettings';
import { DataPrivacySettings } from './DataPrivacySettings';
import { LLMSettings } from './LLMSettings';
import { BillingSettings } from './BillingSettings';
import { useLocation } from 'react-router-dom';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Monitor },
  { id: 'llm', label: 'LLM Configuration', icon: Sparkles },
  { id: 'billing', label: 'Billing & Usage', icon: Receipt },
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'data', label: 'Data & Privacy', icon: Database },
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

  const filteredTabs = SETTINGS_TABS.filter(tab => 
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTabInfo = SETTINGS_TABS.find(t => t.id === activeTab);
  const ActiveIcon = activeTabInfo?.icon || Monitor;

  return (
    <div className="flex h-full bg-zinc-50/50 dark:bg-zinc-950/50">
      {/* Settings Sidebar */}
      <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl shrink-0 flex flex-col">
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">Settings</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500 transition-all shadow-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            />
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto pb-6 scrollbar-hide">
          {filteredTabs.length > 0 ? (
            filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${isActive ? 'text-primary-500 dark:text-primary-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
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

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="max-w-5xl mx-auto p-8 md:p-12 w-full">
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


