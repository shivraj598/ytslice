import type { ApiResponse, StreamFormat, VideoInfo } from '../types';

const API_BASE = '/api';

/** Fetch metadata + proxied stream URLs from our Cloudflare Pages Function. */
export async function fetchVideoInfo(id: string, signal?: AbortSignal): Promise<VideoInfo> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/info?id=${encodeURIComponent(id)}`, { signal });
  } catch {
    throw new Error('Network error reaching the extractor.');
  }
  return parseInfoResponse(res);
}

async function parseInfoResponse(res: Response): Promise<VideoInfo> {
  let json: ApiResponse<VideoInfo>;
  try {
    json = (await res.json()) as ApiResponse<VideoInfo>;
  } catch {
    throw new Error(`Extractor returned an invalid response (HTTP ${res.status}).`);
  }
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error || `Could not load this video (HTTP ${res.status}).`);
  }
  return json.data;
}

/**
 * Download a stream fully into memory, reporting progress.
 * Streams are routed through /api/proxy (added by the info endpoint) so the
 * browser can read them with permissive CORS headers.
 */
export async function fetchStream(
  format: StreamFormat,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const res = await fetch(format.url, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`Couldn't fetch the ${format.quality} stream (HTTP ${res.status}).`);
  }

  const total =
    format.contentLength || Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (onProgress && total > 0) {
        onProgress(Math.min(100, (received / total) * 100));
      }
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  if (onProgress) onProgress(100);
  return out;
}

/**
 * Pick the video format closest to (but not exceeding, when possible) the
 * requested height label. Falls back to the best available.
 */
export function selectVideoFormat(
  formats: StreamFormat[],
  qualityLabel: string,
): StreamFormat | undefined {
  if (formats.length === 0) return undefined;
  const target = parseHeight(qualityLabel);

  // Prefer mp4 (H.264) so we can mux to a clean, universally-playable .mp4.
  const sorted = [...formats].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  if (!target) return preferMp4(sorted);

  const atOrBelow = sorted.filter((f) => (f.height ?? 0) <= target);
  const exact = sorted.filter((f) => f.height === target);
  if (exact.length) return preferMp4(exact);
  if (atOrBelow.length) return preferMp4(atOrBelow);
  // Nothing at/below target: return the smallest available above it.
  return sorted[sorted.length - 1];
}

/** Best audio track to pair with a video-only stream (or for MP3). */
export function selectAudioFormat(
  audioFormats: StreamFormat[],
  preferContainer?: string,
): StreamFormat | undefined {
  if (audioFormats.length === 0) return undefined;
  const sorted = [...audioFormats].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  if (preferContainer) {
    const match = sorted.find((f) => f.container === preferContainer);
    if (match) return match;
  }
  return sorted[0];
}

/** Distinct quality labels available for the quality dropdown, high → low. */
export function qualityOptions(formats: StreamFormat[]): string[] {
  const seen = new Set<string>();
  const labels: { label: string; height: number }[] = [];
  for (const f of formats) {
    if (!seen.has(f.quality)) {
      seen.add(f.quality);
      labels.push({ label: f.quality, height: f.height ?? 0 });
    }
  }
  return labels.sort((a, b) => b.height - a.height).map((l) => l.label);
}

function preferMp4(formats: StreamFormat[]): StreamFormat {
  return formats.find((f) => f.container === 'mp4') ?? formats[0];
}

function parseHeight(label: string): number {
  const m = /(\d{3,4})p?/.exec(label);
  return m ? Number(m[1]) : 0;
}
