export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
}

export interface VideoFormat {
  quality: string;
  formatId: string;
  ext: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  url?: string;
}

export interface Clip {
  id: string;
  startTime: number;
  endTime: number;
  quality: string;
  format: 'video' | 'audio';
}

export interface ProcessedClip {
  id: string;
  url: string;
  filename: string;
  format: 'video' | 'audio';
}

export type Mode = 'video' | 'audio';
export type AudioOption = 'full' | 'range';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}