import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function assertContains(source: string, pattern: RegExp, message: string) {
  assert.match(source, pattern, message);
}

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('sidebar keeps the v3 translation-driven navigation contract', () => {
  const source = read('packages/claw-studio-shell/src/components/Sidebar.tsx');

  assertContains(source, /useTranslation/, 'Sidebar should import useTranslation like v3');
  assertContains(source, /t\('sidebar\.workspace'/, 'Sidebar should translate workspace labels');
  assertContains(source, /t\('sidebar\.selectInstance'/, 'Sidebar should translate instance selector copy');
  assertContains(source, /t\('sidebar\.documentation'/, 'Sidebar should translate footer links');
  assertContains(source, /t\('sidebar\.settings'/, 'Sidebar should translate settings copy');
});

await runTest('account page keeps the v3 translation contract', () => {
  const source = read('packages/claw-studio-account/src/pages/account/Account.tsx');

  assertContains(source, /useTranslation/, 'Account page should import useTranslation like v3');
  assertContains(source, /t\('account\.title'/, 'Account title should come from v3 locale keys');
  assertContains(source, /t\('account\.recharge'/, 'Account actions should come from v3 locale keys');
  assertContains(source, /t\('common\.cancel'/, 'Account modal cancel buttons should use the v3 fallback key pattern');
});

await runTest('settings page keeps the v3 tab order and shell sizing', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/Settings.tsx');
  const billingIndex = source.indexOf("{ id: 'billing'");
  const accountIndex = source.indexOf("{ id: 'account'");

  assertContains(source, /Receipt/, 'Settings should keep the v3 billing icon');
  assert.equal(billingIndex >= 0, true, 'Billing tab should exist');
  assert.equal(accountIndex >= 0, true, 'Account tab should exist');
  assert.equal(billingIndex < accountIndex, true, 'Billing tab should stay ahead of account like v3');
  assertContains(source, /w-72/, 'Settings sidebar width should match v3');
  assertContains(source, /text-2xl/, 'Settings title sizing should match v3');
});

await runTest('general settings keeps the v3 persisted startup preference flow', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/GeneralSettings.tsx');

  assertContains(source, /settingsService\.getPreferences/, 'General settings should load persisted preferences like v3');
  assertContains(source, /settingsService\.updatePreferences/, 'General settings should save persisted preferences like v3');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('launchOnStartup'\)\}/, 'Launch-on-startup should be wired to persisted state');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('startMinimized'\)\}/, 'Start-minimized should be wired to persisted state');
  assert.equal(/Application Updates/.test(source), false, 'General settings should not inject non-v3 update UI');
});

await runTest('theme manager keeps the v3 system theme listener behavior', () => {
  const source = read('packages/claw-studio-shell/src/application/providers/ThemeManager.tsx');

  assertContains(source, /const applyTheme = \(\) =>/, 'ThemeManager should wrap DOM mutations in applyTheme like v3');
  assertContains(source, /mediaQuery\.addEventListener\('change', handleChange\)/, 'ThemeManager should react to system theme changes');
  assertContains(source, /return \(\) => mediaQuery\.removeEventListener\('change', handleChange\)/, 'ThemeManager should clean up the system theme listener');
});

await runTest('command palette command set keeps the v3 navigation surface', () => {
  const source = read('packages/claw-studio-shell/src/components/commandPaletteCommands.ts');

  assert.equal(/id: 'nav-account'/.test(source), false, 'Command palette should not add non-v3 account navigation entries');
  assert.equal(/id: 'nav-extensions'/.test(source), false, 'Command palette should not add non-v3 extensions navigation entries');
  assertContains(source, /id: 'nav-settings'/, 'Command palette should keep the v3 settings command');
  assertContains(source, /id: 'action-terminal'/, 'Command palette should keep the v3 terminal action');
  assertContains(source, /subtitle: `\$\{instance\.ip\} • \$\{instance\.status\}`/, 'Command palette instance commands should keep the v3 bullet separator');
});

await runTest('command palette shell keeps the v3 keyboard hint footer', () => {
  const source = read('packages/claw-studio-shell/src/components/CommandPalette.tsx');

  assertContains(source, />↑</, 'Command palette footer should keep the v3 up-arrow key hint');
  assertContains(source, />↓</, 'Command palette footer should keep the v3 down-arrow key hint');
  assertContains(source, />↵</, 'Command palette footer should keep the v3 enter key hint');
});

await runTest('global task manager keeps the v3 scroll container affordance', () => {
  const source = read('packages/claw-studio-shell/src/components/GlobalTaskManager.tsx');

  assertContains(source, /scrollbar-hide/, 'Global task manager should keep the v3 scrollbar-hide class');
});

await runTest('settings shared toggle keeps the v3 controlled-toggle contract', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/Shared.tsx');

  assertContains(source, /onToggle\?: \(\) => void/, 'ToggleRow should accept an optional onToggle callback like v3');
  assertContains(source, /React\.useEffect\(\(\) => \{\s*setLocalEnabled\(enabled\);/m, 'ToggleRow should resync local state when enabled changes');
  assertContains(source, /if \(onToggle\) \{\s*onToggle\(\);/m, 'ToggleRow should call the callback after local toggle like v3');
});

await runTest('notification settings keeps the v3 persisted notification preference flow', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/NotificationSettings.tsx');

  assertContains(source, /settingsService\.getPreferences/, 'Notification settings should load persisted preferences like v3');
  assertContains(source, /settingsService\.updatePreferences/, 'Notification settings should save persisted preferences like v3');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('systemUpdates'\)\}/, 'System updates toggle should be wired to persisted state');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('taskFailures'\)\}/, 'Task failures toggle should be wired to persisted state');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('securityAlerts'\)\}/, 'Security alerts toggle should be wired to persisted state');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('taskCompletions'\)\}/, 'Task completions toggle should be wired to persisted state');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('newMessages'\)\}/, 'New messages toggle should be wired to persisted state');
});

await runTest('data privacy settings keeps the v3 persisted privacy preference and feedback flow', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/DataPrivacySettings.tsx');

  assertContains(source, /settingsService\.getPreferences/, 'Data privacy settings should load persisted preferences like v3');
  assertContains(source, /settingsService\.updatePreferences/, 'Data privacy settings should save persisted preferences like v3');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('shareUsageData'\)\}/, 'Share usage data should be wired to persisted state');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('personalizedRecommendations'\)\}/, 'Personalized recommendations should be wired to persisted state');
  assertContains(source, /toast\.success\('Data export requested\. You will receive an email shortly\.'\)/, 'Data export should keep the v3 success feedback');
  assertContains(source, /toast\.success\('Account deletion initiated\. Please check your email to confirm\.'\)/, 'Delete account should keep the v3 success feedback');
});

await runTest('security settings keeps the v3 persisted security preference and feedback flow', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/SecuritySettings.tsx');

  assertContains(source, /settingsService\.getPreferences/, 'Security settings should load persisted preferences like v3');
  assertContains(source, /settingsService\.updatePreferences/, 'Security settings should save persisted preferences like v3');
  assertContains(source, /Section title="Security Alerts"/, 'Security settings should keep the v3 login alerts section');
  assertContains(source, /onToggle=\{\(\) => handleToggle\('loginAlerts'\)\}/, 'Login alerts should be wired to persisted state');
  assertContains(source, /onClick=\{\(\) => handleToggle\('twoFactorAuth'\)\}/, 'Two-factor button should toggle persisted state like v3');
  assertContains(source, /toast\.success\('Session revoked successfully'\)/, 'Revoke action should keep the v3 success feedback');
});

await runTest('account settings keeps the v3 avatar feedback affordance', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/AccountSettings.tsx');

  assertContains(source, /onClick=\{\(\) => toast\.success\('Avatar update simulated'\)\}/, 'Change Avatar button should keep the v3 success feedback');
});

await runTest('api keys settings keeps the v3 usage column contract', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/ApiKeysSettings.tsx');

  assertContains(source, /USAGE \(MTD\)/, 'API keys settings should keep the v3 usage column');
  assertContains(source, /colSpan=\{6\}/, 'API keys empty state should span the v3 column count');
  assertContains(source, /Math\.random\(\) \* 50/, 'API keys rows should keep the v3 usage placeholder rendering');
});

await runTest('llm settings keeps the v3 hero copy and emoji channel affordance', () => {
  const source = read('packages/claw-studio-settings/src/pages/settings/LLMSettings.tsx');

  assertContains(source, /global generation parameters for the ultimate control\./, 'LLM settings hero copy should match the v3 wording');
  assertContains(source, /Icon \(Emoji\)/, 'LLM settings channel form should keep the v3 emoji label');
  assert.equal(/generation parameters per instance\./.test(source), false, 'LLM settings should not keep the non-v3 hero copy');
  assert.equal(/icon: '◆'/.test(source), false, 'LLM settings should not keep the non-v3 fallback icon glyph');
  assert.equal(/placeholder="◆"/.test(source), false, 'LLM settings should not keep the non-v3 icon placeholder glyph');
});

await runTest('market page keeps the v3 installed-skill management surface', () => {
  const source = read('packages/claw-studio-market/src/pages/market/Market.tsx');

  assertContains(source, /useInstanceStore/, 'Market should read the active instance like v3');
  assertContains(source, /mySkillService/, 'Market should use the installed-skill service like v3');
  assertContains(source, /activeMarketTab, setActiveMarketTab\] = useState<'skills' \| 'packages' \| 'myskills'>\('packages'\)/, 'Market should keep the v3 myskills tab state');
  assertContains(source, /queryKey: \['mySkills', activeInstanceId\]/, 'Market should query installed skills for the active instance');
  assertContains(source, /queryClient\.invalidateQueries\(\{ queryKey: \['mySkills', activeInstanceId\] \}\)/, 'Market should refresh installed skills after install and uninstall actions');
  assertContains(source, /activeMarketTab === 'myskills'/, 'Market should render the v3 myskills section');
  assertContains(source, /My Installed Skills/, 'Market should keep the v3 installed skills heading');
  assertContains(source, /Uninstall/, 'Market should keep the v3 uninstall action');
  assertContains(source, /h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto scrollbar-hide/, 'Market should keep the v3 scroll container shell');
});

await runTest('skill detail keeps the v3 installed-state and download workflow', () => {
  const source = read('packages/claw-studio-market/src/pages/market/SkillDetail.tsx');

  assertContains(source, /useInstanceStore/, 'Skill detail should read the active instance like v3');
  assertContains(source, /mySkillService/, 'Skill detail should use the installed-skill service like v3');
  assertContains(source, /const isInstalled = mySkills\.some\(s => s\.id === id\);/, 'Skill detail should compute installed state from the active instance like v3');
  assertContains(source, /marketService\.downloadSkillLocal\(skill,/, 'Skill detail should use the v3 local download service flow');
  assertContains(source, /mySkillService\.uninstallSkill\(activeInstanceId, skill\.id\)/, 'Skill detail should uninstall from the active instance like v3');
  assertContains(source, /queryClient\.invalidateQueries\(\{ queryKey: \['mySkills', activeInstanceId\] \}\)/, 'Skill detail should refresh installed skills after install and uninstall');
  assertContains(source, /isInstalled \? \(/, 'Skill detail CTA area should branch on installed state like v3');
});

await runTest('skill pack detail keeps the v3 installed-skill filtering workflow', () => {
  const source = read('packages/claw-studio-market/src/pages/market/SkillPackDetail.tsx');

  assertContains(source, /useInstanceStore/, 'Skill pack detail should read the active instance like v3');
  assertContains(source, /mySkillService/, 'Skill pack detail should use the installed-skill service like v3');
  assertContains(source, /const \{ data: mySkills = \[\] \}/, 'Skill pack detail should load installed skills like v3');
  assertContains(source, /pack\.skills\.filter\(s => !mySkills\.some\(ms => ms\.id === s\.id\)\)/, 'Skill pack detail should exclude already installed skills like v3');
  assertContains(source, /marketService\.downloadPackLocal\(pack,/, 'Skill pack detail should use the v3 local download service flow');
  assertContains(source, /queryClient\.invalidateQueries\(\{ queryKey: \['mySkills', activeInstanceId\] \}\)/, 'Skill pack detail should refresh installed skills after install');
});

await runTest('instances page keeps the v3 active-instance and lifecycle affordances', () => {
  const source = read('packages/claw-studio-instances/src/pages/instances/Instances.tsx');

  assertContains(source, /useInstanceStore/, 'Instances should read and update the active instance like v3');
  assertContains(source, /setActiveInstanceId/, 'Instances should keep the v3 active-instance setter');
  assertContains(source, /toast\.success\('Instance started'\)/, 'Instances should keep the v3 start success feedback');
  assertContains(source, /toast\.success\('Instance uninstalled'\)/, 'Instances should keep the v3 uninstall success feedback');
  assertContains(source, /handleAction\(e, 'delete', instance\.id\)/, 'Instances should keep the v3 uninstall action');
  assertContains(source, /Set Active/, 'Instances should keep the desktop active-instance CTA');
  assertContains(source, /Set as Active/, 'Instances should keep the mobile active-instance CTA');
  assertContains(source, /Est\. Cost/, 'Instances should keep the v3 estimated cost metric');
  assertContains(source, /API Tokens/, 'Instances should keep the v3 token usage metric');
  assertContains(source, /h-full overflow-y-auto scrollbar-hide/, 'Instances should keep the v3 scroll container shell');
});

await runTest('community page keeps the v3 scroll container shell', () => {
  const source = read('packages/claw-studio-community/src/pages/community/Community.tsx');

  assertContains(source, /h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto scrollbar-hide/, 'Community should keep the v3 scroll container shell');
});

await runTest('market service keeps the v3 local-download helpers and device payloads', () => {
  const source = read('packages/claw-studio-business/src/services/marketService.ts');

  assertContains(source, /downloadSkillLocal:\s*async\s*\(\s*skill: Skill,\s*onProgress: \(progress: number\) => void,\s*\)/m, 'Market service should expose the v3 skill download helper');
  assertContains(source, /downloadPackLocal:\s*async\s*\(\s*pack: SkillPack,\s*onProgress: \(progress: number\) => void,\s*\)/m, 'Market service should expose the v3 pack download helper');
  assertContains(source, /device_id: instanceId/, 'Market service should keep the v3 device_id installation payload');
  assertContains(source, /skill_ids: skillIds/, 'Market service should keep the v3 selective pack install payload');
});

await runTest('web server keeps the v3 selective pack-install route contract', () => {
  const source = read('packages/claw-studio-web/server.ts');

  assertContains(source, /const \{ device_id, pack_id, skill_ids \} = req\.body;/, 'Pack installation route should read skill_ids like v3');
  assertContains(source, /if \(skill_ids && Array\.isArray\(skill_ids\) && skill_ids\.length > 0\)/, 'Pack installation route should prefer explicit selected skills like v3');
  assertContains(source, /transaction\(skillsToInstall\);/, 'Pack installation route should transact the resolved skill list like v3');
});
