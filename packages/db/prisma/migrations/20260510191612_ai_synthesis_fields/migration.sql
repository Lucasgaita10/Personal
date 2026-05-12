-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "aiCriticalQuestions" JSONB,
ADD COLUMN     "aiMarketResearch" TEXT,
ADD COLUMN     "aiNextSteps" JSONB,
ADD COLUMN     "aiTopReasonsAgainst" JSONB,
ADD COLUMN     "aiTopReasonsFor" JSONB,
ADD COLUMN     "aiVerdict" "Recommendation",
ADD COLUMN     "aiVerdictRationale" TEXT,
ADD COLUMN     "aiWatchpoints" JSONB;
