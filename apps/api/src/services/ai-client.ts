import { request } from 'undici';

const AI_BASE = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await request(`${AI_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.statusCode >= 400) {
    const text = await res.body.text();
    throw new Error(`AI service ${res.statusCode}: ${text}`);
  }
  return (await res.body.json()) as T;
}

export async function chat(payload: {
  opportunityId: string;
  threadId?: string;
  message: string;
  topK?: number;
  agent?: string;
}) {
  return call<{
    threadId: string;
    messageId: string;
    content: string;
    citations: any[];
    structured?: unknown;
    model: string;
  }>('/chat', payload);
}

export async function streamChat(payload: {
  opportunityId: string;
  threadId?: string;
  message: string;
  topK?: number;
  agent?: string;
}) {
  return request(`${AI_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function analyzeOpportunity(opportunityId: string) {
  return call<{ jobId: string }>('/analyze/opportunity', { opportunityId });
}

export async function analyzeOpportunityFinancialOnly(opportunityId: string) {
  return call<{ jobId: string; mode: 'financial_only' }>(
    '/analyze/opportunity/financial-only',
    { opportunityId },
  );
}

export async function runScenario(payload: {
  opportunityId: string;
  scenarioId?: string;
  inputs: Record<string, number | boolean>;
}) {
  return call<{ runId: string; outputs: any; cashflow: any }>(
    '/scenarios/run',
    payload,
  );
}

export async function generateReport(payload: {
  opportunityId: string;
  type: 'IC_MEMO_LONG' | 'EXECUTIVE_SUMMARY' | 'PRESENTATION_DECK';
}) {
  return call<{ reportId: string; storagePath: string }>('/reports/generate', payload);
}

export async function gapAnalysis(opportunityId: string) {
  return call<{ gaps: any[]; readinessScore: number }>('/analyze/gaps', {
    opportunityId,
  });
}
