import type { KeyboardEvent } from 'react';
import { IconLink, IconSparkle } from './icons';

interface UrlInputProps {
  value: string;
  onChange: (v: string) => void;
  onLoad: () => void;
  onDemo: () => void;
  loading: boolean;
  hasVideo: boolean;
}

export function UrlInput({ value, onChange, onLoad, onDemo, loading, hasVideo }: UrlInputProps) {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) onLoad();
  };

  return (
    <div>
      <label className="field-label" htmlFor="yt-url">
        YouTube link
      </label>
      <div className="url-row">
        <div className="input-wrap">
          <IconLink />
          <input
            id="yt-url"
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button className="btn btn-primary btn-lg" onClick={onLoad} disabled={loading || !value.trim()}>
          {loading ? (
            <>
              <span className="spinner" /> Processing…
            </>
          ) : hasVideo ? (
            'Reload'
          ) : (
            'Process video'
          )}
        </button>
      </div>
      {!hasVideo && !loading && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={onDemo}>
          <IconSparkle /> Try it with a demo video
        </button>
      )}
    </div>
  );
}
