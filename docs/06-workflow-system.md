# 06 — Workflow System

## Stages
`NEW → INITIAL_SCREENING → UNDER_REVIEW → DUE_DILIGENCE → IC_PREPARATION → APPROVED|REJECTED → CLOSED`

## Stage gates
- **Under Review**: ≥ 5 documents ingested, classification confidence ≥ 0.7 average.
- **Due Diligence**: financial metrics extracted, risks enumerated.
- **IC Preparation**: IC readiness score ≥ 7, no BLOCKER gaps.
- **Approved**: investment decision recorded with rationale.

## Audit
Every stage transition writes an `AuditLog` entry with user, ip, ua, and metadata. The opportunity's snapshot at IC submission is locked; subsequent edits create a new version.

## Collaboration
- `Note` — opportunity-scoped commentary.
- `Comment` — entity-scoped (document, metric, risk, thread).
- `OpportunityMemory` — durable AI-visible context items.

## Approvals
The "Promote to IC" action snapshots the opportunity (documents, metrics, memo, scenarios) and freezes the IC submission. Subsequent investigations create a new version.
