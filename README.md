# Stone Gate — Institutional Real Estate Investment Operating System

> An AI-native diligence platform for evaluating institutional-grade real estate opportunities.

Stone Gate is the investment committee in software form: ingest the data room, understand the opportunity, surface gaps, run scenarios, generate the IC memo. Designed for principals and investment professionals at private real estate advisory firms.

---

## 1. Product Vision

### Strategic Vision
Stone Gate is the **investment committee intelligence system** — a local-first, AI-native platform that turns a fragmented data room (PDFs, Excel models, rent rolls, emails, legal docs) into a defensible investment recommendation.

The product is not a chatbot bolted onto a CRM. It is a vertical operating system for the real estate diligence lifecycle: **Client Mandate → Opportunity Ingestion → Understanding → Gap Analysis → Insights & Scenarios → IC Memo → Decision**.

It runs locally first (Dockerized) so confidential data never leaves the firm's infrastructure, with a cloud-ready architecture for future deployment.

### User Personas
1. **Principal / Partner** — needs IC-ready memos, scenario stress tests, and portfolio overlap analysis. Lives in the dashboard and the IC memo export.
2. **Investment Analyst** — uploads data rooms, runs the gap analysis, drafts the memo, iterates with the chat copilot.
3. **Director of Acquisitions** — manages the pipeline, monitors opportunities by stage, reviews recommendations.
4. **Compliance / Operations** — needs audit logs, source traceability, and document retention.

### Business Value
- **Cycle time**: weeks of diligence collapsed into days; the AI surfaces gaps and contradictions on day one.
- **Decision quality**: every claim is sourced, every metric is traceable, every scenario is reproducible.
- **Institutional memory**: every prior decision becomes searchable context for future deals.
- **Defensibility**: red flags, contrarian views, and devil's advocate analysis are generated automatically and become part of the audit trail.

---

## 2. System Architecture

### High-Level Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Stone Gate Platform                          │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Next.js Web     │◄──►│  Node API (BFF)  │                       │
│  │  (App Router)    │    │  Fastify + tRPC  │                       │
│  └──────────────────┘    └────────┬─────────┘                       │
│                                   │                                 │
│                ┌──────────────────┼──────────────────┐              │
│                ▼                  ▼                  ▼              │
│        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│        │ AI Service   │   │ Doc Processor│   │ PostgreSQL + │       │
│        │ FastAPI      │   │ FastAPI      │   │ pgvector     │       │
│        │ Anthropic    │   │ OCR/Extract  │   │ Prisma       │       │
│        └──────┬───────┘   └──────┬───────┘   └──────────────┘       │
│               │                  │                                  │
│               ▼                  ▼                                  │
│        ┌──────────────┐   ┌──────────────┐                          │
│        │ ChromaDB     │   │ Redis (queue │                          │
│        │ (vector KB)  │   │ + cache)     │                          │
│        └──────────────┘   └──────────────┘                          │
│                                                                     │
│        ┌─────────────────────────────────────────────────┐          │
│        │ Local encrypted blob store (./data/blobs)        │          │
│        └─────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### Frontend (Next.js 14 / App Router)
- **Server Components** for data fetching, **Client Components** for chat & charts.
- **shadcn/ui** primitives, **TailwindCSS** with the Stone Gate design tokens.
- **Framer Motion** for transitions; **Recharts** for financial visualizations.
- **TanStack Query** for client cache; **Zustand** for ephemeral UI state (chat, scenario panel).
- Streaming chat via Server-Sent Events.

### Node API (Fastify)
- The trust boundary. All cross-service calls flow through here.
- Handles auth, RBAC, audit logging, file uploads, and orchestrates calls to the Python services.
- Issues short-lived signed tokens for service-to-service calls.

### AI Service (FastAPI / Python)
- Hosts the **agent orchestration**, **RAG pipeline**, **financial engine**, and **scenario engine**.
- Calls Anthropic Claude via the official SDK with **prompt caching** enabled on system prompts and document context.
- Model routing: Opus for IC memo writing & contrarian analysis, Sonnet for chat & extraction, Haiku for classification & metadata.

### Document Processor (FastAPI / Python)
- Pipeline: **detect → extract → OCR fallback → chunk → embed → index**.
- PDF (PyMuPDF + pdfplumber for tables), Excel (openpyxl + pandas), Word (python-docx), Email (mailparser), Images (Tesseract OCR), ZIP (recursive unpack).
- Outputs canonical `Document`, `DocumentChunk`, and `ExtractedMetric` records.

### Database
- **PostgreSQL 16** with **pgvector** extension for embeddings.
- **ChromaDB** alongside for the per-opportunity ephemeral knowledge base (faster local iteration).
- **Prisma** ORM for the relational schema.

### Storage & Encryption
- Documents stored on local disk under `./data/blobs/{opportunityId}/{sha256}.bin`, encrypted at rest with AES-256-GCM using a key derived from a master secret in `.env`.
- API keys (Anthropic, etc.) are AES-encrypted in DB; envelope key never leaves the API service.

---

## 3. Database Schema

See `packages/db/prisma/schema.prisma` for the full schema. Key entities:

- **User, Role, AuditLog** — auth & governance.
- **Client** — investor profile, mandate, preferences, existing portfolio.
- **Opportunity** — the core deal record with workflow stage.
- **Document, DocumentChunk** — ingested artifacts with embeddings.
- **ExtractedMetric, FinancialAssumption** — normalized financial data points.
- **Risk, Gap** — diligence findings.
- **Scenario, ScenarioRun** — what-if analyses.
- **ChatThread, ChatMessage, Citation** — conversational intelligence with traceability.
- **Report** — generated memos/decks.
- **PortfolioPosition** — for overlap and exposure analysis.

---

## 4. AI Architecture

### Agent Roster
| Agent | Model | Purpose |
|---|---|---|
| Document Analyst | Sonnet | Classify, summarize, extract entities |
| Financial Analyst | Sonnet/Opus | Parse models, normalize metrics, validate formulas |
| Risk Analyst | Sonnet | Identify and rank risks across categories |
| Market Analyst | Sonnet | Comp analysis, market trends, supply/demand |
| Legal Reviewer | Sonnet | Surface non-standard clauses & key terms |
| Scenario Agent | Sonnet | Recompute cash flows under stress conditions |
| Portfolio Exposure Agent | Sonnet | Overlap with existing positions |
| Financial Model Validator | Sonnet | Cross-check formulas, flag inconsistencies |
| IC Writer | Opus | Long-form IC memo & executive summary |
| IC Challenger | Opus | Devil's advocate, contrarian, kill-the-deal arguments |
| Market Stress Agent | Opus | Recession/rate-shock narrative analysis |

### Orchestration
A **Planner** decides which agents to call in what order based on the user's intent and the opportunity state. Agents share a context bus (the Opportunity Knowledge Graph + chat memory). Outputs are **structured JSON** validated against Pydantic schemas; free-form prose is reserved for memo sections.

### RAG Pipeline
1. Document → chunks (semantic, ~800 tokens, 100-token overlap).
2. Each chunk → `voyage-3-large` embedding (or `all-MiniLM-L6-v2` for fully-local mode).
3. Stored in pgvector + ChromaDB.
4. Query → hybrid retrieval (BM25 + dense) → rerank → top-K → injected as context.
5. Every assistant claim is cited back to a `chunkId` + page number.

### Prompt Architecture
- System prompts are versioned (`prompts/v1/...`) and stored in source.
- Anthropic **prompt caching** is enabled on system prompts and on the document context block.
- Every prompt template declares its input schema, output schema, and target model.

### Memory
- **Per-opportunity memory** lives in `ChatThread` and `OpportunityMemory` tables.
- **Pinned insights** are first-class records that the orchestrator always loads.
- Long conversations are **summarized periodically** by Haiku and the summary is folded back as a memory record.

---

## 5. UI/UX Design

### Design Tokens

| Token | Value |
|---|---|
| `--sg-primary` | `#A88B47` |
| `--sg-primary-hover` | `#8B7339` |
| `--sg-bg` | `#FFFFFF` |
| `--sg-surface` | `#FAFAFA` |
| `--sg-border` | `#E5E5E5` |
| `--sg-text` | `#0A0A0A` |
| `--sg-text-muted` | `#6B6B6B` |
| `--sg-accent` | `#A88B47` |
| Typography | Inter / Söhne fallback, tight tracking |
| Radius | 6px (institutional, not consumer) |

### Navigation
Persistent left rail: **Dashboard · Pipeline · Clients · Reports · Settings**.
Inside an Opportunity: tabbed sub-nav **Overview · Documents · Financials · Risks · Insights · Gaps · Reports**.

### Insights Layout (split-screen)
- **Left pane (40%)** — Conversation, saved prompts, scenario templates.
- **Right pane (60%)** — Contextual viewer that swaps between cited document, extracted table, financial chart, or risk heatmap.

### Component System
- shadcn primitives extended with Stone Gate tokens.
- `MetricCard`, `RiskHeatmap`, `WaterfallChart`, `SourceCitation`, `ScenarioPanel`, `GapChecklist`, `ICMemoPreview` are first-class components.

---

## 6. Workflow System

### Opportunity Lifecycle
`New → Initial Screening → Under Review → Due Diligence → IC Preparation → (Approved | Rejected) → Closed`

Each stage has:
- Required artifacts (e.g., IC Prep requires IC memo + scenario set).
- Suggested next actions surfaced by the AI.
- A **stage gate score** (computed from completeness, risk severity, and confidence).

### Collaboration
Notes & comments are scoped to either the Opportunity, a Document, a specific extracted metric, or a chat message. All changes hit `AuditLog`.

### Approvals
The "Promote to IC" action snapshots the opportunity (documents, metrics, memo) and locks the snapshot. Subsequent edits create a new version while preserving the IC submission.

---

## 7. Reporting System

Three report templates, all rendered server-side:

| Type | Engine | Use |
|---|---|---|
| **Long IC Memo** (PDF) | WeasyPrint (HTML→PDF) | Full institutional memo |
| **Executive Summary** (PDF) | WeasyPrint | 2–3 page principal brief |
| **Presentation Deck** (PPTX) | python-pptx | Visual IC presentation |

All templates pull from the same canonical `OpportunityReportPayload` so the three outputs are guaranteed consistent. Stone Gate brand: maroon header band (`#A88B47`), white body, grey rules. Charts are Recharts in the web view, matplotlib in the report.

---

## 8. Folder Structure

```
RE/
├── README.md                  # this file
├── docker-compose.yml
├── package.json               # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
├── docs/                      # extended architecture docs
│
├── apps/
│   ├── web/                   # Next.js 14 app router
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   └── (app)/
│   │   │       ├── dashboard/
│   │   │       ├── opportunities/[id]/{overview,documents,financials,risks,insights,gaps,reports}/
│   │   │       ├── clients/
│   │   │       ├── reports/
│   │   │       └── settings/
│   │   ├── components/{ui,layout,insights,opportunity,charts,client,document}/
│   │   └── lib/
│   │
│   └── api/                   # Node/Fastify BFF
│       └── src/{routes,services,middleware,lib,jobs}/
│
├── services/
│   ├── ai-service/            # FastAPI: orchestration + RAG + scenarios
│   │   └── app/{agents,rag,llm,financial,prompts,tools,memory}/
│   └── doc-processor/         # FastAPI: ingestion pipeline
│       └── app/{processors,extractors,utils}/
│
├── packages/
│   ├── db/                    # Prisma schema + client
│   │   └── prisma/schema.prisma
│   └── shared/                # Shared TS types
│       └── src/
│
└── docker/                    # Dockerfiles (kept alongside services)
```

---

## 9. Development Roadmap

### Phase 0 — Foundation (Week 1–2)
- Monorepo, Docker Compose, Postgres+pgvector, auth, RBAC, encrypted blob store.
- Prisma schema, seed data, base UI shell with Stone Gate branding.

### Phase 1 — MVP (Week 3–6)
- Client profile module.
- Document upload + classification + OCR + extraction.
- Opportunity dashboard with workflow stages.
- Basic chat with RAG over uploaded documents (Sonnet).
- IC memo export (HTML→PDF with Stone Gate template).

### Phase 2 — V1 (Week 7–12)
- Full agent roster (Risk, Market, Legal, IC Writer, Challenger).
- Gap analysis & IC Readiness Score.
- Financial engine: parse Excel models, normalize IRR/DSCR/cap rate.
- Scenario engine with sensitivity matrices.
- Source-traceable citations clickable from chat → document viewer.
- PowerPoint export.

### Phase 3 — Advanced AI (Week 13–18)
- Portfolio exposure & overlap analysis across opportunities.
- Monte Carlo simulation.
- Cognitive bias warnings & contrarian agent.
- Knowledge graph queries.
- Prompt versioning UI & A/B harness.

### Phase 4 — Integrations (Week 19+)
- Airtable / Zapier connectors.
- CRM (Salesforce, HubSpot) bidirectional sync.
- Portfolio management system integration.
- Cloud deployment (single-tenant) on AWS/Azure.

---

## 10. Starter Code

The repository ships with a working scaffold. Key entry points:

- `apps/web/app/layout.tsx` — root layout with Stone Gate brand shell.
- `apps/api/src/server.ts` — Fastify boot.
- `services/ai-service/app/main.py` — FastAPI + agent registry.
- `services/doc-processor/app/main.py` — ingestion pipeline.
- `packages/db/prisma/schema.prisma` — relational schema.

See each service's `README.md` for build/run notes.

---

## 11. Local Setup

```bash
# Prereqs: Docker, pnpm, Python 3.11+
cp .env.example .env
# put your ANTHROPIC_API_KEY in .env

docker compose up -d postgres redis chromadb
pnpm install
pnpm --filter @stone-gate/db prisma:migrate
pnpm dev
```

The web app runs at `http://localhost:3000`, the API at `:4000`, AI service at `:8000`, doc processor at `:8001`.

To run everything in Docker:
```bash
docker compose up --build
```

---

## License
Proprietary — Stone Gate, internal use only.
