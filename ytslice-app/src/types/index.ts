export type Mode = 'video' | 'audio';

export type AudioScope = 'full' | 'range';

/** A single downloadable stream, as returned (proxied) from /api/info. */
export interface StreamFormat {
  itag: number;
  /** Human label, e.g. "1080p", "720p", "medium". */
  quality: string;
  /** Numeric height for video streams (1080, 720, ...). undefined for audio. */
  height?: number;
  fps?: number;
  /** Container/extension: "mp4" | "webm" | "m4a" | "opus". */
  container: string;
  mimeType: string;
  hasVideo: boolean;
  hasAudio: boolean;
  bitrate?: number;
  contentLength?: number;
  /** Fully-qualified URL (already routed through our proxy) the browser can fetch. */
  url: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  author?: string;
  thumbnail: string;
  /** Length in seconds. 0 when the extractor could not determine it. */
  duration: number;
  /** Formats that contain a video track (progressive + video-only), best first. */
  videoFormats: StreamFormat[];
  /** Audio-only formats, best first. */
  audioFormats: StreamFormat[];
  /** Which extractor/instance produced this result (for debugging/telemetry). */
  source: string;
}

export type ClipStatus =
  | 'queued'
  | 'fetching'
  | 'processing'
  | 'ready'
  | 'error';

/** A user-defined cut. Time range is chosen first; quality is chosen at download. */
export interface Clip {
  id: string;
  label: string;
  /** Inclusive start, in seconds. */
  start: number;
  /** Exclusive end, in seconds. */
  end: number;
  mode: Mode;
  status: ClipStatus;
  /** 0..100 for the active phase. */
  progress: number;
  /** Short human-readable status line. */
  message?: string;
  /** Quality label actually used for the produced file. */
  quality?: string;
  /** Object URL for the finished blob (for re-download / preview). */
  blobUrl?: string;
  filename?: string;
  size?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
