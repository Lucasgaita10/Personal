/** Thin client for the Stone Gate Node API.
 *
 * Default: route through Next.js's `/bff/*` rewrite, which the server proxies
 * to API_BASE_URL (the internal Docker hostname in prod, localhost in dev).
 * That way the public bundle never needs to know the public IP at build time.
 *
 * Override by setting NEXT_PUBLIC_API_BASE_URL at build time when you want
 * direct browser → api calls (legacy local dev pattern).
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/bff';
const TOKEN_KEY = 'sg_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers.authorization = `Bearer ${t}`;
  // Only set content-type when there is a body — otherwise Fastify rejects
  // bodyless requests with FST_ERR_CTP_EMPTY_JSON_BODY.
  if (body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function login(email: string, password: string) {
  const result = (await call('POST', '/v1/auth/login', { email, password })) as {
    token: string;
    user: any;
  };
  setToken(result.token);
  return result;
}

async function logout() {
  setToken(null);
  return call('POST', '/v1/auth/logout');
}

export const api = {
  me: () => call('GET', '/v1/auth/me'),
  login,
  logout,

  dashboardSummary: () => call('GET', '/v1/dashboard/summary'),
  riskHeatmap: (params: { clientId?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.clientId) q.set('clientId', params.clientId);
    const s = q.toString();
    return call('GET', `/v1/dashboard/risk-heatmap${s ? `?${s}` : ''}`);
  },

  telemetrySummary: (
    params: { days?: number; opportunityId?: string; clientId?: string } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.days) q.set('days', String(params.days));
    if (params.opportunityId) q.set('opportunityId', params.opportunityId);
    if (params.clientId) q.set('clientId', params.clientId);
    const s = q.toString();
    return call('GET', `/v1/telemetry/summary${s ? `?${s}` : ''}`);
  },
  telemetryCalls: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return call('GET', `/v1/telemetry/calls${q ? `?${q}` : ''}`);
  },

  clients: () => call('GET', '/v1/clients'),
  client: (id: string) => call('GET', `/v1/clients/${id}`),
  createClient: (data: any) => call('POST', '/v1/clients', data),
  updateClient: (id: string, data: any) => call('PATCH', `/v1/clients/${id}`, data),

  opportunities: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return call('GET', `/v1/opportunities${q ? `?${q}` : ''}`);
  },
  opportunity: (id: string) => call('GET', `/v1/opportunities/${id}`),
  createOpportunity: (data: any) => call('POST', '/v1/opportunities', data),
  updateOpportunity: (id: string, data: any) =>
    call('PATCH', `/v1/opportunities/${id}`, data),
  setStage: (id: string, stage: string, reason?: string) =>
    call('POST', `/v1/opportunities/${id}/stage`, { stage, reason }),
  updateBriefing: (id: string, briefingNotes: string | null) =>
    call('PUT', `/v1/opportunities/${id}/briefing`, { briefingNotes }),
  analyze: (id: string) => call('POST', `/v1/opportunities/${id}/analyze`, {}),
  analyzeFinancialOnly: (id: string) =>
    call('POST', `/v1/opportunities/${id}/analyze/financial-only`, {}),
  gaps: (id: string) => call('POST', `/v1/opportunities/${id}/gaps`, {}),
  decision: (id: string, decision: any) =>
    call('POST', `/v1/opportunities/${id}/decision`, decision),
  rerun: (id: string, reason: string) =>
    call('POST', `/v1/opportunities/${id}/rerun`, { reason }),
  reset: (id: string, reason: string, rollbackToStage?: string) =>
    call('POST', `/v1/opportunities/${id}/reset`, { reason, rollbackToStage }),

  deleteDoc: (id: string) => call('DELETE', `/v1/documents/${id}`),
  updateDocClass: (id: string, documentClass: string) =>
    call('PATCH', `/v1/documents/${id}`, { documentClass }),
  classifyAllDocs: (opportunityId: string) =>
    call('POST', `/v1/documents/classify/${opportunityId}`, {}),
  retryFailedDocs: (opportunityId: string) =>
    call('POST', `/v1/documents/retry/${opportunityId}`, {}),

  uploadDocs: async (opportunityId: string, files: FileList) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const headers: Record<string, string> = {};
    const t = getToken();
    if (t) headers.authorization = `Bearer ${t}`;
    const res = await fetch(`${BASE}/v1/documents/upload/${opportunityId}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  threads: (oppId: string) => call('GET', `/v1/chat/threads/${oppId}`),
  thread: (id: string) => call('GET', `/v1/chat/thread/${id}`),
  sendMessage: (data: any) => call('POST', '/v1/chat/send', data),

  scenarios: (oppId: string) => call('GET', `/v1/scenarios/opportunity/${oppId}`),
  runScenario: (data: any) => call('POST', '/v1/scenarios/run', data),

  reports: (oppId: string) => call('GET', `/v1/reports/opportunity/${oppId}`),
  generateReport: (data: { opportunityId: string; type: string }) =>
    call('POST', '/v1/reports/generate', data),
};
