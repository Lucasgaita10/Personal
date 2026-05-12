import { request } from 'undici';

const DOC_BASE = process.env.DOC_SERVICE_URL ?? 'http://localhost:8003';

export async function ingestDocument(payload: {
  documentId: string;
  opportunityId: string;
  storagePath: string;
  mimeType: string;
  filename: string;
}) {
  const res = await request(`${DOC_BASE}/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.statusCode >= 400) {
    throw new Error(`doc-processor ${res.statusCode}: ${await res.body.text()}`);
  }
  return (await res.body.json()) as { jobId: string };
}

export async function classifyDocument(payload: {
  documentId: string;
  storagePath: string;
  mimeType: string;
  filename?: string;
  persist?: boolean;
}) {
  const res = await request(`${DOC_BASE}/classify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.statusCode >= 400) {
    throw new Error(`doc-processor /classify ${res.statusCode}: ${await res.body.text()}`);
  }
  return (await res.body.json()) as {
    documentClass: string;
    confidence: number;
    smartTags: string[];
  };
}
