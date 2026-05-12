# 02 — System Architecture

## Service map
- **web** (Next.js 14, App Router) — presentation tier, server components for data, client components for chat.
- **api** (Fastify + Prisma) — trust boundary, RBAC, audit logging, file uploads, orchestrates downstream services.
- **ai-service** (FastAPI) — agent orchestration, RAG pipeline, financial engine, scenario engine, report rendering.
- **doc-processor** (FastAPI) — ingestion pipeline (extract → OCR fallback → chunk → embed → index).
- **postgres + pgvector** — relational + dense vector store.
- **redis** — queues, cache, rate-limit.
- **chromadb** — fast local vector iteration alongside pgvector.

## Trust boundary
The browser never speaks to the AI or doc-processor services directly. Everything flows through the Node API which:
- Validates JWT + RBAC.
- Writes immutable audit logs.
- Decrypts API keys only in-memory before forwarding to upstream services.

## Embedding strategy
- Default: `voyage-3-large` (1024 dims). Stored in pgvector + ChromaDB.
- Offline mode: deterministic hash-based embeddings as a placeholder (swap for `all-MiniLM-L6-v2` for production-quality local).

## Hybrid retrieval
1. Dense recall via pgvector cosine.
2. BM25 over a 4k-row candidate pool (expand with a real lexical index for scale).
3. RRF fusion to a top-K window injected into the prompt.

## Streaming
Chat responses stream from `ai-service` via SSE → relayed by Fastify → consumed by the React client.

## Encryption at rest
Document blobs and ApiKey rows are AES-256-GCM encrypted with a key derived from `MASTER_ENCRYPTION_KEY`. The doc-processor mirrors the format so it can decrypt blobs server-side without round-tripping through the API.
