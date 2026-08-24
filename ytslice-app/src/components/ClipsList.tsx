interface ClipsListProps {
  clips: Array<{
    id: string;
    startTime: number;
    endTime: number;
    quality: string;
    format: 'video' | 'audio';
  }>;
  processedClips: Array<{
    id: string;
    url: string;
    filename: string;
    format: 'video' | 'audio';
  }>;
  downloadingId: string | null;
  onDownload: (clip: { id: string; url: string; filename: string; format: 'video' | 'audio' }) => void;
  onRemove: (id: string) => void;
}

export function ClipsList({ clips, processedClips, downloadingId, onDownload, onRemove }: ClipsListProps) {
  if (processedClips.length === 0) return null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="clips-list" aria-live="polite">
      {processedClips.map((clip, index) => {
        const originalClip = clips[index];
        return (
          <div key={clip.id} className="saved-clip">
            <span>CLIP {index + 1}</span>
            <strong>{formatTime(originalClip?.startTime || 0)} → {formatTime(originalClip?.endTime || 0)}</strong>
            <span>{originalClip?.format === 'video' ? 'video' : 'audio'} / {originalClip?.quality || clip.format === 'video' ? 'MP3' : 'MP3'}</span>
            <button
              className="clip-download"
              type="button"
              onClick={() => onDownload(clip)}
              disabled={downloadingId === clip.id}
            >
              {downloadingId === clip.id ? 'Downloading…' : 'Download clip <span aria-hidden="true">↓</span>'}
            </button>
            <button className="clip-remove" type="button" onClick={() => onRemove(clip.id)} aria-label="Remove clip">
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}