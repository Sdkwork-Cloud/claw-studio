import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { Section } from './Shared';
import { settingsService, UserProfile } from '../../services/settingsService';
import { toast } from 'sonner';

export function AccountSettings() {
  const [profile, setProfile] = useState<UserProfile>({ firstName: '', lastName: '', email: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const data = await settingsService.getProfile();
        setProfile(data);
      } catch (error) {
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.updateProfile(profile);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await settingsService.signOut();
      toast.success('Signed out successfully');
      // In a real app, redirect to login page
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Account</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Update your profile and personal details.</p>
      </div>

      <div className="space-y-6">
        <Section title="Profile">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 text-2xl font-bold shrink-0">
              {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
            </div>
            <div>
              <button 
                onClick={() => toast.success('Avatar update simulated')}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium shadow-sm mb-2"
              >
                Change Avatar
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">JPG, GIF or PNG. Max size of 800K</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">First Name</label>
              <input 
                type="text" 
                value={profile.firstName} 
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Last Name</label>
              <input 
                type="text" 
                value={profile.lastName} 
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors" 
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Email Address</label>
              <input 
                type="email" 
                value={profile.email} 
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none transition-colors" 
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Section>

        <Section title="Danger Zone">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Sign Out</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Sign out of your Claw Studio account on this device.</div>
            </div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-red-600 dark:text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-colors text-sm font-medium shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
