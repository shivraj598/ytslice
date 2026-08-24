/**
 * GET /api/proxy?url=<encoded>&sig=<hmac>
 *
 * A signed streaming proxy. It only fetches URLs minted (and HMAC-signed) by
 * /api/info, which prevents this from being an open proxy. It forwards Range
 * requests and adds permissive CORS + CORP headers so ffmpeg.wasm in the
 * browser can read the bytes.
 *
 * Cloudflare Pages Function — uses the onRequest* handler signature.
 */

interface Env {
  PROXY_SECRET?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FALLBACK_SECRET = 'ytslice-proxy-v1';

export function onRequestOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Range,Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function onRequestGet(context: RequestContext): Promise<Response> {
  const url = new URL(context.request.url);
  const target = url.searchParams.get('url');
  const sig = url.searchParams.get('sig');

  if (!target || !sig) return err('Missing url or signature.', 400);

  const secret = context.env.PROXY_SECRET || FALLBACK_SECRET;
  const expected = await sign(target, secret);
  if (!timingSafeEqual(sig, expected)) return err('Invalid signature.', 403);

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return err('Malformed target URL.', 400);
  }
  if (targetUrl.protocol !== 'https:') return err('Only https targets are allowed.', 400);

  const upstreamHeaders = new Headers({ 'User-Agent': UA, Accept: '*/*' });
  const range = context.request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: upstreamHeaders,
      redirect: 'follow',
    });
  } catch {
    return err('Upstream fetch failed.', 502);
  }

  const headers = new Headers();
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function sign(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return base64url(new Uint8Array(sig));
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
