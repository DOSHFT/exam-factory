# Canonical question-bank schema

Question banks are portable JSON data. They must not contain UI state, renderer labels, hosting URLs, or deployment-specific paths.

## Bank

```json
{
  "schemaVersion": "1.0.0",
  "examId": "m16-smoke",
  "blueprintHash": "<SHA-256 of the canonical blueprint>",
  "sourceManifestHash": "<manifestHash from the source manifest>",
  "questions": []
}
```

- `schemaVersion` is `1.0.0`.
- `examId` equals `blueprint.exam.id`.
- `blueprintHash` equals the deterministic hash of the supplied blueprint.
- `sourceManifestHash` equals the supplied manifest's `manifestHash`.
- `questions` satisfies every topic/type and difficulty count in the blueprint exactly.
- Question IDs are unique. Stems and prompts are unique after whitespace and case normalization.

## Single-choice question

```json
{
  "id": "statistik-sc-001",
  "type": "single-choice",
  "topicId": "statistik",
  "difficulty": "easy",
  "learningObjective": "Robuste Lagemaße unterscheiden",
  "stem": "Welches Lagemaß ist gegenüber Ausreißern robuster?",
  "options": [
    {"id": "opt-1", "text": "Median"},
    {"id": "opt-2", "text": "Arithmetischer Mittelwert"},
    {"id": "opt-3", "text": "Varianz"},
    {"id": "opt-4", "text": "Standardabweichung"}
  ],
  "correctOptionId": "opt-1",
  "rationale": "Der Median wird durch einzelne extreme Werte weniger beeinflusst.",
  "evidence": [
    {"sourceId": "src-54dd0b2e3e7aea30", "lineStart": 3, "lineEnd": 3, "quote": "Der Median ist gegenüber Ausreißern robuster als der Mittelwert."}
  ]
}
```

A single-choice question has exactly four options with unique, non-empty IDs and distinct non-empty text. `correctOptionId` identifies exactly one option. The rationale is non-empty. Option IDs encode stable identity, not display letters: labels such as A, B, C, and D belong to the renderer and are never canonical option identity.

## Open question

```json
{
  "id": "statistik-open-001",
  "type": "open",
  "topicId": "statistik",
  "difficulty": "medium",
  "learningObjective": "Robustheit von Lagemaßen erklären",
  "prompt": "Erklären Sie, warum der Median bei Ausreißern bevorzugt wird.",
  "modelAnswer": "Der Median ist gegenüber Ausreißern robuster als der Mittelwert. Der Mittelwert kann durch einzelne Extremwerte deutlich verschoben werden; bei Daten mit Ausreißern ist der Median daher häufig passender.",
  "criteria": [
    "Median als robuster gegenüber Ausreißern benannt",
    "mögliche Verschiebung des Mittelwerts durch Extremwerte erklärt",
    "Vergleich mit dem Mittelwert hergestellt",
    "Median als häufig passendere Wahl bei Ausreißern genannt"
  ],
  "evidence": [
    {"sourceId": "src-54dd0b2e3e7aea30", "lineStart": 3, "lineEnd": 5, "quote": "Der Median ist gegenüber Ausreißern robuster als der Mittelwert. Der Mittelwert kann durch einzelne extreme Werte deutlich verschoben werden. Bei Daten mit Ausreißern ist der Median daher häufig das passendere Lagemaß."}
  ],
  "consensus": {
    "status": "accepted",
    "cycle": 1,
    "passes": [
      {"role": "evidence-verifier", "verdict": "accept", "findings": []},
      {"role": "quality-reviewer", "verdict": "accept", "findings": []}
    ],
    "adjudication": {"verdict": "accept", "summary": "Supported and consistently scorable."}
  }
}
```

An open question has exactly four distinct, non-empty criteria and accepted consensus from the two required isolated passes plus adjudication. The cycle is `1` or `2`.

## Shared evidence rules

Every question has at least one evidence item. `sourceId` must exist in the supplied source manifest. `lineStart` and `lineEnd` are inclusive, one-based integers within that source. After newline and whitespace normalization, `quote` must occur entirely inside the declared line range. The question text must not equal its correct option text or model answer after normalization.
