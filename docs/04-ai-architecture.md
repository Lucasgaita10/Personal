# 04 — AI Architecture

## Model routing

| Class | Model | Use |
|---|---|---|
| `reasoning` | `claude-opus-4-7` | IC memo, IC Challenger, market stress narrative |
| `default` | `claude-sonnet-4-6` | Chat, extraction, classification, scenarios |
| `fast` | `claude-haiku-4-5-20251001` | Document classification, entity extraction, summarization |

The `ClaudeRouter` (in `ai-service/app/llm/claude.py`) selects a class based on a heuristic of complexity, latency budget, and context size. System prompts longer than 1KB are auto-tagged for prompt caching.

## Agents

| Agent | Role |
|---|---|
| Document Analyst | classify, extract entities, key terms |
| Financial Analyst | normalize metrics, validate formulas, flag weak assumptions |
| Risk Analyst | enumerate risks across categories |
| Market Analyst | comp set, supply/demand, demographics |
| Legal Reviewer | flag non-standard clauses |
| Scenario Agent | recompute under stress inputs |
| Portfolio Agent | overlap with existing positions |
| Gap Agent | diligence completeness, IC readiness |
| IC Writer | long-form memo |
| IC Challenger | devil's advocate |
| Market Stress Agent | recession/rate-shock narrative |

## Orchestration
The orchestrator picks the best agent based on intent keywords; agents share retrieved context and per-opportunity memory. Each invocation returns a structured payload (citations + content + optional JSON) and is persisted as a `ChatMessage` with `Citation` rows.

## Memory model
- `OpportunityMemory` — pinned insights, summaries, preferences (durable, per opportunity).
- `ChatThread + ChatMessage` — full transcript with citations.
- Long threads are summarized periodically by Haiku and the summary becomes a memory record.

## Source traceability
Every Claude completion is paired with the chunks retrieved for it. The Citation table persists `(messageId, documentId, chunkId, page, quote, confidence)`. The UI renders citations as clickable pills next to each assistant message.
