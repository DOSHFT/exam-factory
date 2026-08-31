import { parseArgs } from './lib/cli.mjs';
import { readJson, sha256, validateBlueprint } from './lib/contracts.mjs';

try {
  const { blueprint: blueprintPath } = parseArgs(process.argv.slice(2), ['blueprint']);
  const blueprint = await readJson(blueprintPath);
  const errors = validateBlueprint(blueprint);
  console.log(JSON.stringify({ ok: errors.length === 0, errors, blueprintHash: sha256(blueprint) }));
  if (errors.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
