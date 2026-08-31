import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSourceManifest } from '../skills/source-grounded-exam/scripts/inventory-sources.mjs';

const blueprintUrl = new URL('./fixtures/blueprint.valid.json', import.meta.url);
const blueprint = JSON.parse(await readFile(blueprintUrl, 'utf8'));

test('inventory is sorted, fingerprinted, and deterministic', async () => {
  const first = await createSourceManifest(blueprint, blueprintUrl);
  const second = await createSourceManifest(blueprint, blueprintUrl);
  assert.deepEqual(first, second);
  assert.equal(first.sources.length, 1);
  assert.equal(first.sources[0].relativePath, 'sources/sample.md');
  assert.match(first.sources[0].id, /^src-[a-f0-9]{16}$/);
  assert.equal(first.sources[0].headings[0].text, 'Statistik');
});

test('unsupported source extensions fail closed', async () => {
  const value = structuredClone(blueprint);
  value.sourcePaths = ['sources/sample.exe'];
  await assert.rejects(() => createSourceManifest(value, blueprintUrl), /Unsupported source extension/);
});
