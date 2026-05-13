import type { NextRequest } from 'next/server';

// Explicit proxy from the web container to the api container with a long
// maxDuration so chat responses (~30s) aren't cut off by the implicit
// 30-second timeout in Next.js rewrites. Replaces the `/bff/*` rewrite
// that previously lived in next.config.js.

const API = process.env.API_BASE_URL || 'http://api:4000';

// Headers we shouldn't blindly forward (hop-by-hop or auto-managed)
const HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'host',
  'content-length', // recomputed by fetch
]);

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const target = `${API}/${path.join('/')}${req.nextUrl.search}`;

  // Forward all incoming headers except hop-by-hop
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  // Stream the request body for POST/PUT/PATCH
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'BadGateway', message: err?.message ?? 'upstream fetch failed' }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  // Mirror response headers
  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_HEADERS.has(key.toLowerCase())) respHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;

// Run on Node runtime (Edge has restrictions on streaming binary bodies).
export const runtime = 'nodejs';
// Allow long-running requests — chat can take 30s+ on Opus.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
