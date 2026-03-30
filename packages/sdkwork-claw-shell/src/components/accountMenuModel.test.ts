import assert from 'node:assert/strict';
import {
  MOBILE_APP_DOWNLOAD_URL,
  buildAuthenticatedAccountMenuSections,
  buildGuestAccountMenuSections,
  resolvePointsViewPath,
} from './accountMenuModel.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('account menu model exposes the official external mobile download url and view-aware points paths', () => {
  assert.equal(MOBILE_APP_DOWNLOAD_URL, 'https://clawstudio.sdkwork.com/download/app/mobile');
  assert.equal(resolvePointsViewPath('membership'), '/points?view=membership');
  assert.equal(resolvePointsViewPath('wallet'), '/points?view=wallet');
});

runTest('account menu model keeps authenticated actions grouped as summary, primary, and secondary flows', () => {
  const sections = buildAuthenticatedAccountMenuSections();

  assert.deepEqual(
    sections.map((section) => section.id),
    ['primary', 'secondary'],
  );
  assert.deepEqual(
    sections[0]?.actions.map((action) => action.id),
    ['membership-center', 'points-center', 'profile', 'settings', 'feedback'],
  );
  assert.deepEqual(
    sections[1]?.actions.map((action) => action.id),
    ['docs', 'sign-out'],
  );
});

runTest('account menu model keeps guest actions limited to guest-safe navigation', () => {
  const sections = buildGuestAccountMenuSections('/login?redirect=%2Fsettings');

  assert.deepEqual(
    sections.map((section) => section.id),
    ['primary', 'secondary'],
  );
  assert.deepEqual(
    sections[0]?.actions.map((action) => action.id),
    ['login', 'settings'],
  );
  assert.deepEqual(
    sections[1]?.actions.map((action) => action.id),
    ['docs'],
  );
  assert.equal(sections[0]?.actions[0]?.to, '/login?redirect=%2Fsettings');
});
