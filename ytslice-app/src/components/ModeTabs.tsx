import type { Mode } from '../types';
import { IconMusic, IconVideo } from './icons';

interface ModeTabsProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Output type">
      <button
        role="tab"
        aria-selected={mode === 'video'}
        data-active={mode === 'video'}
        className="tab"
        onClick={() => onChange('video')}
      >
        <IconVideo /> Video clip
      </button>
      <button
        role="tab"
        aria-selected={mode === 'audio'}
        data-active={mode === 'audio'}
        className="tab"
        onClick={() => onChange('audio')}
      >
        <IconMusic /> MP3 audio
      </button>
    </div>
  );
}
