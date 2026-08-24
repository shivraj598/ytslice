import { useState, useCallback } from 'react';
import type { VideoInfo, Clip, ProcessedClip, Mode, AudioOption } from '../types';
import { fetchVideoInfo, processClip, downloadClip, extractVideoId, parseTime, formatTime } from '../lib/api';

export function useVideo() {
  const [mode, setMode] = useState<Mode>('video');
  const [audioOption, setAudioOption] = useState<AudioOption>('full');
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [processedClips, setProcessedClips] = useState<ProcessedClip[]>([]);
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:30');
  const [loading, setLoading] = useState(false);
  const [processingClip, setProcessingClip] = useState<string | null>(null);
  const [downloadingClip, setDownloadingClip] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadVideo = useCallback(async () => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      showToast('Invalid YouTube URL. Try the full URL or a youtu.be link.');
      return;
    }

    setLoading(true);
    try {
      const info = await fetchVideoInfo(url);
      setVideoInfo(info);
      setEndTime(formatTime(Math.min(30, info.duration)));
      showToast('Video loaded. Set your range below.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [url, showToast]);

  const clearVideo = useCallback(() => {
    setVideoInfo(null);
    setClips([]);
    setProcessedClips([]);
    setUrl('');
    setStartTime('00:00:00');
    setEndTime('00:00:30');
  }, []);

  const handleTimeChange = useCallback((field: 'start' | 'end', value: string) => {
    const formatted = value.replace(/[^0-9:]/g, '').slice(0, 8);
    if (field === 'start') setStartTime(formatted);
    else setEndTime(formatted);
  }, []);

  const getClipDuration = useCallback(() => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return Math.max(0, end - start);
  }, [startTime, endTime]);

  const addClip = useCallback(async () => {
    if (!videoInfo) return;

    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (end <= start) {
      showToast('End time must be after start time');
      return;
    }

    if (end > videoInfo.duration) {
      showToast(`End time cannot exceed video duration (${formatTime(videoInfo.duration)})`);
      return;
    }

    const clip: Clip = {
      id: crypto.randomUUID(),
      startTime: start,
      endTime: end,
      quality: selectedQuality,
      format: mode,
    };

    setProcessingClip(clip.id);
    try {
      const processed = await processClip(url, clip);
      setProcessedClips(prev => [...prev, processed]);
      setClips(prev => [...prev, clip]);
      showToast('Clip processed. Ready to download.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to process clip');
    } finally {
      setProcessingClip(null);
    }
  }, [videoInfo, startTime, endTime, selectedQuality, mode, url, showToast]);

  const handleDownload = useCallback(async (clip: ProcessedClip) => {
    setDownloadingClip(clip.id);
    try {
      const blob = await downloadClip(clip.url);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = clip.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      showToast('Download started');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloadingClip(null);
    }
  }, [showToast]);

  const removeClip = useCallback((id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    setProcessedClips(prev => prev.filter(c => c.id !== id));
  }, []);

  const removeProcessedClip = useCallback((id: string) => {
    setProcessedClips(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    mode,
    setMode,
    audioOption,
    setAudioOption,
    url,
    setUrl,
    videoInfo,
    clips,
    processedClips,
    selectedQuality,
    setSelectedQuality,
    startTime,
    endTime,
    loading,
    processingClip,
    downloadingClip,
    toast,
    loadVideo,
    clearVideo,
    handleTimeChange,
    getClipDuration,
    addClip,
    handleDownload,
    removeClip,
    removeProcessedClip,
    showToast,
  };
}