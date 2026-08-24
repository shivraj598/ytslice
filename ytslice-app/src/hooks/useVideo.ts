import { useCallback, useMemo, useRef, useState } from 'react';
import type { AudioScope, Clip, Mode, VideoInfo } from '../types';
import type { ToastKind } from './useToast';
import {
  fetchStream,
  fetchVideoInfo,
  qualityOptions,
  selectAudioFormat,
  selectVideoFormat,
} from '../lib/api';
import { extractAudio, preloadFfmpeg, trimVideo } from '../lib/ffmpeg';
import { saveBlob } from '../lib/download';
import {
  extractVideoId,
  formatTime,
  slugifyTitle,
  stampTime,
} from '../lib/youtube';

type Notify = (kind: ToastKind, title: string, message?: string) => void;

const DEFAULT_QUALITY = '1080p';

/** A demo video so the whole editing flow can be explored without a backend. */
const DEMO_INFO: VideoInfo = {
  id: 'aqz-KE-bpKQ',
  title: 'Big Buck Bunny (demo)',
  author: 'Blender Foundation',
  thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
  duration: 634,
  source: 'demo',
  videoFormats: [
    fakeVideo(1080), fakeVideo(720), fakeVideo(480), fakeVideo(360),
  ],
  audioFormats: [
    { itag: 140, quality: 'audio', container: 'm4a', mimeType: 'audio/mp4', hasVideo: false, hasAudio: true, bitrate: 128000, url: '' },
  ],
};

function fakeVideo(height: number): VideoInfo['videoFormats'][number] {
  return {
    itag: height,
    quality: `${height}p`,
    height,
    fps: 30,
    container: 'mp4',
    mimeType: 'video/mp4',
    hasVideo: true,
    hasAudio: height <= 720,
    url: '',
  };
}

export interface AudioJobState {
  active: boolean;
  progress: number;
  message?: string;
}

export function useVideo(notify: Notify) {
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('video');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(30);
  const [clips, setClips] = useState<Clip[]>([]);
  const [audioScope, setAudioScope] = useState<AudioScope>('range');
  const [audioJob, setAudioJob] = useState<AudioJobState>({ active: false, progress: 0 });

  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const loadAbort = useRef<AbortController | null>(null);

  const isDemo = info?.source === 'demo';

  const videoQualityOptions = useMemo(
    () => (info ? qualityOptions(info.videoFormats) : []),
    [info],
  );

  const defaultQuality = useMemo(() => {
    if (videoQualityOptions.includes(DEFAULT_QUALITY)) return DEFAULT_QUALITY;
    return videoQualityOptions[0] ?? DEFAULT_QUALITY;
  }, [videoQualityOptions]);

  const setRange = useCallback((s: number, e: number) => {
    setStart(s);
    setEnd(e);
  }, []);

  const applyLoaded = useCallback((data: VideoInfo) => {
    setInfo(data);
    setStart(0);
    setEnd(data.duration > 0 ? Math.min(data.duration, 30) : 30);
    setClips([]);
  }, []);

  const loadVideo = useCallback(async () => {
    const id = extractVideoId(url);
    if (!id) {
      notify('error', 'That link doesn’t look right', 'Paste a full YouTube URL or a youtu.be link.');
      return;
    }
    loadAbort.current?.abort();
    const ac = new AbortController();
    loadAbort.current = ac;
    setLoading(true);
    try {
      const data = await fetchVideoInfo(id, ac.signal);
      applyLoaded(data);
      notify('success', 'Video ready', 'Set your range, then slice.');
      preloadFfmpeg();
    } catch (err) {
      if (ac.signal.aborted) return;
      notify(
        'error',
        'Couldn’t load that video',
        err instanceof Error ? err.message : 'Unknown error.',
      );
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [url, notify, applyLoaded]);

  const loadDemo = useCallback(() => {
    setUrl(`https://www.youtube.com/watch?v=${DEMO_INFO.id}`);
    applyLoaded(DEMO_INFO);
    notify('info', 'Demo loaded', 'Explore the editor. Downloads need a deployed backend.');
  }, [notify, applyLoaded]);

  const reset = useCallback(() => {
    loadAbort.current?.abort();
    for (const c of clips) if (c.blobUrl) URL.revokeObjectURL(c.blobUrl);
    setInfo(null);
    setUrl('');
    setClips([]);
    setStart(0);
    setEnd(30);
  }, [clips]);

  const patchClip = useCallback((id: string, patch: Partial<Clip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const addClip = useCallback(() => {
    if (!info) return;
    if (end - start < 1) {
      notify('error', 'Range too short', 'Pick at least a one-second clip.');
      return;
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}-${clips.length}`;
    const clip: Clip = {
      id,
      label: `Clip ${clips.length + 1}`,
      start,
      end,
      mode: 'video',
      status: 'queued',
      progress: 0,
    };
    setClips((prev) => [...prev, clip]);
    preloadFfmpeg();
    notify('info', 'Clip queued', `${formatTime(start)} → ${formatTime(end)}. Hit slice to render.`);
  }, [info, start, end, clips.length, notify]);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.blobUrl) URL.revokeObjectURL(target.blobUrl);
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const guardBusy = useCallback((): boolean => {
    if (busyRef.current) {
      notify('info', 'One at a time', 'Let the current render finish first.');
      return true;
    }
    return false;
  }, [notify]);

  const finishSave = useCallback(
    async (blob: Blob, filename: string) => {
      const result = await saveBlob(blob, filename);
      if (result === 'saved') notify('success', 'Saved', `Wrote ${filename} to your chosen folder.`);
      else if (result === 'downloaded') notify('success', 'Downloaded', filename);
      // 'canceled' → stay quiet
    },
    [notify],
  );

  const downloadClip = useCallback(
    async (clipId: string, quality: string) => {
      if (!info) return;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      // Re-save an already-rendered clip of the same quality without reprocessing.
      if (clip.status === 'ready' && clip.quality === quality && clip.blobUrl && clip.filename) {
        try {
          const blob = await (await fetch(clip.blobUrl)).blob();
          await finishSave(blob, clip.filename);
        } catch {
          notify('error', 'Save failed', 'Could not re-open the rendered clip.');
        }
        return;
      }

      if (isDemo) {
        notify('info', 'Demo mode', 'Deploy ytslice to Cloudflare Pages to render real downloads.');
        return;
      }
      if (guardBusy()) return;

      const vfmt = selectVideoFormat(info.videoFormats, quality);
      if (!vfmt) {
        notify('error', 'No stream', 'No video stream is available at that quality.');
        return;
      }
      const needAudio = !vfmt.hasAudio;
      const videoContainer = vfmt.container === 'webm' ? 'webm' : 'mp4';
      const afmt = needAudio
        ? selectAudioFormat(info.audioFormats, videoContainer === 'webm' ? 'webm' : 'm4a')
        : undefined;
      if (needAudio && !afmt) {
        notify('error', 'No audio stream', 'Couldn’t find an audio track to pair with this video.');
        return;
      }

      busyRef.current = true;
      setBusy(true);
      const dur = clip.end - clip.start;
      try {
        patchClip(clipId, { status: 'fetching', progress: 0, message: `Fetching ${vfmt.quality}…` });
        const videoData = await fetchStream(vfmt, (pct) =>
          patchClip(clipId, { progress: pct }),
        );

        let audioData: Uint8Array | undefined;
        if (needAudio && afmt) {
          patchClip(clipId, { progress: 0, message: 'Fetching audio…' });
          audioData = await fetchStream(afmt, (pct) => patchClip(clipId, { progress: pct }));
        }

        patchClip(clipId, { status: 'processing', progress: 0, message: 'Cutting clip…' });
        const { blob, ext } = await trimVideo({
          video: videoData,
          videoContainer,
          audio: audioData,
          audioContainer: afmt?.container,
          start: clip.start,
          duration: dur,
          onProgress: (pct) => patchClip(clipId, { progress: pct }),
        });

        const filename = `${slugifyTitle(info.title)} [${stampTime(clip.start)}–${stampTime(clip.end)}] ${vfmt.quality}.${ext}`;
        const blobUrl = URL.createObjectURL(blob);
        patchClip(clipId, {
          status: 'ready',
          progress: 100,
          quality: vfmt.quality,
          filename,
          size: blob.size,
          blobUrl,
          message: undefined,
        });
        await finishSave(blob, filename);
      } catch (err) {
        patchClip(clipId, {
          status: 'error',
          message: err instanceof Error ? err.message : 'Render failed.',
        });
        notify('error', 'Slice failed', err instanceof Error ? err.message : 'Unknown error.');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [info, clips, isDemo, guardBusy, patchClip, finishSave, notify],
  );

  const downloadAudio = useCallback(async () => {
    if (!info) return;
    if (isDemo) {
      notify('info', 'Demo mode', 'Deploy ytslice to Cloudflare Pages to render real downloads.');
      return;
    }
    if (guardBusy()) return;

    const src =
      selectAudioFormat(info.audioFormats) ??
      info.videoFormats.find((f) => f.hasAudio);
    if (!src) {
      notify('error', 'No audio stream', 'This video didn’t expose a usable audio track.');
      return;
    }

    const ranged = audioScope === 'range';
    if (ranged && end - start < 1) {
      notify('error', 'Range too short', 'Pick at least a one-second range first.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setAudioJob({ active: true, progress: 0, message: 'Fetching audio…' });
    try {
      const data = await fetchStream(src, (pct) =>
        setAudioJob({ active: true, progress: pct, message: 'Fetching audio…' }),
      );
      setAudioJob({ active: true, progress: 0, message: 'Encoding MP3…' });
      const { blob, ext } = await extractAudio({
        data,
        container: src.container,
        start: ranged ? start : undefined,
        duration: ranged ? end - start : undefined,
        onProgress: (pct) => setAudioJob({ active: true, progress: pct, message: 'Encoding MP3…' }),
      });
      const tag = ranged ? ` [${stampTime(start)}–${stampTime(end)}]` : '';
      const filename = `${slugifyTitle(info.title)}${tag}.${ext}`;
      await finishSave(blob, filename);
    } catch (err) {
      notify('error', 'Audio failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setAudioJob({ active: false, progress: 0 });
      busyRef.current = false;
      setBusy(false);
    }
  }, [info, isDemo, guardBusy, audioScope, start, end, finishSave, notify]);

  return {
    // state
    url,
    setUrl,
    info,
    loading,
    mode,
    setMode,
    start,
    end,
    setRange,
    clips,
    audioScope,
    setAudioScope,
    audioJob,
    busy,
    isDemo,
    // derived
    videoQualityOptions,
    defaultQuality,
    hasVideo: !!info,
    // actions
    loadVideo,
    loadDemo,
    reset,
    addClip,
    removeClip,
    downloadClip,
    downloadAudio,
  };
}
