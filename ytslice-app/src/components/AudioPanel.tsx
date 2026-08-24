interface AudioPanelProps {
  audioOption: 'full' | 'range';
  onAudioOptionChange: (option: 'full' | 'range') => void;
  onDownload: () => void;
  loading: boolean;
  hasRange: boolean;
}

export function AudioPanel({ audioOption, onAudioOptionChange, onDownload, loading, hasRange }: AudioPanelProps) {
  return (
    <div className="audio-panel" role="tabpanel" aria-labelledby="audio-tab">
      <div className="audio-intro">
        <span className="audio-symbol" aria-hidden="true">♫</span>
        <div>
          <h2>Audio, isolated.</h2>
          <p>Pull the full track or cut a precise moment as an MP3.</p>
        </div>
      </div>
      <div className="audio-options">
        <button
          className={`audio-option ${audioOption === 'full' ? 'selected' : ''}`}
          type="button"
          onClick={() => onAudioOptionChange('full')}
        >
          <strong>Full video</strong>
          <span>Download the complete audio track</span>
          <b>MP3</b>
        </button>
        <button
          className={`audio-option ${audioOption === 'range' ? 'selected' : ''}`}
          type="button"
          onClick={() => onAudioOptionChange('range')}
          disabled={!hasRange}
        >
          <strong>Selected range</strong>
          <span>Use the timeline from the video tab</span>
          <b>MP3</b>
        </button>
      </div>
      <button className="download-button audio-download" type="button" onClick={onDownload} disabled={loading}>
        {loading ? 'Preparing…' : 'Download MP3 <span aria-hidden="true">↓</span>'}
      </button>
      <p className="audio-note">
        You can switch back to video anytime. Your last range stays saved.
        Browser-only mode cannot extract YouTube media files.
      </p>
    </div>
  );
}