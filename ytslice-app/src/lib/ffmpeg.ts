/**
 * ffmpeg.wasm wrapper.
 *
 * The core (~31 MB) is loaded from a CDN at runtime *in the user's browser* —
 * nothing is bundled at build time, which keeps the app deployable as a static
 * site on Cloudflare Pages. We use the single-threaded core so we don't need
 * cross-origin isolation (COOP/COEP) headers.
 */

const FFMPEG_UMD = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
const UTIL_UMD = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js';
const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

interface FFmpegInstance {
  loaded: boolean;
  load(opts: { coreURL: string; wasmURL: string }): Promise<boolean>;
  on(event: 'progress', cb: (e: { progress: number; time: number }) => void): void;
  on(event: 'log', cb: (e: { type: string; message: string }) => void): void;
  writeFile(name: string, data: Uint8Array): Promise<boolean>;
  readFile(name: string): Promise<Uint8Array>;
  deleteFile(name: string): Promise<boolean>;
  exec(args: string[]): Promise<number>;
}

interface FFmpegUtilNS {
  fetchFile(data: Blob | ArrayBuffer | string): Promise<Uint8Array>;
  toBlobURL(url: string, mimeType: string): Promise<string>;
}

declare global {
  interface Window {
    FFmpegWASM?: { FFmpeg: new () => FFmpegInstance };
    FFmpegUtil?: FFmpegUtilNS;
  }
}

let ffmpeg: FFmpegInstance | null = null;
let loadPromise: Promise<FFmpegInstance> | null = null;
/** The FFmpeg instance emits a single global progress stream; route it here. */
let activeProgress: ((pct: number) => void) | null = null;

export function isFfmpegReady(): boolean {
  return !!ffmpeg?.loaded;
}

function injectScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-ff="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.ff = src;
    s.addEventListener('load', () => {
      s.dataset.loaded = 'true';
      resolve();
    });
    s.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(s);
  });
}

/** Load ffmpeg.wasm once; subsequent calls reuse the same instance. */
export async function loadFfmpeg(onStatus?: (msg: string) => void): Promise<FFmpegInstance> {
  if (ffmpeg?.loaded) return ffmpeg;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onStatus?.('Fetching the video engine…');
    await injectScript(FFMPEG_UMD);
    await injectScript(UTIL_UMD);
    if (!window.FFmpegWASM || !window.FFmpegUtil) {
      throw new Error('Could not initialise the video engine.');
    }
    const instance = new window.FFmpegWASM.FFmpeg();
    instance.on('progress', ({ progress }) => {
      if (activeProgress) activeProgress(clampPct(progress * 100));
    });
    onStatus?.('Starting the video engine (~31 MB, first run only)…');
    const { toBlobURL } = window.FFmpegUtil;
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);
    await instance.load({ coreURL, wasmURL });
    ffmpeg = instance;
    return instance;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null; // allow a retry
    throw err;
  }
}

/** Kick off the (large) engine download early, ignoring failures. */
export function preloadFfmpeg(): void {
  loadFfmpeg().catch(() => {});
}

export interface TrimVideoInput {
  video: Uint8Array;
  videoContainer: string; // 'mp4' | 'webm'
  audio?: Uint8Array; // present when the video stream has no audio track
  audioContainer?: string; // 'm4a' | 'webm' | 'opus'
  start: number;
  duration: number;
  onProgress?: (pct: number) => void;
}

export interface MediaResult {
  blob: Blob;
  ext: string;
}

/** Trim a video (and mux a separate audio track when supplied) to [start, start+duration]. */
export async function trimVideo(input: TrimVideoInput): Promise<MediaResult> {
  const ff = await loadFfmpeg();
  activeProgress = input.onProgress ?? null;

  const vName = `video_in.${input.videoContainer}`;
  const files = [vName];
  await ff.writeFile(vName, input.video);

  let aName: string | undefined;
  if (input.audio && input.audioContainer) {
    aName = `audio_in.${input.audioContainer}`;
    await ff.writeFile(aName, input.audio);
    files.push(aName);
  }

  // Copy muxing keeps codecs when the source is mp4 -> output mp4; otherwise webm.
  const outExt = input.videoContainer === 'mp4' ? 'mp4' : 'webm';
  const outName = `clip_out.${outExt}`;
  files.push(outName);
  const ss = input.start.toFixed(3);
  const dur = input.duration.toFixed(3);

  const copyArgs: string[] = ['-ss', ss, '-i', vName];
  if (aName) copyArgs.push('-ss', ss, '-i', aName);
  copyArgs.push('-t', dur);
  if (aName) copyArgs.push('-map', '0:v:0', '-map', '1:a:0');
  copyArgs.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
  if (outExt === 'mp4') copyArgs.push('-movflags', '+faststart');
  copyArgs.push(outName);

  let code = await ff.exec(copyArgs);

  if (code !== 0) {
    // Stream-copy can fail on odd keyframe layouts — fall back to a re-encode.
    input.onProgress?.(0);
    const reArgs: string[] = ['-ss', ss, '-i', vName];
    if (aName) reArgs.push('-ss', ss, '-i', aName);
    reArgs.push('-t', dur);
    if (aName) reArgs.push('-map', '0:v:0', '-map', '1:a:0');
    reArgs.push(
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart',
      outName,
    );
    code = await ff.exec(reArgs);
  }

  if (code !== 0) {
    await cleanup(ff, files);
    activeProgress = null;
    throw new Error('Could not cut this clip. The stream format may be unsupported.');
  }

  const data = await ff.readFile(outName);
  const blob = new Blob([data as BlobPart], { type: outExt === 'mp4' ? 'video/mp4' : 'video/webm' });
  await cleanup(ff, files);
  activeProgress = null;
  return { blob, ext: outExt };
}

export interface ExtractAudioInput {
  data: Uint8Array;
  container: string;
  start?: number;
  duration?: number;
  onProgress?: (pct: number) => void;
}

/** Extract MP3 from an audio (or progressive) stream, optionally trimmed. */
export async function extractAudio(input: ExtractAudioInput): Promise<MediaResult> {
  const ff = await loadFfmpeg();
  activeProgress = input.onProgress ?? null;

  const inName = `audio_src.${input.container}`;
  await ff.writeFile(inName, input.data);

  const mp3Name = 'audio_out.mp3';
  const mp3Args: string[] = [];
  if (input.start != null) mp3Args.push('-ss', input.start.toFixed(3));
  mp3Args.push('-i', inName);
  if (input.duration != null) mp3Args.push('-t', input.duration.toFixed(3));
  mp3Args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2', mp3Name);

  let code = await ff.exec(mp3Args);
  if (code === 0) {
    const data = await ff.readFile(mp3Name);
    const blob = new Blob([data as BlobPart], { type: 'audio/mpeg' });
    await cleanup(ff, [inName, mp3Name]);
    activeProgress = null;
    return { blob, ext: 'mp3' };
  }

  // Fallback: some core builds omit libmp3lame — copy the source audio to m4a.
  const m4aName = 'audio_out.m4a';
  const m4aArgs: string[] = [];
  if (input.start != null) m4aArgs.push('-ss', input.start.toFixed(3));
  m4aArgs.push('-i', inName);
  if (input.duration != null) m4aArgs.push('-t', input.duration.toFixed(3));
  m4aArgs.push('-vn', '-c:a', 'copy', m4aName);

  code = await ff.exec(m4aArgs);
  if (code !== 0) {
    await cleanup(ff, [inName, mp3Name, m4aName]);
    activeProgress = null;
    throw new Error('Could not extract audio from this stream.');
  }
  const data = await ff.readFile(m4aName);
  const blob = new Blob([data as BlobPart], { type: 'audio/mp4' });
  await cleanup(ff, [inName, mp3Name, m4aName]);
  activeProgress = null;
  return { blob, ext: 'm4a' };
}

async function cleanup(ff: FFmpegInstance, names: (string | undefined)[]): Promise<void> {
  for (const name of names) {
    if (!name) continue;
    try {
      await ff.deleteFile(name);
    } catch {
      /* file may not exist — ignore */
    }
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
