import React from 'react';
import { Database, Download, AlertTriangle, Trash2 } from 'lucide-react';
import { Section, ToggleRow } from './Shared';

export function DataPrivacySettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Data & Privacy</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Control your data, telemetry, and account deletion.</p>
      </div>

      <div className="space-y-6">
        <Section title="Telemetry & Analytics">
          <div className="space-y-4">
            <ToggleRow 
              title="Share usage data" 
              description="Help us improve Claw Studio by sharing anonymous usage statistics and crash reports."
              enabled={true}
            />
            <ToggleRow 
              title="Personalized recommendations" 
              description="Allow us to suggest skills and packs based on your installed devices."
              enabled={true}
            />
          </div>
        </Section>

        <Section title="Export Data">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Download your data</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">Get a copy of your OpenClaw data, including device configurations, installed skills, and task history in JSON format.</p>
              <button className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium shadow-sm">
                <Download className="w-4 h-4" />
                Request Data Export
              </button>
            </div>
          </div>
        </Section>

        <Section title="Delete Account">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Permanently delete account</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">Once you delete your account, there is no going back. Please be certain. All your devices will be unlinked and data will be permanently erased.</p>
              <button className="flex items-center gap-2 bg-red-600 dark:bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm font-medium shadow-sm">
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
