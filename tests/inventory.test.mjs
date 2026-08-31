import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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

test('absolute explicit source files use a portable canonical relative path', async () => {
  const value = structuredClone(blueprint);
  const absoluteSourcePath = fileURLToPath(new URL('./fixtures/sources/sample.md', import.meta.url));
  value.sourcePaths = [absoluteSourcePath];
  const manifest = await createSourceManifest(value, blueprintUrl);
  assert.equal(manifest.sources[0].relativePath, basename(absoluteSourcePath));
  assert.doesNotMatch(manifest.sources[0].relativePath, /[A-Za-z]:|Users|\\/);
  assert.equal(manifest.sources[0].id, 'src-9aa8614af047199c');
});

test('existing extensionless explicit files fail closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'exam-inventory-'));
  const extensionlessPath = join(directory, 'notes');
  await writeFile(extensionlessPath, 'Not a supported source.');
  const value = structuredClone(blueprint);
  value.sourcePaths = [extensionlessPath];
  await assert.rejects(() => createSourceManifest(value, blueprintUrl), /Unsupported source extension/);
});
