import assert from 'node:assert/strict';
import { getCodeBlockLanguageLabel, resolveCodeBlockLanguage } from './chatCodeLanguage.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('resolveCodeBlockLanguage normalizes common aliases to the registered Prism light set', async () => {
  assert.equal(resolveCodeBlockLanguage('ts'), 'typescript');
  assert.equal(resolveCodeBlockLanguage('TSX'), 'tsx');
  assert.equal(resolveCodeBlockLanguage('js'), 'javascript');
  assert.equal(resolveCodeBlockLanguage('shell'), 'bash');
  assert.equal(resolveCodeBlockLanguage('pwsh'), 'powershell');
  assert.equal(resolveCodeBlockLanguage('yml'), 'yaml');
  assert.equal(resolveCodeBlockLanguage('rs'), 'rust');
});

await runTest('resolveCodeBlockLanguage returns undefined for unsupported or missing languages', async () => {
  assert.equal(resolveCodeBlockLanguage('kotlin'), undefined);
  assert.equal(resolveCodeBlockLanguage(''), undefined);
  assert.equal(resolveCodeBlockLanguage(undefined), undefined);
});

await runTest('getCodeBlockLanguageLabel keeps the original label while providing a plain-text fallback', async () => {
  assert.equal(getCodeBlockLanguageLabel('tsx'), 'tsx');
  assert.equal(getCodeBlockLanguageLabel(' PowerShell '), 'PowerShell');
  assert.equal(getCodeBlockLanguageLabel(undefined), 'text');
});
