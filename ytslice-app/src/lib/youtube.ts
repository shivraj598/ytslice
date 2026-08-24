/** Extract the 11-char video id from any common YouTube URL shape. */
export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return isId(id) ? id : null;
  }

  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const v = url.searchParams.get('v');
    if (isId(v)) return v;
    // /shorts/ID, /embed/ID, /live/ID, /v/ID
    const parts = url.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex((p) => ['shorts', 'embed', 'live', 'v'].includes(p));
    if (marker !== -1 && isId(parts[marker + 1])) return parts[marker + 1];
    const last = parts[parts.length - 1];
    if (isId(last)) return last;
  }

  return null;
}

function isId(v: string | null | undefined): v is string {
  return !!v && /^[a-zA-Z0-9_-]{11}$/.test(v);
}

/** Seconds -> "H:MM:SS" (or "M:SS" when under an hour). */
export function formatTime(totalSeconds: number, forceHours = false): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

/** Seconds -> "HH-MM-SS", safe for filenames. */
export function stampTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}-${m}-${sec}`;
}

/** Parse "H:MM:SS" / "M:SS" / "SS" (also tolerates a bare number) to seconds. */
export function parseTime(value: string): number {
  const v = value.trim();
  if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.floor(Number(v));
  const parts = v.split(':').map((p) => Number(p) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/** Turn a video title into a filesystem-friendly slug. */
export function slugifyTitle(title: string, max = 80): string {
  const cleaned = (title || 'clip')
    .replace(/[\\/:*?"<>|]+/g, ' ') // illegal filename chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return cleaned || 'clip';
}

/** Human-readable byte size. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
