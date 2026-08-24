import { useRef } from 'react';

interface UrlInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onLoad: () => void;
  onClear: () => void;
  loading: boolean;
  hasVideo: boolean;
  error?: string;
}

export function UrlInput({ url, onUrlChange, onLoad, onClear, loading, hasVideo, error }: UrlInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onLoad();
  };

  return (
    <div className="url-row">
      <label htmlFor="video-url">Paste a YouTube link</label>
      <div className="url-control">
        <input
          ref={inputRef}
          id="video-url"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          disabled={loading}
        />
        {hasVideo ? (
          <button className="clear-button" type="button" onClick={onClear} aria-label="Clear loaded video">
            ×
          </button>
        ) : (
          <button
            className="load-button"
            type="button"
            onClick={onLoad}
            disabled={loading || !url.trim()}
          >
            {loading ? 'Loading…' : 'Load video <span aria-hidden="true">→</span>'}
          </button>
        )}
      </div>
      <p className={`field-note ${error ? 'error' : ''}`}>
        {error || (hasVideo ? 'Video loaded. Set your range below.' : 'Try a link to see its preview and choose your cut.')}
      </p>
    </div>
  );
}

