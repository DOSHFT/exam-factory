# Blueprint schema

The blueprint is a renderer-independent JSON contract for source-grounded exams. It must use `schemaVersion` `1.0.0` and contain these fields:

- `schemaVersion`: contract version string; currently `1.0.0`.
- `exam`: metadata object with non-empty string fields `id`, `title`, `version`, `language`, `institution`, `program`, `module`, and `learnerLevel`.
- `sourcePaths`: a non-empty array of explicit, non-empty paths to the source material. Sources must not be implicit.
- `topics`: a non-empty array. Each topic has an ID containing only lowercase letters, numbers, and hyphens, a `name`, and non-negative integer counts for `singleChoice` and `open` questions.
- `difficultyCounts`: non-negative integer counts for `easy`, `medium`, and `hard` questions.
- `scoring`: `singleChoicePoints` must be `1`, `openPoints` must be `4`, and `passPercent` must be between `0` and `100`.
- `ui`: `answerCommit` is `single-click` or `double-click`; `brandName` identifies the UI brand.
- `output`: `directory` and an `.html` `fileName`; `overwrite` is a boolean.

Per-topic `singleChoice` and `open` counts determine the question total. The `easy`, `medium`, and `hard` difficulty counts must have an identical total.

The fixture values are:

```json
{
  "schemaVersion": "1.0.0",
  "exam": {
    "id": "m16-smoke",
    "title": "M16 Trainingsklausur",
    "version": "1.0.0",
    "language": "de",
    "institution": "Berlin University Program",
    "program": "Hebammenwissenschaft",
    "module": "M16",
    "learnerLevel": "4. Fachsemester"
  },
  "sourcePaths": ["sources"],
  "topics": [
    {"id": "statistik", "name": "Statistik", "singleChoice": 2, "open": 1},
    {"id": "evidenz", "name": "Evidenzbasierte Praxis", "singleChoice": 2, "open": 1}
  ],
  "difficultyCounts": {"easy": 2, "medium": 3, "hard": 1},
  "scoring": {"singleChoicePoints": 1, "openPoints": 4, "passPercent": 60},
  "ui": {"answerCommit": "double-click", "brandName": "Exam HTML Factory"},
  "output": {"directory": "generated", "fileName": "exam.html", "overwrite": false}
}
```
