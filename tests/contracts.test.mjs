import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateBlueprint, stableStringify, sha256 } from '../skills/source-grounded-exam/scripts/lib/contracts.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/blueprint.valid.json', import.meta.url), 'utf8'));

test('valid blueprint has no errors', () => {
  assert.deepEqual(validateBlueprint(fixture), []);
});

test('topic and difficulty totals must equal the question total', () => {
  const value = structuredClone(fixture);
  value.difficultyCounts.hard = 2;
  assert.match(validateBlueprint(value).join('\n'), /difficultyCounts total 7 must equal question total 6/);
});

test('stable serialization and hashes ignore object insertion order', () => {
  assert.equal(stableStringify({b: 2, a: 1}), '{"a":1,"b":2}');
  assert.equal(sha256({b: 2, a: 1}), sha256({a: 1, b: 2}));
});
