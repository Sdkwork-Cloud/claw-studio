import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './Shared';
import { settingsService, type UserProfile } from './services';

export function AccountSettings() {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
  });
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
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center space-y-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Account
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Update your profile and personal details.
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Profile">
          <div className="mb-6 flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </div>
            <div>
              <button
                onClick={() => toast.success('Avatar update simulated')}
                className="mb-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Change Avatar
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                JPG, GIF or PNG. Max size of 800K
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                First Name
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(event) =>
                  setProfile({ ...profile, firstName: event.target.value })
                }
                className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Last Name
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(event) =>
                  setProfile({ ...profile, lastName: event.target.value })
                }
                className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(event) =>
                  setProfile({ ...profile, email: event.target.value })
                }
                className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Section>

        <Section title="Danger Zone">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Sign Out
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Sign out of your Claw Studio account on this device.
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-red-500 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
