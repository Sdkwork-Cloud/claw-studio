import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@sdkwork/claw-core';
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
  const { t } = useTranslation();

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
        toast.error(t('settings.account.toasts.loadFailed'));
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
      toast.success(t('settings.account.toasts.updated'));
    } catch {
      toast.error(t('settings.account.toasts.updateFailed'));
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
      await signOut();
      toast.success(t('settings.account.toasts.signedOut'));
      navigate('/login', { replace: true });
    } catch {
      toast.error(t('settings.account.toasts.signOutFailed'));
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
            {t('settings.account.title')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('settings.account.signedOutDescription')}
          </p>
        </div>

        <Section title={t('settings.account.signInRequired')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t('settings.account.signedOut')}
              </div>
              <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('settings.account.signInPrompt')}
              </div>
            </div>
            <Button
              onClick={() => navigate('/login?redirect=%2Fsettings%3Ftab%3Daccount')}
              className="min-w-[140px]"
            >
              {t('settings.account.goToLogin')}
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
          {t('settings.account.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.account.description')}
        </p>
      </div>

      <div className="space-y-6">
        <Section title={t('settings.account.profileTitle')}>
          <div className="mb-6 flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success(t('settings.account.toasts.avatarSimulated'))
                }
                className="mb-2"
              >
                {t('settings.account.changeAvatar')}
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('settings.account.avatarHint')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">
                {t('settings.account.firstName')}
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
                {t('settings.account.lastName')}
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
                {t('settings.account.email')}
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
                ? t('settings.account.saving')
                : t('settings.account.saveChanges')}
            </Button>
          </div>
        </Section>

        <Section title={t('settings.account.dangerZone')}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t('settings.account.signOut')}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('settings.account.signOutDescription')}
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {t('settings.account.signOut')}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
