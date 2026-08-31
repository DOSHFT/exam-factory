# Task 2 report: Blueprint contracts and shared utilities

## Status

Implemented Task 2 on branch `codex/exam-html-factory-v1`. Base commit was `72fe206e28b266b22a72a2f0cc3432ddd4e0851e`.

## TDD evidence

### RED

Command:

```powershell
node --test 'C:\Users\Setup User\plugins\exam-html-factory\tests\contracts.test.mjs'
```

Result: failed as required before implementation with `ERR_MODULE_NOT_FOUND` for `skills/source-grounded-exam/scripts/lib/contracts.mjs`.

### GREEN

Command:

```powershell
node --test 'C:\Users\Setup User\plugins\exam-html-factory\tests\contracts.test.mjs'
```

Result: 3 tests passed, 0 failed.

Command:

```powershell
node 'C:\Users\Setup User\plugins\exam-html-factory\skills\source-grounded-exam\scripts\validate-blueprint.mjs' --blueprint 'C:\Users\Setup User\plugins\exam-html-factory\tests\fixtures\blueprint.valid.json'
```

Result:

```json
{"ok":true,"errors":[],"blueprintHash":"f5cb337d83f5a83a328c940402a8f1381e9c2d29032eab0c10234eea866a6ee3"}
```

## Validation

Command: `npm test`

Result: 3 tests passed, 0 failed.

Command: `npm run validate:plugin`

Result: `Plugin validation passed`.

Command: `npm run validate:skill`

Result: reports the existing unfinished TODO placeholders in `skills/source-grounded-exam/SKILL.md`. This file was intentionally not modified because Task 7 owns that TODO.

Command: `node skills/source-grounded-exam/scripts/validate-blueprint.mjs --wrong`

Result: prints `Missing required argument --wrong` and exits 1.

Command: `git diff --check`

Result: no whitespace errors.

## Files changed

- `skills/source-grounded-exam/scripts/lib/cli.mjs`: dependency-free argument parsing.
- `skills/source-grounded-exam/scripts/lib/contracts.mjs`: stable serialization, SHA-256 hashing, JSON loading, and blueprint validation.
- `skills/source-grounded-exam/scripts/validate-blueprint.mjs`: blueprint validation CLI and hash output.
- `references/blueprint-schema.md`: contract field and invariant documentation.
- `tests/fixtures/blueprint.valid.json`: exact required valid fixture totals and values.
- `tests/contracts.test.mjs`: contract tests.

## Self-review

- Confirmed exact canonical fields and fixture values from the brief.
- Confirmed topic totals are 6 and difficulty totals are 6; mutation to hard=2 produces the required 7-versus-6 error.
- Confirmed stable hashes are insertion-order independent.
- Confirmed runtime code imports Node built-ins only.
- Confirmed invalid CLI input exits non-zero.
- Confirmed no source reference files or scaffold TODOs were changed.
- Confirmed branch is `codex/exam-html-factory-v1`; no main branch changes were made.

## Concerns

The skill validator remains red only because the scaffold TODO placeholders in `SKILL.md` are intentionally reserved for Task 7. No implementation concern remains for Task 2.

## Commit

`dc5a3d1 feat: define exam blueprint contract` (amended to include this report)
