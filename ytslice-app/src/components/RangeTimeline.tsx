import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { formatTime, parseTime } from '../lib/youtube';

const MIN_CLIP = 1; // seconds

interface RangeTimelineProps {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

export function RangeTimeline({ duration, start, end, onChange }: RangeTimelineProps) {
  const hasDuration = duration > 0;
  const max = hasDuration ? duration : Math.max(end, 60);

  const clamp = (s: number, e: number): [number, number] => {
    let ns = Math.max(0, Math.min(s, max - MIN_CLIP));
    let ne = Math.min(max, Math.max(e, ns + MIN_CLIP));
    if (ne - ns < MIN_CLIP) ns = Math.max(0, ne - MIN_CLIP);
    return [Math.round(ns), Math.round(ne)];
  };

  const setStart = (v: number) => {
    const [s, e] = clamp(v, Math.max(end, v + MIN_CLIP));
    onChange(s, e);
  };
  const setEnd = (v: number) => {
    const [s, e] = clamp(Math.min(start, v - MIN_CLIP), v);
    onChange(s, e);
  };

  const leftPct = hasDuration ? (start / max) * 100 : 0;
  const widthPct = hasDuration ? ((end - start) / max) * 100 : 0;

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span className="field-label" style={{ margin: 0 }}>
          Set your cut
        </span>
        <span className="duration-pill">
          {formatTime(Math.max(0, end - start))} clip
        </span>
      </div>

      {hasDuration && (
        <div className="range">
          <div className="range-track" />
          <div className="range-fill" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={start}
            aria-label="Start time"
            style={{ zIndex: start > max - max * 0.08 ? 5 : 3 }}
            onChange={(e) => setStart(Number(e.target.value))}
          />
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={end}
            aria-label="End time"
            style={{ zIndex: 4 }}
            onChange={(e) => setEnd(Number(e.target.value))}
          />
        </div>
      )}

      <div className="time-grid">
        <div>
          <label className="field-label">Start</label>
          <TimeField seconds={start} max={max} onCommit={setStart} />
        </div>
        <div>
          <label className="field-label">End</label>
          <TimeField seconds={end} max={max} onCommit={setEnd} />
        </div>
        {!hasDuration && (
          <div style={{ alignSelf: 'end' }}>
            <span className="badge">duration unknown — type times</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface TimeFieldProps {
  seconds: number;
  max: number;
  onCommit: (seconds: number) => void;
}

function TimeField({ seconds, max, onCommit }: TimeFieldProps) {
  const [text, setText] = useState(() => formatTime(seconds, max >= 3600));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatTime(seconds, max >= 3600));
  }, [seconds, max]);

  const commit = () => {
    focused.current = false;
    const parsed = parseTime(text);
    onCommit(parsed);
    setText(formatTime(Math.max(0, Math.min(parsed, max)), max >= 3600));
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value.replace(/[^0-9:]/g, ''));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  return (
    <input
      className="time-input"
      value={text}
      inputMode="numeric"
      onFocus={() => (focused.current = true)}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={handleKey}
      spellCheck={false}
    />
  );
}
