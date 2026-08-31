import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/cli.mjs';
import { readJson, sha256 } from './lib/contracts.mjs';

const REQUIRED_PASS_ROLES = new Set(['evidence-verifier', 'quality-reviewer']);
const QUESTION_TYPES = new Set(['single-choice', 'open']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const normalizeEvidence = text => text.replace(/\s+/g, ' ').trim();
const normalizeQuestionText = text => normalizeEvidence(text).normalize('NFKC').toLocaleLowerCase('de').replaceAll('ß', 'ss');
const nonEmptyString = value => typeof value === 'string' && value.trim().length > 0;

function evidenceWithinRange(item, sourceText) {
  const lines = sourceText.replace(/\r\n?/g, '\n').split('\n');
  if (!Number.isInteger(item.lineStart) || !Number.isInteger(item.lineEnd) || item.lineStart < 1 || item.lineEnd < item.lineStart || item.lineEnd > lines.length) return false;
  return normalizeEvidence(lines.slice(item.lineStart - 1, item.lineEnd).join(' ')).includes(normalizeEvidence(item.quote));
}

function sourceText(sourceTextById, sourceId) {
  if (sourceTextById instanceof Map) return sourceTextById.get(sourceId);
  if (sourceTextById && Object.hasOwn(sourceTextById, sourceId)) return sourceTextById[sourceId];
  return undefined;
}

export function verifyEvidence(evidence, sourceTextById) {
  const errors = [];
  if (!Array.isArray(evidence) || evidence.length === 0) return ['evidence must be a non-empty array'];

  evidence.forEach((item, index) => {
    const label = `evidence[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label} must be an object`);
      return;
    }
    if (!nonEmptyString(item.sourceId)) {
      errors.push(`${label}.sourceId must be a non-empty string`);
      return;
    }
    const text = sourceText(sourceTextById, item.sourceId);
    if (typeof text !== 'string') {
      errors.push(`${label} references unknown source ID ${item.sourceId}`);
      return;
    }
    if (!nonEmptyString(item.quote)) {
      errors.push(`${label}.quote must be a non-empty string`);
      return;
    }
    if (!evidenceWithinRange(item, text)) errors.push(`${label} evidence quote not found inside declared line range`);
  });
  return errors;
}

function validateCommonQuestion(question, index, knownSourceIds, sourceTextById) {
  const errors = [];
  const label = `questions[${index}]`;
  for (const field of ['id', 'topicId', 'learningObjective']) {
    if (!nonEmptyString(question?.[field])) errors.push(`${label}.${field} must be a non-empty string`);
  }
  if (!QUESTION_TYPES.has(question?.type)) errors.push(`${label}.type must be single-choice or open`);
  if (!DIFFICULTIES.has(question?.difficulty)) errors.push(`${label}.difficulty must be easy, medium, or hard`);
  if (Array.isArray(question?.evidence)) {
    question.evidence.forEach((item, evidenceIndex) => {
      if (nonEmptyString(item?.sourceId) && !knownSourceIds.has(item.sourceId)) {
        errors.push(`${label}.evidence[${evidenceIndex}] references unknown source ID ${item.sourceId}`);
      }
    });
  }
  errors.push(...verifyEvidence(question?.evidence, sourceTextById).map(error => `${label}.${error}`));
  return errors;
}

function validateSingleChoice(question, index) {
  const errors = [];
  const label = `questions[${index}]`;
  if (!nonEmptyString(question.stem)) errors.push(`${label}.stem must be a non-empty string`);
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    errors.push(`${label} must have exactly four distinct options`);
  } else {
    const optionIds = new Set();
    const optionTexts = new Set();
    question.options.forEach((option, optionIndex) => {
      if (!nonEmptyString(option?.id)) errors.push(`${label}.options[${optionIndex}].id must be a non-empty string`);
      else optionIds.add(option.id);
      if (!nonEmptyString(option?.text)) errors.push(`${label}.options[${optionIndex}].text must be a non-empty string`);
      else optionTexts.add(normalizeQuestionText(option.text));
    });
    if (optionIds.size !== 4 || optionTexts.size !== 4) errors.push(`${label} must have exactly four distinct options`);
    if (!nonEmptyString(question.correctOptionId) || !optionIds.has(question.correctOptionId)) {
      errors.push(`${label}.correctOptionId must identify exactly one option`);
    }
    const correctOption = question.options.find(option => option?.id === question.correctOptionId);
    if (nonEmptyString(question.stem) && nonEmptyString(correctOption?.text)
      && normalizeQuestionText(question.stem) === normalizeQuestionText(correctOption.text)) {
      errors.push(`${label} question text must not equal its answer text`);
    }
  }
  if (!nonEmptyString(question.rationale)) errors.push(`${label}.rationale must be a non-empty string`);
  return errors;
}

function validateConsensus(consensus, label) {
  const errors = [];
  const passes = Array.isArray(consensus?.passes) ? consensus.passes : [];
  const acceptedRoleCounts = new Map([...REQUIRED_PASS_ROLES].map(role => [role, 0]));
  for (const pass of passes) {
    if (pass?.verdict === 'accept' && acceptedRoleCounts.has(pass.role)) {
      acceptedRoleCounts.set(pass.role, acceptedRoleCounts.get(pass.role) + 1);
    }
  }
  const unanimous = consensus?.status === 'accepted'
    && (consensus?.cycle === 1 || consensus?.cycle === 2)
    && passes.length === REQUIRED_PASS_ROLES.size
    && passes.every(pass => REQUIRED_PASS_ROLES.has(pass?.role) && pass.verdict === 'accept' && Array.isArray(pass.findings))
    && [...acceptedRoleCounts.values()].every(count => count === 1)
    && consensus?.adjudication?.verdict === 'accept'
    && nonEmptyString(consensus?.adjudication?.summary);
  if (!unanimous) errors.push(`${label} must have unanimous accepted consensus`);
  return errors;
}

function validateOpen(question, index) {
  const errors = [];
  const label = `questions[${index}]`;
  if (!nonEmptyString(question.prompt)) errors.push(`${label}.prompt must be a non-empty string`);
  if (!nonEmptyString(question.modelAnswer)) errors.push(`${label}.modelAnswer must be a non-empty string`);
  if (nonEmptyString(question.prompt) && nonEmptyString(question.modelAnswer)
    && normalizeQuestionText(question.prompt) === normalizeQuestionText(question.modelAnswer)) {
    errors.push(`${label} question text must not equal its answer text`);
  }
  if (!Array.isArray(question.criteria) || question.criteria.length !== 4
    || question.criteria.some(criterion => !nonEmptyString(criterion))
    || new Set((question.criteria ?? []).filter(nonEmptyString).map(normalizeQuestionText)).size !== 4) {
    errors.push(`${label} must have exactly four distinct criteria`);
  }
  errors.push(...validateConsensus(question.consensus, `${label}.consensus`));
  return errors;
}

function validateCounts(questions, blueprint) {
  const errors = [];
  const topics = Array.isArray(blueprint?.topics) ? blueprint.topics : [];
  for (const topic of topics) {
    for (const [type, blueprintField] of [['single-choice', 'singleChoice'], ['open', 'open']]) {
      const actual = questions.filter(question => question?.topicId === topic.id && question?.type === type).length;
      if (actual !== topic[blueprintField]) {
        errors.push(`topic ${topic.id} ${blueprintField} count ${actual} must equal ${topic[blueprintField]}`);
      }
    }
  }
  const knownTopicIds = new Set(topics.map(topic => topic.id));
  questions.forEach((question, index) => {
    if (nonEmptyString(question?.topicId) && !knownTopicIds.has(question.topicId)) {
      errors.push(`questions[${index}].topicId references unknown topic ${question.topicId}`);
    }
  });
  for (const difficulty of DIFFICULTIES) {
    const actual = questions.filter(question => question?.difficulty === difficulty).length;
    const expected = blueprint?.difficultyCounts?.[difficulty];
    if (actual !== expected) errors.push(`difficulty ${difficulty} count ${actual} must equal ${expected}`);
  }
  return errors;
}

export function validateQuestionBank(bank, blueprint, manifest, sourceTextById) {
  const errors = [];
  if (bank?.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (bank?.examId !== blueprint?.exam?.id) errors.push('examId must match blueprint exam.id');
  if (bank?.blueprintHash !== sha256(blueprint)) errors.push('blueprintHash must match blueprint');
  if (bank?.sourceManifestHash !== manifest?.manifestHash) errors.push('sourceManifestHash must match manifest');
  if (!Array.isArray(bank?.questions)) {
    errors.push('questions must be an array');
    return errors;
  }

  const knownSourceIds = new Set(Array.isArray(manifest?.sources) ? manifest.sources.map(source => source.id) : []);
  const questionIds = new Set();
  const normalizedPrompts = new Set();
  bank.questions.forEach((question, index) => {
    errors.push(...validateCommonQuestion(question, index, knownSourceIds, sourceTextById));
    if (nonEmptyString(question?.id)) {
      if (questionIds.has(question.id)) errors.push(`duplicate question id: ${question.id}`);
      questionIds.add(question.id);
    }
    const prompt = question?.type === 'single-choice' ? question.stem : question?.type === 'open' ? question.prompt : undefined;
    if (nonEmptyString(prompt)) {
      const normalized = normalizeQuestionText(prompt);
      if (normalizedPrompts.has(normalized)) errors.push(`duplicate normalized question prompt: ${prompt}`);
      normalizedPrompts.add(normalized);
    }
    if (question?.type === 'single-choice') errors.push(...validateSingleChoice(question, index));
    if (question?.type === 'open') errors.push(...validateOpen(question, index));
  });
  errors.push(...validateCounts(bank.questions, blueprint));
  return errors;
}

async function main() {
  let questionCount = 0;
  try {
    const { bank: bankPath, blueprint: blueprintPath, manifest: manifestPath } = parseArgs(
      process.argv.slice(2),
      ['bank', 'blueprint', 'manifest'],
    );
    const [bank, blueprint, manifest] = await Promise.all([
      readJson(bankPath),
      readJson(blueprintPath),
      readJson(manifestPath),
    ]);
    questionCount = Array.isArray(bank?.questions) ? bank.questions.length : 0;
    const sourceTextById = Object.fromEntries(await Promise.all(
      (Array.isArray(manifest?.sources) ? manifest.sources : []).map(async source => [
        source.id,
        await readFile(source.absolutePath, 'utf8'),
      ]),
    ));
    const errors = validateQuestionBank(bank, blueprint, manifest, sourceTextById);
    console.log(JSON.stringify({ ok: errors.length === 0, errors, questionCount }));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ ok: false, errors: [error.message], questionCount }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
