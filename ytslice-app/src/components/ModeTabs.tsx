import { useState } from 'react';

interface ModeTabsProps {
  mode: 'video' | 'audio';
  onModeChange: (mode: 'video' | 'audio') => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="mode-tabs" role="tablist" aria-label="Download format">
      <button
        className={`mode-tab ${mode === 'video' ? 'active' : ''}`}
        role="tab"
        aria-selected={mode === 'video'}
        aria-controls="video-panel"
        onClick={() => onModeChange('video')}
      >
        Video <span>.mp4</span>
      </button>
      <button
        className={`mode-tab ${mode === 'audio' ? 'active' : ''}`}
        role="tab"
        aria-selected={mode === 'audio'}
        aria-controls="audio-panel"
        onClick={() => onModeChange('audio')}
      >
        Audio <span>.mp3</span>
      </button>
    </div>
  );
}