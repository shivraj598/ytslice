import { useRef, useEffect, useState } from 'react';

interface VideoPreviewProps {
  videoInfo: {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
  } | null;
  onProcess: () => void;
  processing: boolean;
  showTimeline: boolean;
}

export function VideoPreview({ videoInfo, onProcess, processing, showTimeline }: VideoPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (videoInfo && showTimeline && iframeRef.current) {
      iframeRef.current.src = `https://www.youtube.com/embed/${videoInfo.id}?rel=0&enablejsapi=1`;
    }
  }, [videoInfo, showTimeline]);

  if (!videoInfo) return null;

  return (
    <div className="preview-row">
      <div className="thumbnail-wrap" id="media-preview">
        {showTimeline ? (
          <iframe
            ref={iframeRef}
            title="YouTube video preview"
            src={`https://www.youtube.com/embed/${videoInfo.id}?rel=0&enablejsapi=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
          />
        ) : (
          <>
            <img src={videoInfo.thumbnail} alt={videoInfo.title} />
            <span className="play-badge">▶</span>
          </>
        )}
      </div>
      <div className="video-details">
        <span className="detail-label">{showTimeline ? 'READY TO CUT' : 'VIDEO FOUND'}</span>
        <h2>{videoInfo.title}</h2>
        <p>youtube.com/watch?v={videoInfo.id}</p>
      </div>
      {!showTimeline && (
        <button className="process-button" onClick={onProcess} disabled={processing}>
          {processing ? 'Processing video…' : 'Process video <span aria-hidden="true">→</span>'}
        </button>
      )}
    </div>
  );
}

import { useState } from 'react';