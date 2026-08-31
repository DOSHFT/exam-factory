# Consensus and quality gates

Question acceptance is fail-closed. A candidate is excluded unless its source evidence validates, its structure and blueprint allocation validate, and any open question records unanimous accepted consensus and accepted adjudication.

Execute isolated review passes in this order:

1. The author creates the candidate and attaches exact source evidence.
2. The evidence verifier receives the source excerpts and candidate, but not the author's justification. It returns `accept`, `revise`, or `reject` with findings.
3. The quality reviewer receives the candidate and intended learner level, but neither the author's justification nor any earlier verdict. It returns `accept`, `revise`, or `reject` with findings.
4. The adjudicator compares both isolated outputs and records `accept`, `revise`, or `reject` with a summary.
5. If revision is requested, revise once, increment to cycle 2, and repeat both isolated passes and adjudication. Exclude any item still unresolved after cycle 2.

An accepted open question records `status: "accepted"`, cycle 1 or 2, exactly one `accept` pass from `evidence-verifier`, exactly one `accept` pass from `quality-reviewer`, no non-accept verdict, and an `accept` adjudication with a non-empty summary. Missing, duplicate, additional, stale, or non-accept pass records fail the gate.

The evidence verifier checks that every claim needed to answer and score the item is supported by the declared source lines. The quality reviewer checks clarity, learner-level fit, uniqueness, answerability, option quality where applicable, and consistent scorability. The adjudicator does not replace either pass; it resolves their recorded outputs.

Model consensus reduces the risk of unsupported or poorly scorable questions, but it does not establish absolute correctness. Exact source provenance and human UAT remain independent safeguards.
