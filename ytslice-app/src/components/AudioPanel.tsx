import type { AudioScope } from '../types';
import { formatTime } from '../lib/youtube';
import { IconDownload, IconMusic, IconScissors } from './icons';

export interface AudioJobView {
  active: boolean;
  progress: number;
  message?: string;
}

interface AudioPanelProps {
  scope: AudioScope;
  onScopeChange: (scope: AudioScope) => void;
  start: number;
  end: number;
  duration: number;
  busy: boolean;
  job: AudioJobView;
  onDownload: () => void;
}

export function AudioPanel({
  scope,
  onScopeChange,
  start,
  end,
  duration,
  busy,
  job,
  onDownload,
}: AudioPanelProps) {
  const clipLen = Math.max(0, end - start);

  return (
    <div className="stack">
      <div className="option-grid">
        <button
          type="button"
          className="option-card"
          data-active={scope === 'full'}
          onClick={() => onScopeChange('full')}
        >
          <div className="oc-head">
            <span className="oc-radio" />
            <IconMusic /> Full track
          </div>
          <p>
            Extract the entire video's audio as one MP3
            {duration > 0 ? ` · ${formatTime(duration)}` : ''}.
          </p>
        </button>

        <button
          type="button"
          className="option-card"
          data-active={scope === 'range'}
          onClick={() => onScopeChange('range')}
        >
          <div className="oc-head">
            <span className="oc-radio" />
            <IconScissors /> Selected range
          </div>
          <p>
            Only the slice you picked above
            {clipLen > 0 ? ` · ${formatTime(start)}–${formatTime(end)} (${formatTime(clipLen)})` : ''}.
          </p>
        </button>
      </div>

      {job.active ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${Math.max(4, job.progress)}%` }} />
          </div>
          <div className="clip-progress">
            <div className="row">
              <span>{job.message || 'Extracting audio…'}</span>
              <span>{Math.round(job.progress)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary btn-lg btn-block" onClick={onDownload} disabled={busy}>
          <IconDownload />
          {scope === 'full' ? 'Download full MP3' : 'Slice & download MP3'}
        </button>
      )}
    </div>
  );
}
