import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@sdkwork/claw-core';
import { useLocalizedText } from '@sdkwork/claw-i18n';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { Section } from './Shared';
import { settingsService, type UserProfile } from './services';

export function AccountSettings() {
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut, syncUserProfile } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { text } = useLocalizedText();

  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    }

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const data = await settingsService.getProfile();
        setProfile(data);
      } catch {
        toast.error(text('Failed to load profile', '\u52a0\u8f7d\u4e2a\u4eba\u8d44\u6599\u5931\u8d25'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProfile();
  }, [isAuthenticated, user]);

  const handleSave = async () => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await settingsService.updateProfile(profile);
      syncUserProfile(updatedProfile);
      toast.success(
        text('Profile updated successfully', '\u4e2a\u4eba\u8d44\u6599\u5df2\u66f4\u65b0'),
      );
    } catch {
      toast.error(
        text('Failed to update profile', '\u66f4\u65b0\u4e2a\u4eba\u8d44\u6599\u5931\u8d25'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      await settingsService.signOut();
      await signOut();
      toast.success(text('Signed out successfully', '\u5df2\u6210\u529f\u9000\u51fa\u767b\u5f55'));
      navigate('/login', { replace: true });
    } catch {
      toast.error(text('Failed to sign out', '\u9000\u51fa\u767b\u5f55\u5931\u8d25'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center space-y-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {text('Account', '\u8d26\u6237')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {text(
              'Sign in to manage your profile and personal details.',
              '\u767b\u5f55\u540e\u5373\u53ef\u7ba1\u7406\u4f60\u7684\u4e2a\u4eba\u8d44\u6599\u4e0e\u8d26\u6237\u8bbe\u7f6e\u3002',
            )}
          </p>
        </div>

        <Section title={text('Sign In Required', '\u9700\u8981\u767b\u5f55')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {text('You are currently signed out.', '\u5f53\u524d\u5c1a\u672a\u767b\u5f55\u3002')}
              </div>
              <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {text(
                  'Go to the login page to update your profile or sign in again.',
                  '\u8bf7\u524d\u5f80\u767b\u5f55\u9875\u9762\u540e\u518d\u7f16\u8f91\u4e2a\u4eba\u8d44\u6599\u6216\u91cd\u65b0\u767b\u5f55\u3002',
                )}
              </div>
            </div>
            <Button
              onClick={() => navigate('/login?redirect=%2Fsettings%3Ftab%3Daccount')}
              className="min-w-[140px]"
            >
              {text('Go to Login', '\u524d\u5f80\u767b\u5f55')}
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {text('Account', '\u8d26\u6237')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {text(
            'Update your profile and personal details.',
            '\u66f4\u65b0\u4f60\u7684\u4e2a\u4eba\u8d44\u6599\u4e0e\u8be6\u7ec6\u4fe1\u606f\u3002',
          )}
        </p>
      </div>

      <div className="space-y-6">
        <Section title={text('Profile', '\u4e2a\u4eba\u8d44\u6599')}>
          <div className="mb-6 flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success(
                    text('Avatar update simulated', '\u5df2\u6a21\u62df\u5934\u50cf\u66f4\u65b0'),
                  )
                }
                className="mb-2"
              >
                {text('Change Avatar', '\u66f4\u6362\u5934\u50cf')}
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {text(
                  'JPG, GIF or PNG. Max size of 800K',
                  '\u652f\u6301 JPG\u3001GIF \u6216 PNG\uff0c\u6700\u5927 800K',
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">
                {text('First Name', '\u540d')}
              </Label>
              <Input
                type="text"
                value={profile.firstName}
                onChange={(event) =>
                  setProfile({ ...profile, firstName: event.target.value })
                }
              />
            </div>
            <div>
              <Label className="mb-2 block">
                {text('Last Name', '\u59d3')}
              </Label>
              <Input
                type="text"
                value={profile.lastName}
                onChange={(event) =>
                  setProfile({ ...profile, lastName: event.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-2 block">
                {text('Email Address', '\u90ae\u7bb1\u5730\u5740')}
              </Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(event) =>
                  setProfile({ ...profile, email: event.target.value })
                }
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? text('Saving...', '\u4fdd\u5b58\u4e2d...')
                : text('Save Changes', '\u4fdd\u5b58\u66f4\u6539')}
            </Button>
          </div>
        </Section>

        <Section title={text('Danger Zone', '\u5371\u9669\u64cd\u4f5c')}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {text('Sign Out', '\u9000\u51fa\u767b\u5f55')}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {text(
                  'Sign out of your Claw Studio account on this device.',
                  '\u5728\u5f53\u524d\u8bbe\u5907\u4e0a\u9000\u51fa\u4f60\u7684 Claw Studio \u8d26\u6237\u3002',
                )}
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {text('Sign Out', '\u9000\u51fa\u767b\u5f55')}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
