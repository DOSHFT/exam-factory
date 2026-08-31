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

test('non-array topics return validation errors without throwing', () => {
  const value = structuredClone(fixture);
  value.topics = {};
  const errors = validateBlueprint(value);
  assert.ok(Array.isArray(errors));
  assert.match(errors.join('\n'), /topics must be a non-empty array/);
});

test('negative and non-integer difficulty values are rejected', () => {
  const value = structuredClone(fixture);
  value.difficultyCounts.easy = -1;
  value.difficultyCounts.medium = 1.5;
  const errors = validateBlueprint(value);
  assert.match(errors.join('\n'), /difficultyCounts easy must be a non-negative integer/);
  assert.match(errors.join('\n'), /difficultyCounts medium must be a non-negative integer/);
});

test('stable serialization and hashes ignore object insertion order', () => {
  assert.equal(stableStringify({b: 2, a: 1}), '{"a":1,"b":2}');
  assert.equal(sha256({b: 2, a: 1}), sha256({a: 1, b: 2}));
});
