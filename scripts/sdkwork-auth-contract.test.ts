import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-auth keeps the V5 auth entry surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-auth/package.json');
  const locales = readJson<{
    auth?: {
      qrLogin?: string;
      welcomeBack?: string;
      providers?: {
        wechat?: string;
        douyin?: string;
        github?: string;
        google?: string;
      };
      qrAlt?: string;
      qrRefresh?: string;
      qrScannedHint?: string;
      qrWeChatHint?: string;
      qrStatus?: {
        loading?: string;
        pending?: string;
        scanned?: string;
        confirmed?: string;
        expired?: string;
        error?: string;
      };
      errors?: {
        oauthStartFailed?: string;
        qrGenerateFailed?: string;
        qrStatusFailed?: string;
        invalidQrPayload?: string;
      };
      oauth?: {
        badge?: string;
        processingTitle?: string;
        failedTitle?: string;
        invalidProvider?: string;
        missingCode?: string;
      };
    };
  }>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const indexSource = read('packages/sdkwork-claw-auth/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-auth/src/pages/Auth.tsx'));
  assert.ok(exists('packages/sdkwork-claw-auth/src/pages/AuthPage.tsx'));
  assert.ok(exists('packages/sdkwork-claw-auth/src/pages/AuthOAuthCallbackPage.tsx'));
  assert.ok(exists('packages/sdkwork-claw-auth/src/pages/authRouteUtils.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-auth']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-auth/);
  assert.match(indexSource, /\.\/pages\/Auth/);
  assert.match(indexSource, /\.\/pages\/AuthOAuthCallbackPage/);

  const authSource = read('packages/sdkwork-claw-auth/src/pages/AuthPage.tsx');
  const callbackSource = read('packages/sdkwork-claw-auth/src/pages/AuthOAuthCallbackPage.tsx');
  const routeUtilsSource = read('packages/sdkwork-claw-auth/src/pages/authRouteUtils.ts');
  assert.match(authSource, /useTranslation/);
  assert.match(authSource, /t\('auth\.qrLogin'\)/);
  assert.match(authSource, /t\('auth\.welcomeBack'\)/);
  assert.match(authSource, /SOCIAL_PROVIDERS: AppAuthSocialProvider\[] = \['wechat', 'douyin', 'github', 'google'\]/);
  assert.match(authSource, /appAuthService\.generateLoginQrCode/);
  assert.match(authSource, /appAuthService\.checkLoginQrCodeStatus/);
  assert.match(authSource, /appAuthService\.getOAuthAuthorizationUrl/);
  assert.match(authSource, /buildOAuthCallbackUri/);
  assert.match(authSource, /t\('auth\.qrAlt'\)/);
  assert.match(authSource, /t\('auth\.qrRefresh'\)/);
  assert.match(authSource, /t\('auth\.qrScannedHint'\)/);
  assert.match(authSource, /t\('auth\.qrWeChatHint'\)/);
  assert.match(authSource, /t\('auth\.errors\.oauthStartFailed'\)/);
  assert.match(authSource, /t\('auth\.errors\.qrGenerateFailed'\)/);
  assert.match(authSource, /t\('auth\.errors\.qrStatusFailed'\)/);
  assert.match(authSource, /t\('auth\.errors\.invalidQrPayload'\)/);
  assert.match(callbackSource, /signInWithOAuth/);
  assert.match(callbackSource, /t\('auth\.oauth\.processingTitle'\)/);
  assert.match(callbackSource, /t\('auth\.oauth\.failedTitle'\)/);
  assert.match(callbackSource, /t\('auth\.oauth\.invalidProvider'\)/);
  assert.match(callbackSource, /t\('auth\.oauth\.missingCode'\)/);
  assert.match(routeUtilsSource, /\/login\/oauth\/callback\/\$\{provider\}/);
  assert.match(routeUtilsSource, /rawTarget\.startsWith\('\/login\/oauth\/callback'\)/);
  assert.equal(locales.auth?.qrLogin, 'Scan to Login');
  assert.equal(locales.auth?.welcomeBack, 'Welcome back');
  assert.equal(locales.auth?.providers?.wechat, 'WeChat');
  assert.equal(locales.auth?.providers?.douyin, 'Douyin');
  assert.equal(locales.auth?.providers?.github, 'GitHub');
  assert.equal(locales.auth?.providers?.google, 'Google');
  assert.equal(locales.auth?.qrAlt, 'Login QR code');
  assert.equal(locales.auth?.qrRefresh, 'Refresh QR code');
  assert.equal(locales.auth?.qrScannedHint, 'QR scanned. Confirm the login in WeChat to continue.');
  assert.equal(locales.auth?.qrWeChatHint, 'Supports WeChat official account QR sign-in from the backend.');
  assert.equal(locales.auth?.qrStatus?.loading, 'Preparing QR code...');
  assert.equal(locales.auth?.qrStatus?.pending, 'Scan the QR code to continue');
  assert.equal(locales.auth?.qrStatus?.scanned, 'QR code scanned');
  assert.equal(locales.auth?.qrStatus?.confirmed, 'Login confirmed');
  assert.equal(locales.auth?.qrStatus?.expired, 'QR code expired');
  assert.equal(locales.auth?.qrStatus?.error, 'QR status unavailable');
  assert.equal(locales.auth?.errors?.oauthStartFailed, 'Failed to start social sign-in.');
  assert.equal(locales.auth?.errors?.qrGenerateFailed, 'Failed to load the login QR code.');
  assert.equal(locales.auth?.errors?.qrStatusFailed, 'Failed to refresh QR login status.');
  assert.equal(locales.auth?.errors?.invalidQrPayload, 'The backend returned an invalid QR code payload.');
  assert.equal(locales.auth?.oauth?.badge, 'OAuth Sign-In');
  assert.equal(locales.auth?.oauth?.processingTitle, 'Completing sign-in');
  assert.equal(locales.auth?.oauth?.failedTitle, 'Sign-in failed');
  assert.equal(locales.auth?.oauth?.invalidProvider, 'Unsupported OAuth provider.');
  assert.equal(locales.auth?.oauth?.missingCode, 'Authorization code is missing.');
});

runTest('sdkwork-claw-auth leaves desktop window controls to the shared shell header', () => {
  const authSource = read('packages/sdkwork-claw-auth/src/pages/AuthPage.tsx');
  const callbackSource = read('packages/sdkwork-claw-auth/src/pages/AuthOAuthCallbackPage.tsx');

  assert.doesNotMatch(authSource, /DesktopWindowControls/);
  assert.doesNotMatch(authSource, /data-slot="auth-window-chrome"/);
  assert.doesNotMatch(authSource, /variant="floating"/);
  assert.doesNotMatch(callbackSource, /DesktopWindowControls/);
  assert.doesNotMatch(callbackSource, /data-slot="auth-window-chrome"/);
  assert.doesNotMatch(callbackSource, /variant="floating"/);
});
