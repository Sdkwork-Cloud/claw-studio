import React from 'react';
import { Section, ToggleRow } from './Shared';

export function NotificationSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Notifications</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Choose what updates you want to receive.</p>
      </div>

      <div className="space-y-6">
        <Section title="Email Notifications">
          <div className="space-y-4">
            <ToggleRow 
              title="System Updates" 
              description="Receive emails about Claw Studio updates and new features."
              enabled={true}
            />
            <ToggleRow 
              title="Task Failures" 
              description="Get notified when a scheduled task fails to execute."
              enabled={true}
            />
            <ToggleRow 
              title="Security Alerts" 
              description="Receive alerts about unusual account activity."
              enabled={true}
            />
          </div>
        </Section>

        <Section title="Desktop Notifications">
          <div className="space-y-4">
            <ToggleRow 
              title="Task Completions" 
              description="Show a desktop notification when a task finishes successfully."
              enabled={false}
            />
            <ToggleRow 
              title="New Messages" 
              description="Notify me when I receive a new message in channels."
              enabled={true}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
