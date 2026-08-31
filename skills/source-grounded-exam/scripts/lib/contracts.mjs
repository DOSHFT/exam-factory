import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function validateBlueprint(value) {
  const errors = [];
  if (value?.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  for (const key of ['id', 'title', 'version', 'language', 'institution', 'program', 'module', 'learnerLevel']) {
    if (typeof value?.exam?.[key] !== 'string' || !value.exam[key].trim()) errors.push(`exam.${key} must be a non-empty string`);
  }
  if (!Array.isArray(value?.sourcePaths) || !value.sourcePaths.length || value.sourcePaths.some(path => typeof path !== 'string' || !path.trim())) errors.push('sourcePaths must contain non-empty paths');
  if (!Array.isArray(value?.topics) || !value.topics.length) errors.push('topics must be a non-empty array');
  const ids = new Set();
  let questionTotal = 0;
  for (const topic of value?.topics ?? []) {
    if (!/^[a-z0-9-]+$/.test(topic.id ?? '')) errors.push(`invalid topic id: ${topic.id}`);
    if (ids.has(topic.id)) errors.push(`duplicate topic id: ${topic.id}`);
    ids.add(topic.id);
    for (const kind of ['singleChoice', 'open']) {
      if (!Number.isInteger(topic[kind]) || topic[kind] < 0) errors.push(`topic ${topic.id} ${kind} must be a non-negative integer`);
      else questionTotal += topic[kind];
    }
  }
  const difficulties = value?.difficultyCounts ?? {};
  const difficultyTotal = ['easy', 'medium', 'hard'].reduce((sum, key) => sum + (Number.isInteger(difficulties[key]) ? difficulties[key] : 0), 0);
  if (difficultyTotal !== questionTotal) errors.push(`difficultyCounts total ${difficultyTotal} must equal question total ${questionTotal}`);
  if (value?.scoring?.singleChoicePoints !== 1 || value?.scoring?.openPoints !== 4) errors.push('scoring must use 1 point for single choice and 4 points for open questions');
  if (!Number.isFinite(value?.scoring?.passPercent) || value.scoring.passPercent < 0 || value.scoring.passPercent > 100) errors.push('scoring.passPercent must be between 0 and 100');
  if (!['single-click', 'double-click'].includes(value?.ui?.answerCommit)) errors.push('ui.answerCommit must be single-click or double-click');
  if (typeof value?.output?.directory !== 'string' || typeof value?.output?.fileName !== 'string' || !value.output.fileName.endsWith('.html')) errors.push('output must define a directory and .html fileName');
  if (typeof value?.output?.overwrite !== 'boolean') errors.push('output.overwrite must be boolean');
  return errors;
}
