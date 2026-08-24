interface ExportRowProps {
  quality: string;
  onQualityChange: (quality: string) => void;
  onAddClip: () => void;
  onProcessClip: () => void;
  processing: boolean;
}

export function ExportRow({ quality, onQualityChange, onAddClip, onProcessClip, processing }: ExportRowProps) {
  return (
    <div className="export-row">
      <label className="quality-label" htmlFor="quality">
        Quality
        <select id="quality" value={quality} onChange={(e) => onQualityChange(e.target.value)}>
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
          <option value="480p">480p</option>
          <option value="source">Same as source</option>
        </select>
      </label>
      <button className="add-clip" type="button" onClick={onAddClip}>
        <span aria-hidden="true">+</span> Add another clip
      </button>
      <button className="process-button" type="button" onClick={onProcessClip} disabled={processing}>
        {processing ? 'Processing clip…' : 'Process clip <span aria-hidden="true">→</span>'}
      </button>
    </div>
  );
}