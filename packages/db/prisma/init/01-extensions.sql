-- Enable pgvector for embeddings.
CREATE EXTENSION IF NOT EXISTS vector;
-- pg_trgm for fuzzy text search across documents.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
