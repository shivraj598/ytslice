import type { VideoInfo, Clip, ProcessedClip, ApiResponse } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const data = await fetchJson<ApiResponse<VideoInfo>>(`${API_BASE}/video-info`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return data.data!;
}

export async function processClip(
  videoUrl: string,
  clip: Clip
): Promise<ProcessedClip> {
  const data = await fetchJson<ApiResponse<ProcessedClip>>(`${API_BASE}/process-clip`, {
    method: 'POST',
    body: JSON.stringify({ videoUrl, clip }),
  });
  return data.data!;
}

export async function downloadClip(url: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.blob();
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('/')[0];
    }
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v') || parsed.pathname.split('/').pop() || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}