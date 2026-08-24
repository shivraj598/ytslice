import { useEffect, useRef, useState } from 'react';
import type { Clip } from '../types';
import { formatTime } from '../lib/youtube';
import { formatBytes } from '../lib/youtube';
import {
  IconCheck,
  IconChevronDown,
  IconDownload,
  IconTrash,
} from './icons';

interface ClipsListProps {
  clips: Clip[];
  qualityOptions: string[];
  defaultQuality: string;
  busy: boolean;
  onDownload: (clipId: string, quality: string) => void;
  onRemove: (clipId: string) => void;
}

export function ClipsList({
  clips,
  qualityOptions,
  defaultQuality,
  busy,
  onDownload,
  onRemove,
}: ClipsListProps) {
  if (clips.length === 0) {
    return (
      <div className="clips-empty">
        No clips yet — set a range above and hit <strong>Slice</strong> to queue one.
      </div>
    );
  }

  return (
    <div className="clips">
      {clips.map((clip, i) => (
        <ClipRow
          key={clip.id}
          clip={clip}
          index={i + 1}
          qualityOptions={qualityOptions}
          defaultQuality={defaultQuality}
          busy={busy}
          onDownload={onDownload}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface ClipRowProps {
  clip: Clip;
  index: number;
  qualityOptions: string[];
  defaultQuality: string;
  busy: boolean;
  onDownload: (clipId: string, quality: string) => void;
  onRemove: (clipId: string) => void;
}

function ClipRow({
  clip,
  index,
  qualityOptions,
  defaultQuality,
  busy,
  onDownload,
  onRemove,
}: ClipRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const active = clip.status === 'fetching' || clip.status === 'processing';
  const isReady = clip.status === 'ready';
  const isError = clip.status === 'error';
  const disabled = busy || active;

  const primaryQuality = clip.quality || defaultQuality;

  const pick = (quality: string) => {
    setMenuOpen(false);
    onDownload(clip.id, quality);
  };

  return (
    <div className="clip">
      <div className="clip-index">{index}</div>

      <div className="clip-body">
        <div className="clip-range">
          <span>{formatTime(clip.start)}</span>
          <span className="arrow">→</span>
          <span>{formatTime(clip.end)}</span>
          <span className="badge">{formatTime(Math.max(0, clip.end - clip.start))}</span>
        </div>
        <div className="clip-sub">
          {isReady && (
            <span className="badge badge-success">
              <IconCheck /> {clip.quality || primaryQuality}
              {clip.size ? ` · ${formatBytes(clip.size)}` : ''}
            </span>
          )}
          {isError && <span className="badge badge-danger">{clip.message || 'Failed'}</span>}
          {!active && !isReady && !isError && <span>Queued · {primaryQuality} default</span>}
          {active && <span>{clip.message || 'Working…'}</span>}
        </div>
      </div>

      <div className="clip-actions">
        {active ? (
          <button className="btn btn-secondary btn-sm" disabled>
            <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
            {Math.round(clip.progress)}%
          </button>
        ) : (
          <div className="split" ref={wrapRef}>
            <button
              className="btn btn-primary btn-sm"
              disabled={disabled}
              onClick={() => onDownload(clip.id, primaryQuality)}
              title={`Download ${primaryQuality}`}
            >
              <IconDownload />
              {isReady ? 'Save again' : `Download ${primaryQuality}`}
            </button>
            {qualityOptions.length > 0 && (
              <button
                className="btn btn-primary btn-sm split-caret"
                disabled={disabled}
                aria-label="Choose quality"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <IconChevronDown />
              </button>
            )}
            {menuOpen && (
              <div className="menu" role="menu">
                <div className="menu-label">Download quality</div>
                {qualityOptions.map((q) => (
                  <button
                    key={q}
                    className="menu-item"
                    role="menuitem"
                    data-active={q === primaryQuality}
                    onClick={() => pick(q)}
                  >
                    <span>{q}</span>
                    {q === primaryQuality && <IconCheck />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onRemove(clip.id)}
          disabled={active}
          aria-label="Remove clip"
          title="Remove"
        >
          <IconTrash />
        </button>
      </div>

      {active && (
        <div className="clip-progress">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${Math.max(4, clip.progress)}%` }} />
          </div>
          <div className="row">
            <span>{clip.message || 'Working…'}</span>
            <span>{Math.round(clip.progress)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
