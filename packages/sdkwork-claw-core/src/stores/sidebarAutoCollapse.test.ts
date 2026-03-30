import assert from 'node:assert/strict';
import {
  resolveAutoSidebarCollapsed,
  shouldAutoCollapseSidebar,
} from './sidebarAutoCollapse.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('auto-collapse prefers compact viewports regardless of monitor size', () => {
  assert.equal(
    shouldAutoCollapseSidebar({
      viewportWidth: 1366,
      viewportHeight: 900,
      screenWidth: 2560,
      screenHeight: 1440,
      devicePixelRatio: 1,
    }),
    true,
  );
});

runTest('auto-collapse keeps roomy viewports expanded', () => {
  assert.equal(
    shouldAutoCollapseSidebar({
      viewportWidth: 1728,
      viewportHeight: 1080,
      screenWidth: 2560,
      screenHeight: 1440,
      devicePixelRatio: 1.25,
    }),
    false,
  );
});

runTest('auto-collapse tightens intermediate viewports on high-scale displays', () => {
  assert.equal(
    shouldAutoCollapseSidebar({
      viewportWidth: 1520,
      viewportHeight: 980,
      screenWidth: 2560,
      screenHeight: 1440,
      devicePixelRatio: 1.5,
    }),
    true,
  );
});

runTest('auto-collapse tightens intermediate viewports when vertical space is limited', () => {
  assert.equal(
    shouldAutoCollapseSidebar({
      viewportWidth: 1500,
      viewportHeight: 860,
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
    }),
    true,
  );
});

runTest('auto-collapse keeps comfortable intermediate viewports expanded', () => {
  assert.equal(
    shouldAutoCollapseSidebar({
      viewportWidth: 1500,
      viewportHeight: 980,
      screenWidth: 2560,
      screenHeight: 1440,
      devicePixelRatio: 1,
    }),
    false,
  );
});

runTest('auto-collapse resolves browser viewport and available screen metrics together', () => {
  assert.equal(
    resolveAutoSidebarCollapsed({
      innerWidth: 1510,
      innerHeight: 900,
      devicePixelRatio: 1.25,
      screen: {
        availWidth: 2560,
        availHeight: 1440,
      },
    } as Window),
    true,
  );
});
