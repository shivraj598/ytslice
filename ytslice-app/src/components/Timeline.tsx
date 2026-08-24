import { useRef, useEffect, useState } from 'react';

interface TimelineProps {
  duration: number;
  startTime: string;
  endTime: string;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  clipDuration: number;
}

export function Timeline({ duration, startTime, endTime, onStartChange, onEndChange, clipDuration }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const leftHandleRef = useRef<HTMLSpanElement>(null);
  const rightHandleRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackRef.current) {
      setTrackWidth(trackRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    const startPercent = (parseTime(startTime) / duration) * 100;
    const endPercent = (parseTime(endTime) / duration) * 100;
    if (selectionRef.current) {
      selectionRef.current.style.left = `${startPercent}%`;
      selectionRef.current.style.width = `${endPercent - startPercent}%`;
    }
  }, [startTime, endTime, duration]);

  const handleMouseDown = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(side);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const time = Math.round((percent / 100) * duration);
      const formatted = formatTime(time);
      if (dragging === 'left') onStartChange(formatted);
      else onEndChange(formatted);
    };

    const handleUp = () => setDragging(null);

    if (dragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, duration, onStartChange, onEndChange]);

  return (
    <div className="timeline-wrap">
      <div className="timeline-head">
        <span>SELECT A RANGE</span>
        <span>{formatTime(0)} — {formatTime(duration)}</span>
      </div>
      <div className="filmstrip" aria-hidden="true">
        {[...Array(12)].map((_, i) => <i key={i} />)}
      </div>
      <div className="range-track" ref={trackRef} onClick={(e) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const time = Math.round((percent / 100) * duration);
        const formatted = formatTime(time);
        if (Math.abs(parseTime(startTime) - time) < Math.abs(parseTime(endTime) - time)) {
          onStartChange(formatted);
        } else {
          onEndChange(formatted);
        }
      }}>
        <div className="range-selection" ref={selectionRef}>
          <span className="handle left" ref={leftHandleRef} onMouseDown={(e) => handleMouseDown('left', e)} />
          <span className="handle right" ref={rightHandleRef} onMouseDown={(e) => handleMouseDown('right', e)} />
        </div>
      </div>
      <div className="time-fields">
        <label>Start <input type="text" value={startTime} maxLength={8} onChange={(e) => onStartChange(e.target.value)} /></label>
        <span className="time-arrow">→</span>
        <label>End <input type="text" value={endTime} maxLength={8} onChange={(e) => onEndChange(e.target.value)} /></label>
        <span className="clip-length">{clipDuration} sec clip</span>
      </div>
      <p className="range-note">Use HH:MM:SS. Clips must be shorter than the source video.</p>
    </div>
  );
}

function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}