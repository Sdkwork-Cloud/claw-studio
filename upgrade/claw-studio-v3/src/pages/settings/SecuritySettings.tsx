import React, { useState, useEffect } from 'react';
import { Smartphone, Laptop } from 'lucide-react';
import { Section, ToggleRow } from './Shared';
import { settingsService, UserPreferences } from '../../services/settingsService';
import { toast } from 'sonner';

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences['security'] | null>(null);

  useEffect(() => {
    settingsService.getPreferences().then(p => setPrefs(p.security));
  }, []);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsUpdating(true);
    try {
      await settingsService.updatePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggle = async (key: keyof UserPreferences['security']) => {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    try {
      await settingsService.updatePreferences({ security: { ...prefs, [key]: newValue } });
    } catch (error) {
      setPrefs({ ...prefs, [key]: !newValue });
      toast.error('Failed to update preference');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Security</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your password and secure your account.</p>
      </div>

      <div className="space-y-6">
        <Section title="Change Password">
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Current Password</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors" 
              />
            </div>
            <div className="pt-2">
              <button 
                onClick={handleUpdatePassword}
                disabled={isUpdating}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </Section>

        <Section title="Two-Factor Authentication">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-primary-500 dark:text-primary-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Authenticator App</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">Use an app like Google Authenticator or 1Password to generate one-time codes.</p>
              <button 
                onClick={() => handleToggle('twoFactorAuth')}
                className={`border px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${
                  prefs?.twoFactorAuth 
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20' 
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {prefs?.twoFactorAuth ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </Section>

        <Section title="Security Alerts">
          <div className="space-y-4">
            {prefs && (
              <ToggleRow 
                title="Login Alerts" 
                description="Get notified when anyone logs into your account from an unrecognized device."
                enabled={prefs.loginAlerts}
                onToggle={() => handleToggle('loginAlerts')}
              />
            )}
          </div>
        </Section>

        <Section title="Active Sessions">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <Laptop className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">MacBook Pro - Safari</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">San Francisco, CA • Active now</div>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">Current</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <Smartphone className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">iPhone 13 - Claw Studio App</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">San Francisco, CA • Last active 2 hours ago</div>
                </div>
              </div>
              <button 
                onClick={() => toast.success('Session revoked successfully')}
                className="text-sm text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
              >
                Revoke
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
