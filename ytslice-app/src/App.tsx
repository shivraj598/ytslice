import { useToast } from './hooks/useToast';
import { useVideo } from './hooks/useVideo';
import { ModeTabs } from './components/ModeTabs';
import { UrlInput } from './components/UrlInput';
import { VideoPreview } from './components/VideoPreview';
import { RangeTimeline } from './components/RangeTimeline';
import { ClipsList } from './components/ClipsList';
import { AudioPanel } from './components/AudioPanel';
import { Toaster } from './components/Toaster';
import { IconFolder, IconScissors } from './components/icons';
import { supportsFolderPicker } from './lib/download';

function App() {
  const { toasts, notify, dismiss } = useToast();
  const v = useVideo(notify);

  const canSlice = v.end - v.start >= 1;
  const folderPicker = supportsFolderPicker();

  return (
    <div className="app">
      <header className="site-header">
        <div className="container">
          <a className="brand" href="#top" aria-label="ytslice home">
            <span className="brand-mark">
              <IconScissors />
            </span>
            yt<em>slice</em>
          </a>
          <div className="header-meta">
            <span className="status-dot" /> runs in your browser
          </div>
        </div>
      </header>

      <main id="top">
        <div className="container">
          <section className="hero">
            <span className="kicker">YouTube clipper</span>
            <h1>
              Keep the <em>good part.</em>
            </h1>
            <p>
              Paste a link, drag the handles, and pull just the moment you want — as video or MP3.
              Everything is cut right here in your browser.
            </p>
          </section>

          <section className="workspace" aria-label="Clip workspace">
            <div className="card card-pad">
              <ModeTabs mode={v.mode} onChange={v.setMode} />

              <div className="stack">
                <UrlInput
                  value={v.url}
                  onChange={v.setUrl}
                  onLoad={v.loadVideo}
                  onDemo={v.loadDemo}
                  loading={v.loading}
                  hasVideo={v.hasVideo}
                />

                {!v.info ? (
                  <div className="empty">
                    <div className="empty-icon">
                      <IconScissors />
                    </div>
                    <h3>Your edit starts with a link</h3>
                    <p>
                      Drop a public YouTube URL above to load the video, then set your in and out
                      points.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="divider" />
                    <VideoPreview info={v.info} onClear={v.reset} />

                    <RangeTimeline
                      duration={v.info.duration}
                      start={v.start}
                      end={v.end}
                      onChange={v.setRange}
                    />

                    {v.mode === 'video' ? (
                      <>
                        <div className="action-row">
                          <span className="muted" style={{ fontSize: '0.84rem' }}>
                            Slice this range, then download at any quality — plain click uses{' '}
                            <strong style={{ color: 'var(--foreground)' }}>{v.defaultQuality}</strong>.
                          </span>
                          <span className="spacer" />
                          <button
                            className="btn btn-primary"
                            onClick={v.addClip}
                            disabled={!canSlice}
                          >
                            <IconScissors /> Slice this range
                          </button>
                        </div>

                        <ClipsList
                          clips={v.clips}
                          qualityOptions={v.videoQualityOptions}
                          defaultQuality={v.defaultQuality}
                          busy={v.busy}
                          onDownload={v.downloadClip}
                          onRemove={v.removeClip}
                        />
                      </>
                    ) : (
                      <AudioPanel
                        scope={v.audioScope}
                        onScopeChange={v.setAudioScope}
                        start={v.start}
                        end={v.end}
                        duration={v.info.duration}
                        busy={v.busy}
                        job={v.audioJob}
                        onDownload={v.downloadAudio}
                      />
                    )}

                    <div className="muted" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconFolder />
                      {folderPicker
                        ? 'Your browser lets you choose the destination folder on download.'
                        : 'Files download to your browser’s downloads folder.'}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="how" id="how-it-works">
            <h2>
              Three moves to <em>just enough.</em>
            </h2>
            <div className="steps">
              <div className="step">
                <span className="num">01 / LINK</span>
                <h3>Drop the link</h3>
                <p>Paste any public YouTube URL. We pull the video and its available qualities.</p>
              </div>
              <div className="step">
                <span className="num">02 / MARK</span>
                <h3>Mark the moment</h3>
                <p>Drag the handles or type exact timecodes. Queue as many separate cuts as you want.</p>
              </div>
              <div className="step">
                <span className="num">03 / KEEP</span>
                <h3>Take it with you</h3>
                <p>Download the clip as video or MP3 — up to the highest quality YouTube offers.</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <span>ytslice · 2026</span>
          <span>cut in-browser · no uploads</span>
          <span>deployed on Cloudflare Pages</span>
        </div>
      </footer>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default App;
