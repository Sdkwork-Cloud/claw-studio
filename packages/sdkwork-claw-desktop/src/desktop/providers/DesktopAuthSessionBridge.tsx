import { useEffectEvent } from 'react';
import { AuthStateBridge, type AuthStateSnapshot } from '@sdkwork/claw-shell';
import { clearDesktopAuthSession, syncDesktopAuthSession } from '../tauriBridge';

export function DesktopAuthSessionBridge() {
  const handleAuthStateChange = useEffectEvent((authState: AuthStateSnapshot) => {
    void (async () => {
      if (!authState.isAuthenticated || !authState.user?.email) {
        await clearDesktopAuthSession();
        return;
      }

      const normalizedEmail = authState.user.email.trim();
      await syncDesktopAuthSession({
        userId: normalizedEmail.toLowerCase(),
        email: normalizedEmail,
        displayName: authState.user.displayName.trim() || normalizedEmail,
      });
    })().catch((error) => {
      console.warn('[desktop-auth] failed to sync auth session', error);
    });
  });

  return <AuthStateBridge onChange={handleAuthStateChange} />;
}
