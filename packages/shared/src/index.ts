import { z } from 'zod';

// ─── Domain enums ─────────────────────────────────────────────────

export const RecommendationSchema = z.enum([
  'PROCEED',
  'PROCEED_WITH_CONDITIONS',
  'REJECT',
  'NEED_MORE_INFO',
]);
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const StageSchema = z.enum([
  'NEW',
  'INITIAL_SCREENING',
  'UNDER_REVIEW',
  'DUE_DILIGENCE',
  'IC_PREPARATION',
  'APPROVED',
  'REJECTED',
  'CLOSED',
]);

export const RiskCategorySchema = z.enum([
  'SPONSOR',
  'LEVERAGE',
  'MARKET',
  'CONCENTRATION',
  'LEGAL',
  'CONSTRUCTION',
  'TENANT',
  'REFINANCE',
  'REGULATORY',
  'ESG',
  'OTHER',
]);

export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// ─── AI agent contracts ───────────────────────────────────────────

export const CitationSchema = z.object({
  documentId: z.string(),
  chunkId: z.string().optional(),
  page: z.number().int().nullable().optional(),
  quote: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const RiskFindingSchema = z.object({
  category: RiskCategorySchema,
  title: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  likelihood: SeveritySchema,
  mitigation: z.string().optional(),
  citations: z.array(CitationSchema).default([]),
});
export type RiskFinding = z.infer<typeof RiskFindingSchema>;

export const GapFindingSchema = z.object({
  category: z.enum(['documents', 'data', 'assumptions', 'legal', 'market']),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'BLOCKER']),
  rationale: z.string(),
  recommendation: z.string(),
});
export type GapFinding = z.infer<typeof GapFindingSchema>;

export const ExtractedMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  period: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  citation: CitationSchema.optional(),
});
export type ExtractedMetric = z.infer<typeof ExtractedMetricSchema>;

export const InvestmentThesisSchema = z.object({
  thesis: z.string(),
  bullCase: z.array(z.string()),
  baseCase: z.array(z.string()),
  bearCase: z.array(z.string()),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }),
  opportunityScore: z.number().min(0).max(10),
  riskScore: z.number().min(0).max(10),
  confidenceScore: z.number().min(0).max(10),
});
export type InvestmentThesis = z.infer<typeof InvestmentThesisSchema>;

export const ScenarioInputsSchema = z.object({
  vacancy: z.number().optional(),
  rateShockBps: z.number().optional(),
  exitCapBps: z.number().optional(),
  rentGrowthDelta: z.number().optional(),
  refinanceAvailable: z.boolean().optional(),
  noiHaircut: z.number().optional(),
  capexOverrun: z.number().optional(),
});
export type ScenarioInputs = z.infer<typeof ScenarioInputsSchema>;

export const ScenarioOutputsSchema = z.object({
  irr: z.number(),
  moic: z.number(),
  equityMultiple: z.number().optional(),
  dscrMin: z.number().optional(),
  cashOnCash: z.number().optional(),
  breakEvenOccupancy: z.number().optional(),
  cashflow: z.array(z.object({ year: z.number(), value: z.number() })).optional(),
});
export type ScenarioOutputs = z.infer<typeof ScenarioOutputsSchema>;

export const ChatRequestSchema = z.object({
  threadId: z.string().optional(),
  opportunityId: z.string(),
  message: z.string(),
  topK: z.number().int().min(1).max(50).default(8),
  agent: z.string().default('orchestrator'),
});

export const AgentResponseSchema = z.object({
  agent: z.string(),
  model: z.string(),
  content: z.string(),
  citations: z.array(CitationSchema).default([]),
  structured: z.unknown().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ─── Models ───────────────────────────────────────────────────────

export const ClaudeModels = {
  reasoning: 'claude-opus-4-7',
  default: 'claude-sonnet-4-6',
  fast: 'claude-haiku-4-5-20251001',
} as const;

export type ClaudeModelKey = keyof typeof ClaudeModels;
