// Supabase Edge Function: ytslice
//
// GET /functions/v1/ytslice?id=VIDEO_ID&origin=https://ytslice.pages.dev
//
// Reliable stream extraction for ytslice. Tries, in order:
//   1. youtubei.js (YouTube InnerTube API — proper extraction, runs here)
//   2. Public Invidious instances
//   3. Public Piped instances
//
// Every stream URL is rewritten to `${origin}/api/proxy?url=<enc>&sig=<hmac>`
// so the browser can read bytes through the Cloudflare Pages streaming proxy.
// The HMAC secret MUST match PROXY_SECRET used by functions/api/proxy.ts.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
} as const;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405);
  }

  const reqUrl = new URL(req.url);
  let id = reqUrl.searchParams.get('id') ?? '';
  let origin = reqUrl.searchParams.get('origin') ?? '';
  if (!id && req.method === 'POST') {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      id = String(body.id ?? '');
      origin = origin || String(body.origin ?? '');
    } catch { /* ignore */ }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return json({ success: false, error: 'Invalid or missing video id.' }, 400);
  }
  if (!/^https?:\/\//.test(origin)) origin = 'https://ytslice.pages.dev';

  const secret = Deno.env.get('PROXY_SECRET') ?? 'ytslice-proxy-v1';

  // 1) InnerTube via youtubei.js
  try {
    const info = await fromInnerTube(id, origin, secret);
    if (info && (info.videoFormats.length || info.audioFormats.length)) {
      return json({ success: true, data: info });
    }
  } catch (err) {
    console.error('innertube failed:', err instanceof Error ? err.message : err);
  }

  // 2) Invidious fallback
  for (const inst of instances('INVIDIOUS_INSTANCES', DEFAULT_INVIDIOUS)) {
    try {
      const info = await fromInvidious(inst, id, origin, secret);
      if (info && (info.videoFormats.length || info.audioFormats.length)) {
        return json({ success: true, data: info });
      }
    } catch { /* next */ }
  }

  // 3) Piped fallback
  for (const inst of instances('PIPED_INSTANCES', DEFAULT_PIPED)) {
    try {
      const info = await fromPiped(inst, id, origin, secret);
      if (info && (info.videoFormats.length || info.audioFormats.length)) {
        return json({ success: true, data: info });
      }
    } catch { /* next */ }
  }

  return json(
    {
      success: false,
      error:
        'Could not extract streams right now. All extractors are rate-limited or down — try again shortly.',
    },
    502,
  );
});

// ---------------------------------------------------------------------------
// 1) InnerTube (youtubei.js)
// ---------------------------------------------------------------------------

async function fromInnerTube(
  id: string,
  origin: string,
  secret: string,
): Promise<VideoInfo | null> {
  // Dynamic import so an npm resolution problem degrades to the fallbacks
  // instead of failing the whole function.
  const mod: any = await import('npm:youtubei.js@13.4.0');
  const Innertube = mod.Innertube ?? mod.default?.Innertube;
  if (!Innertube) throw new Error('youtubei.js did not export Innertube');

  let playerResponse: any = null;
  let clientUsed = 'WEB';
  const yt = await Innertube.create();
  try {
    playerResponse = await yt.getInfo(id);
  } catch {
    playerResponse = null;
  }
  if (!playerResponse?.streaming_data) {
    try {
      const ytAlt = await Innertube.create({ client: 'IOS' });
      playerResponse = await ytAlt.getInfo(id, 'IOS');
      clientUsed = 'IOS';
    } catch {
      playerResponse = null;
    }
  }
  if (!playerResponse?.streaming_data) throw new Error('no streaming_data');

  const basic = playerResponse.basic_info ?? {};
  const sd = playerResponse.streaming_data;

  const videoFormats: StreamFormat[] = [];
  const audioFormats: StreamFormat[] = [];
  const all: any[] = [
    ...(sd.progressive_formats ?? []),
    ...(sd.adaptive_formats ?? []),
  ];

  for (const f of all) {
    const url: string | undefined = typeof f.decipher === 'function'
      ? (() => { try { return f.decipher(yt.session.player); } catch { return f.url; } })()
      : f.url;
    if (!url) continue;
    const mime = String(f.mime_type ?? '');
    const isVideo = Boolean(f.has_video);
    const height = Number(f.height) || parseHeight(String(f.quality_label ?? ''));
    const audioOnly = !isVideo;

    const sf: StreamFormat = {
      itag: Number(f.itag) || 0,
      quality: String(f.quality_label ?? f.quality ?? (audioOnly ? 'audio' : 'video')),
      height: isVideo ? (height || undefined) : undefined,
      fps: f.fps ? Number(f.fps) : undefined,
      container: containerOf(mime, audioOnly),
      mimeType: mime,
      hasVideo: isVideo,
      hasAudio: Boolean(f.has_audio),
      bitrate: f.bitrate ? Number(f.bitrate) : undefined,
      contentLength: f.content_length ? Number(f.content_length) : undefined,
      url: await proxied(origin, url, secret),
    };
    if (isVideo || f.has_audio === false) videoFormats.push(sf);
    if (!isVideo) audioFormats.push(sf);
  }

  sortDesc(videoFormats, (f) => f.height ?? 0);
  sortDesc(audioFormats, (f) => f.bitrate ?? 0);

  return {
    id,
    title: String(basic.title ?? `YouTube video ${id}`),
    author: basic.author ? String(basic.author) : undefined,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: Number(basic.duration) || 0,
    videoFormats,
    audioFormats,
    source: `innertube:${clientUsed}`,
  };
}

// ---------------------------------------------------------------------------
// 2) Invidious
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
  const j = (await res.json()) as Record<string, any>;

  const videoFormats: StreamFormat[] = [];
  const audioFormats: StreamFormat[] = [];

  for (const f of (j.formatStreams as any[]) ?? []) {
    const sf = await invFormat(f, inst, id, origin, secret, true);
    if (sf) videoFormats.push(sf);
  }
  for (const f of (j.adaptiveFormats as any[]) ?? []) {
    const type = String(f.type ?? '');
    const sf = await invFormat(f, inst, id, origin, secret, false);
    if (!sf) continue;
    if (type.startsWith('video/')) videoFormats.push(sf);
    else if (type.startsWith('audio/')) audioFormats.push(sf);
  }

  const thumbs = (j.videoThumbnails as any[]) ?? [];
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
  f: Record<string, any>,
  inst: string,
  id: string,
  origin: string,
  secret: string,
  progressive: boolean,
): Promise<StreamFormat | null> {
  const type = String(f.type ?? '');
  const isVideo = progressive || type.startsWith('video/');
  const isAudio = progressive || type.startsWith('audio/');
  const rawContainer = type.includes('webm') ? 'webm' : 'mp4';
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
    container: isAudio && !isVideo ? (rawContainer === 'webm' ? 'opus' : 'm4a') : rawContainer,
    mimeType: type,
    hasVideo: isVideo,
    hasAudio: isAudio,
    bitrate: f.bitrate ? Number(f.bitrate) : undefined,
    contentLength: f.clen ? Number(f.clen) : f.contentLength ? Number(f.contentLength) : undefined,
    url: await proxied(origin, stream, secret),
  };
}

// ---------------------------------------------------------------------------
// 3) Piped
// ---------------------------------------------------------------------------

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
  const j = (await res.json()) as Record<string, any>;

  const videoFormats: StreamFormat[] = [];
  const audioFormats: StreamFormat[] = [];

  for (const f of (j.videoStreams as any[]) ?? []) {
    const sf = await pipedFormat(f, origin, secret, 'video');
    if (sf) videoFormats.push(sf);
  }
  for (const f of (j.audioStreams as any[]) ?? []) {
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
  f: Record<string, any>,
  origin: string,
  secret: string,
  kind: 'video' | 'audio',
): Promise<StreamFormat | null> {
  const stream = String(f.url ?? '');
  if (!stream) return null;
  const mimeType = String(f.mimeType ?? '');
  const videoOnly = Boolean(f.videoOnly);
  const container = mimeType.includes('webm')
    ? kind === 'audio' ? 'opus' : 'webm'
    : kind === 'audio' ? 'm4a' : 'mp4';
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function instances(envVar: string, fallback: string[]): string[] {
  const v = Deno.env.get(envVar);
  if (!v) return fallback;
  const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : fallback;
}

function containerOf(mime: string, audioOnly: boolean): string {
  if (mime.includes('webm')) return audioOnly ? 'opus' : 'webm';
  if (mime.includes('mp4') || mime.includes('aac')) return audioOnly ? 'm4a' : 'mp4';
  return audioOnly ? 'm4a' : 'mp4';
}

function sortDesc<T>(arr: T[], key: (t: T) => number): void {
  arr.sort((a, b) => key(b) - key(a));
}

function parseHeight(label: string): number | undefined {
  const m = /(\d{3,4})p?/.exec(label);
  return m ? Number(m[1]) : undefined;
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
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
