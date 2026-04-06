import assert from 'node:assert/strict';
import { parseJson5, stringifyJson5 } from './json5Compat.ts';

async function runTest(name: string, callback: () => void | Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'json5Compat parses comments, trailing commas, single-quoted strings, and unquoted object keys',
  () => {
    const parsed = parseJson5<{
      name: string;
      enabled: boolean;
      nested: { mode: string };
      items: number[];
    }>(`{
      // comment
      name: 'openclaw',
      enabled: true,
      nested: {
        mode: 'managed',
      },
      items: [1, 2, 3,],
    }`);

    assert.deepEqual(parsed, {
      name: 'openclaw',
      enabled: true,
      nested: {
        mode: 'managed',
      },
      items: [1, 2, 3],
    });
  },
);

await runTest('json5Compat stringifies objects as stable JSON text', () => {
  assert.equal(
    stringifyJson5(
      {
        enabled: true,
        items: [1, 2],
      },
      2,
    ),
    '{\n  enabled: true,\n  items: [\n    1,\n    2\n  ]\n}',
  );
});
