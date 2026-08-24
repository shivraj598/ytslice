import { useVideo } from './hooks/useVideo';
import { ModeTabs } from './components/ModeTabs';
import { UrlInput } from './components/UrlInput';
import { VideoPreview } from './components/VideoPreview';
import { Timeline } from './components/Timeline';
import { ExportRow } from './components/ExportRow';
import { ClipsList } from './components/ClipsList';
import { AudioPanel } from './components/AudioPanel';
import { Toast } from './components/Toast';

function App() {
  const {
    mode,
    setMode,
    audioOption,
    setAudioOption,
    url,
    setUrl,
    videoInfo,
    clips,
    processedClips,
    selectedQuality,
    setSelectedQuality,
    startTime,
    endTime,
    loading,
    processingClip,
    downloadingClip,
    toast,
    loadVideo,
    clearVideo,
    handleTimeChange,
    getClipDuration,
    addClip,
    handleDownload,
    removeProcessedClip,
  } = useVideo();

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="ytslice home">
          <span>yt</span>slice
        </a>
        <div className="header-meta">
          <span className="status-dot"></span> free to use · no sign-up
        </div>
        <a className="header-link" href="#how-it-works">how it works <span aria-hidden="true">↗</span></a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">VIDEO TOOL / 01</p>
            <h1>Keep the<br /><em>good part.</em></h1>
            <p className="hero-intro">Cut any moment from a YouTube video. Download it clean, in the quality you found it.</p>
          </div>
          <div className="hero-mark" aria-hidden="true">
            <span className="mark-line"></span>
            <span className="mark-label">CUT / SHARE / REPEAT</span>
          </div>
        </section>

        <section className="workspace" aria-label="Video cutter">
          <ModeTabs mode={mode} onModeChange={setMode} />

          <div className="panel" id="video-panel" role="tabpanel" aria-labelledby="video-tab" hidden={mode !== 'video'}>
            <UrlInput
              url={url}
              onUrlChange={setUrl}
              onLoad={loadVideo}
              onClear={clearVideo}
              loading={loading}
              hasVideo={!!videoInfo}
            />

            {!videoInfo && (
              <div className="editor-empty" id="editor-empty">
                <div className="empty-graphic" aria-hidden="true"><span></span><span></span><span></span><b>+</b></div>
                <div><strong>Your edit starts here.</strong><p>Paste a video above to set the in and out points.</p></div>
              </div>
            )}

            {videoInfo && (
              <div className="editor" id="editor">
                <VideoPreview
                  videoInfo={videoInfo}
                  onProcess={() => {
                    // Video is already processed via API when loading
                  }}
                  processing={false}
                  showTimeline={true}
                />
                <Timeline
                  duration={videoInfo.duration}
                  startTime={startTime}
                  endTime={endTime}
                  onStartChange={(t) => handleTimeChange('start', t)}
                  onEndChange={(t) => handleTimeChange('end', t)}
                  clipDuration={getClipDuration()}
                />
                <ExportRow
                  quality={selectedQuality}
                  onQualityChange={setSelectedQuality}
                  onAddClip={addClip}
                  onProcessClip={addClip}
                  processing={!!processingClip}
                />
                <ClipsList
                  clips={clips}
                  processedClips={processedClips}
                  downloadingId={downloadingClip}
                  onDownload={handleDownload}
                  onRemove={removeProcessedClip}
                />
              </div>
            )}
          </div>

          <AudioPanel
            audioOption={audioOption}
            onAudioOptionChange={setAudioOption}
            onDownload={() => {}}
            loading={false}
            hasRange={clips.length > 0}
            id="audio-panel"
            role="tabpanel"
            aria-labelledby="audio-tab"
            hidden={mode !== 'audio'}
          />
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <p className="kicker">THREE SMALL MOVES</p>
            <h2>From long video<br />to <em>just enough.</em></h2>
          </div>
          <div className="steps">
            <div className="step">
              <span>01</span>
              <h3>Drop the link</h3>
              <p>Paste a public YouTube URL. We'll fetch the title and thumbnail.</p>
            </div>
            <div className="step">
              <span>02</span>
              <h3>Mark the moment</h3>
              <p>Set your start and end time. Add as many separate clips as you need.</p>
            </div>
            <div className="step">
              <span>03</span>
              <h3>Take it with you</h3>
              <p>Choose the source quality, then download video or MP3.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>ytslice / 2026</span>
        <span>made for the moments worth keeping</span>
        <span>deployed on Cloudflare Pages</span>
      </footer>

      <Toast message={toast} />
    </>
  );
}

export default App;