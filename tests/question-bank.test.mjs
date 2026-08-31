import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSourceManifest } from '../skills/source-grounded-exam/scripts/inventory-sources.mjs';
import { validateQuestionBank, verifyEvidence } from '../skills/source-grounded-exam/scripts/validate-question-bank.mjs';

const blueprintUrl = new URL('./fixtures/blueprint.valid.json', import.meta.url);
const bankUrl = new URL('./fixtures/bank.valid.json', import.meta.url);

async function fixtureContext() {
  const blueprint = JSON.parse(await readFile(blueprintUrl, 'utf8'));
  const bank = JSON.parse(await readFile(bankUrl, 'utf8'));
  const manifest = await createSourceManifest(blueprint, blueprintUrl);
  assert.equal(manifest.sources[0].id, 'src-54dd0b2e3e7aea30');
  const texts = Object.fromEntries(await Promise.all(manifest.sources.map(async source => [
    source.id,
    await readFile(source.absolutePath, 'utf8'),
  ])));
  return { bank, blueprint, manifest, texts };
}

test('valid bank passes evidence and consensus gates', async () => {
  const context = await fixtureContext();
  assert.deepEqual(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts), []);
});

test('open question without accepted consensus is rejected', async () => {
  const context = await fixtureContext();
  context.bank.questions.find(question => question.type === 'open').consensus.passes[0].verdict = 'revise';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /must have unanimous accepted consensus/);
});

test('evidence quote must occur inside its declared line range', async () => {
  const context = await fixtureContext();
  context.bank.questions[0].evidence[0].quote = 'This sentence is absent.';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /evidence quote not found/);
});

test('bank hashes must match the supplied blueprint and manifest', async () => {
  const context = await fixtureContext();
  context.bank.blueprintHash = 'wrong-blueprint-hash';
  context.bank.sourceManifestHash = 'wrong-manifest-hash';
  const errors = validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n');
  assert.match(errors, /blueprintHash must match blueprint[\s\S]*sourceManifestHash must match manifest/);
});

test('question IDs must be unique', async () => {
  const context = await fixtureContext();
  context.bank.questions[1].id = context.bank.questions[0].id;
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /duplicate question id/);
});

test('normalized stems and prompts must be unique', async () => {
  const context = await fixtureContext();
  context.bank.questions[2].stem = `  ${context.bank.questions[0].stem.toUpperCase()}  `;
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /duplicate normalized question prompt/);
});

test('topic and type counts must exactly match the blueprint', async () => {
  const context = await fixtureContext();
  context.bank.questions[2].topicId = 'evidenz';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /topic statistik singleChoice count 1 must equal 2/);
});

test('difficulty counts must exactly match the blueprint', async () => {
  const context = await fixtureContext();
  context.bank.questions[0].difficulty = 'hard';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /difficulty easy count 1 must equal 2/);
});

test('single-choice options must have distinct IDs and text', async () => {
  const context = await fixtureContext();
  context.bank.questions[0].options[3] = structuredClone(context.bank.questions[0].options[2]);
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /exactly four distinct options/);
});

test('correct option ID must reference one of the four options', async () => {
  const context = await fixtureContext();
  context.bank.questions[0].correctOptionId = 'A';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /correctOptionId must identify exactly one option/);
});

test('single-choice rationale must be non-empty', async () => {
  const context = await fixtureContext();
  context.bank.questions[0].rationale = '  ';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /rationale must be a non-empty string/);
});

test('open questions must have four distinct criteria', async () => {
  const context = await fixtureContext();
  const question = context.bank.questions.find(candidate => candidate.type === 'open');
  question.criteria[3] = question.criteria[0];
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /exactly four distinct criteria/);
});

test('question text must differ from answer text', async () => {
  const context = await fixtureContext();
  const question = context.bank.questions.find(candidate => candidate.type === 'open');
  question.modelAnswer = question.prompt;
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /question text must not equal its answer text/);
});

test('evidence must reference a source in the manifest', async () => {
  const context = await fixtureContext();
  context.bank.questions[0].evidence[0].sourceId = 'src-unknown';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /references unknown source ID src-unknown/);
});

test('evidence line ranges must be valid source line numbers', async () => {
  const context = await fixtureContext();
  const evidence = structuredClone(context.bank.questions[0].evidence);
  evidence[0].lineStart = 0;
  assert.match(verifyEvidence(evidence, context.texts).join('\n'), /evidence quote not found inside declared line range/);
});

test('open consensus allows only cycles one and two', async () => {
  const context = await fixtureContext();
  context.bank.questions.find(question => question.type === 'open').consensus.cycle = 3;
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /must have unanimous accepted consensus/);
});

test('open consensus requires one pass for each isolated role', async () => {
  const context = await fixtureContext();
  const consensus = context.bank.questions.find(question => question.type === 'open').consensus;
  consensus.passes[1].role = 'evidence-verifier';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /must have unanimous accepted consensus/);
});

test('open consensus requires accepted adjudication', async () => {
  const context = await fixtureContext();
  context.bank.questions.find(question => question.type === 'open').consensus.adjudication.verdict = 'revise';
  assert.match(validateQuestionBank(context.bank, context.blueprint, context.manifest, context.texts).join('\n'), /must have unanimous accepted consensus/);
});

test('bank CLI reloads manifest sources and reports a valid bank', async () => {
  const context = await fixtureContext();
  const directory = await mkdtemp(join(tmpdir(), 'exam-bank-cli-'));
  const manifestPath = join(directory, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(context.manifest));
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../skills/source-grounded-exam/scripts/validate-question-bank.mjs', import.meta.url)),
    '--bank', fileURLToPath(bankUrl),
    '--blueprint', fileURLToPath(blueprintUrl),
    '--manifest', manifestPath,
  ], { encoding: 'utf8' });
  assert.deepEqual({ status: result.status, output: JSON.parse(result.stdout) }, {
    status: 0,
    output: { ok: true, errors: [], questionCount: 6 },
  });
});

test('bank CLI exits one and reports validation errors', async () => {
  const context = await fixtureContext();
  const directory = await mkdtemp(join(tmpdir(), 'exam-bank-cli-'));
  const manifestPath = join(directory, 'manifest.json');
  const bankPath = join(directory, 'bank.json');
  context.bank.questions[0].evidence[0].quote = 'Absent evidence.';
  await Promise.all([
    writeFile(manifestPath, JSON.stringify(context.manifest)),
    writeFile(bankPath, JSON.stringify(context.bank)),
  ]);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../skills/source-grounded-exam/scripts/validate-question-bank.mjs', import.meta.url)),
    '--bank', bankPath,
    '--blueprint', fileURLToPath(blueprintUrl),
    '--manifest', manifestPath,
  ], { encoding: 'utf8' });
  const output = JSON.parse(result.stdout);
  assert.ok(result.status === 1 && output.ok === false && output.questionCount === 6 && output.errors.some(error => /evidence quote not found/.test(error)));
});
