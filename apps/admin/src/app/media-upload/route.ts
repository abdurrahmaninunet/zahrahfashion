import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4310';

/**
 * Media-upload proxy. The global Next.js `rewrites()` proxy (/api/:path*) returns
 * "Internal Server Error" on large multipart bodies (8K photos), so uploads are
 * routed here instead — a Route Handler has no body-size limit. It forwards the
 * request (and the session cookie for auth) straight to the API and relays the
 * response verbatim. Lives outside /api so the rewrite never intercepts it.
 */
export async function POST(req: NextRequest) {
  const body = await req.arrayBuffer();
  const res = await fetch(`${API_URL}/api/content/media`, {
    method: 'POST',
    headers: {
      'content-type': req.headers.get('content-type') ?? 'application/octet-stream',
      cookie: req.headers.get('cookie') ?? '',
    },
    body,
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
