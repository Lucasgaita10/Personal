-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL,
    "agent" TEXT,
    "model" TEXT NOT NULL,
    "opportunityId" TEXT,
    "threadId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmCall_createdAt_idx" ON "LlmCall"("createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_opportunityId_createdAt_idx" ON "LlmCall"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_endpoint_createdAt_idx" ON "LlmCall"("endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_model_createdAt_idx" ON "LlmCall"("model", "createdAt");
