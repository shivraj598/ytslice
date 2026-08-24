import type { VideoInfo } from '../types';
import { formatTime } from '../lib/youtube';
import { IconClock, IconX } from './icons';

interface VideoPreviewProps {
  info: VideoInfo;
  onClear: () => void;
}

export function VideoPreview({ info, onClear }: VideoPreviewProps) {
  return (
    <div className="preview">
      <div className="preview-media">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${info.id}?rel=0`}
          title={info.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="preview-info">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="meta-title">{info.title}</div>
          <div className="meta-sub">
            {info.author && <span>{info.author}</span>}
            {info.duration > 0 && (
              <span className="badge">
                <IconClock /> {formatTime(info.duration)}
              </span>
            )}
            {info.source && <span className="badge badge-accent">{info.source}</span>}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClear}>
          <IconX /> Clear
        </button>
      </div>
    </div>
  );
}
