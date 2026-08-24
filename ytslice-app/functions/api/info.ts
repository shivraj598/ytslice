/**
 * GET /api/info?id=VIDEO_ID
 *
 * Extracts video metadata + downloadable stream URLs, trying several public
 * Invidious / Piped instances in turn (they go up and down, so we fall through).
 * Stream URLs are rewritten to be instance-proxied (fetchable from any IP) and
 * then wrapped in our own signed /api/proxy URL so the browser can read them
 * with permissive CORS.
 *
 * Cloudflare Pages Function — uses the onRequest* handler signature.
 */

interface Env {
  INVIDIOUS_INSTANCES?: string;
  PIPED_INSTANCES?: string;
  PROXY_SECRET?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

interface StreamFormat {
  itag: number;
  quality: string;
  height?: number;
  fps?: number;
  container: string;
  mimeType: string;
  hasVideo: boolean;
  hasAudio: boolean;
  bitrate?: number;
  contentLength?: number;
  url: string;
}

interface VideoInfo {
  id: string;
  title: string;
  author?: string;
  thumbnail: string;
  duration: number;
  videoFormats: StreamFormat[];
  audioFormats: StreamFormat[];
  source: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FALLBACK_SECRET = 'ytslice-proxy-v1';
const TIMEOUT_MS = 8000;

const DEFAULT_INVIDIOUS = [
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.jing.rocks',
  'https://invidious.f5.si',
];
const DEFAULT_PIPED = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
  'https://pipedapi.leptons.xyz',
];

export async function onRequestGet(context: RequestContext): Promise<Response> {
  const reqUrl = new URL(context.request.url);
  const id = reqUrl.searchParams.get('id') ?? '';
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return json({ success: false, error: 'Invalid or missing video id.' }, 400);
  }

  const origin = reqUrl.origin;
  const secret = context.env.PROXY_SECRET || FALLBACK_SECRET;
  const invidious = splitEnv(context.env.INVIDIOUS_INSTANCES) ?? DEFAULT_INVIDIOUS;
  const piped = splitEnv(context.env.PIPED_INSTANCES) ?? DEFAULT_PIPED;

  // Race every extractor at once; first one that returns usable formats wins.
  // (Sequential fallbacks were too slow and usually timed out.)
  const attempts: Promise<VideoInfo>[] = [
    ...invidious.map((inst) =>
      fromInvidious(inst, id, origin, secret).then((info) => {
        if (!info || (!info.videoFormats.length && !info.audioFormats.length)) {
          throw new Error(`invidious ${hostOf(inst)}: no formats`);
        }
        return mergeMeta(info, null);
      }),
    ),
    ...piped.map((inst) =>
      fromPiped(inst, id, origin, secret).then((info) => {
        if (!info || (!info.videoFormats.length && !info.audioFormats.length)) {
          throw new Error(`piped ${hostOf(inst)}: no formats`);
        }
        return mergeMeta(info, null);
      }),
    ),
  ];

  try {
    const info = await Promise.any(attempts);
    // Best-effort metadata fill from oEmbed (title/author/thumbnail gaps).
    const oembed = await fetchOEmbed(id);
    return json({ success: true, data: mergeMeta(info, oembed) });
  } catch {
    return json(
      {
        success: false,
        error:
          'Could not extract streams right now. The public extractors may be rate-limited or down — try again shortly, or try another video.',
      },
      502,
    );
  }
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

async function fromInvidious(
  inst: string,
  id: string,
  origin: string,
  secret: string,
): Promise<VideoInfo | null> {
  const fields =
    'title,author,lengthSeconds,videoThumbnails,formatStreams,adaptiveFormats';
  const res = await fetch(`${inst}/api/v1/videos/${id}?fields=${fields}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`invidious ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;

  const videoFormats: StreamFormat[] = [];
  const audioFormats: StreamFormat[] = [];

  const progressive = (j.formatStreams as Record<string, unknown>[]) ?? [];
  for (const f of progressive) {
    const sf = await invFormat(f, inst, id, origin, secret, true);
    if (sf) videoFormats.push(sf);
  }

  const adaptive = (j.adaptiveFormats as Record<string, unknown>[]) ?? [];
  for (const f of adaptive) {
    const type = String(f.type ?? '');
    const sf = await invFormat(f, inst, id, origin, secret, false);
    if (!sf) continue;
    if (type.startsWith('video/')) videoFormats.push(sf);
    else if (type.startsWith('audio/')) audioFormats.push(sf);
  }

  const thumbs = (j.videoThumbnails as Record<string, unknown>[]) ?? [];
  return {
    id,
    title: String(j.title ?? ''),
    author: j.author ? String(j.author) : undefined,
    thumbnail: thumbs[0]?.url ? String(thumbs[0].url) : '',
    duration: Number(j.lengthSeconds) || 0,
    videoFormats,
    audioFormats,
    source: `invidious:${hostOf(inst)}`,
  };
}

async function invFormat(
  f: Record<string, unknown>,
  inst: string,
  id: string,
  origin: string,
  secret: string,
  progressive: boolean,
): Promise<StreamFormat | null> {
  const type = String(f.type ?? '');
  const isVideo = progressive || type.startsWith('video/');
  const isAudio = progressive || type.startsWith('audio/');
  const container = type.includes('webm') ? 'webm' : type.includes('mp4') ? 'mp4' : 'mp4';
  const qualityLabel = f.qualityLabel ? String(f.qualityLabel) : '';
  const height = isVideo ? parseHeight(qualityLabel || String(f.resolution ?? '')) : undefined;
  const itag = Number(f.itag) || 0;

  let stream = String(f.url ?? '');
  if (stream) {
    try {
      const g = new URL(stream);
      stream = `${inst}/videoplayback${g.search}&host=${g.hostname}`;
    } catch {
      stream = `${inst}/latest_version?id=${id}&itag=${itag}&local=true`;
    }
  } else {
    stream = `${inst}/latest_version?id=${id}&itag=${itag}&local=true`;
  }

  return {
    itag,
    quality: qualityLabel || (isVideo ? (height ? `${height}p` : 'video') : 'audio'),
    height,
    fps: f.fps ? Number(f.fps) : undefined,
    container: isAudio && !isVideo ? (container === 'webm' ? 'opus' : 'm4a') : container,
    mimeType: type,
    hasVideo: isVideo,
    hasAudio: isAudio,
    bitrate: f.bitrate ? Number(f.bitrate) : undefined,
    contentLength: f.clen ? Number(f.clen) : f.contentLength ? Number(f.contentLength) : undefined,
    url: await proxied(origin, stream, secret),
  };
}

async function fromPiped(
  inst: string,
  id: string,
  origin: string,
  secret: string,
): Promise<VideoInfo | null> {
  const res = await fetch(`${inst}/streams/${id}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`piped ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;

  const videoFormats: StreamFormat[] = [];
  const audioFormats: StreamFormat[] = [];

  for (const f of (j.videoStreams as Record<string, unknown>[]) ?? []) {
    const sf = await pipedFormat(f, origin, secret, 'video');
    if (sf) videoFormats.push(sf);
  }
  for (const f of (j.audioStreams as Record<string, unknown>[]) ?? []) {
    const sf = await pipedFormat(f, origin, secret, 'audio');
    if (sf) audioFormats.push(sf);
  }

  return {
    id,
    title: String(j.title ?? ''),
    author: j.uploader ? String(j.uploader) : undefined,
    thumbnail: j.thumbnailUrl ? String(j.thumbnailUrl) : '',
    duration: Number(j.duration) || 0,
    videoFormats,
    audioFormats,
    source: `piped:${hostOf(inst)}`,
  };
}

async function pipedFormat(
  f: Record<string, unknown>,
  origin: string,
  secret: string,
  kind: 'video' | 'audio',
): Promise<StreamFormat | null> {
  const stream = String(f.url ?? '');
  if (!stream) return null;
  const mimeType = String(f.mimeType ?? '');
  const videoOnly = Boolean(f.videoOnly);
  const container = mimeType.includes('webm')
    ? kind === 'audio'
      ? 'opus'
      : 'webm'
    : kind === 'audio'
      ? 'm4a'
      : 'mp4';
  const quality = String(f.quality ?? (kind === 'audio' ? 'audio' : 'video'));
  const height = kind === 'video' ? parseHeight(quality) : undefined;

  return {
    itag: Number(f.itag) || 0,
    quality,
    height,
    fps: f.fps ? Number(f.fps) : undefined,
    container,
    mimeType,
    hasVideo: kind === 'video',
    hasAudio: kind === 'audio' ? true : !videoOnly,
    bitrate: f.bitrate ? Number(f.bitrate) : undefined,
    contentLength: f.contentLength ? Number(f.contentLength) : undefined,
    url: await proxied(origin, stream, secret),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchOEmbed(
  id: string,
): Promise<{ title?: string; author?: string; thumbnail?: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    return {
      title: j.title ? String(j.title) : undefined,
      author: j.author_name ? String(j.author_name) : undefined,
      thumbnail: j.thumbnail_url ? String(j.thumbnail_url) : undefined,
    };
  } catch {
    return null;
  }
}

function mergeMeta(
  info: VideoInfo,
  oembed: { title?: string; author?: string; thumbnail?: string } | null,
): VideoInfo {
  return {
    ...info,
    title: info.title || oembed?.title || `YouTube video ${info.id}`,
    author: info.author || oembed?.author,
    thumbnail: info.thumbnail || oembed?.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
  };
}

async function proxied(origin: string, target: string, secret: string): Promise<string> {
  const sig = await sign(target, secret);
  return `${origin}/api/proxy?url=${encodeURIComponent(target)}&sig=${sig}`;
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

function parseHeight(label: string): number | undefined {
  const m = /(\d{3,4})p?/.exec(label);
  return m ? Number(m[1]) : undefined;
}

function splitEnv(v?: string): string[] | null {
  if (!v) return null;
  const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : null;
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}
