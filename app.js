const videoTab = document.querySelector('#video-tab');
const audioTab = document.querySelector('#audio-tab');
const videoPanel = document.querySelector('#video-panel');
const audioPanel = document.querySelector('#audio-panel');
const urlInput = document.querySelector('#video-url');
const editor = document.querySelector('#editor');
const emptyState = document.querySelector('#editor-empty');
const fieldNote = document.querySelector('#field-note');
const toast = document.querySelector('#toast');
let loadedVideoId = '';
let loadedVideoUrl = '';
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function selectMode(mode) {
  const videoMode = mode === 'video';
  videoTab.classList.toggle('active', videoMode);
  audioTab.classList.toggle('active', !videoMode);
  videoTab.setAttribute('aria-selected', videoMode);
  audioTab.setAttribute('aria-selected', !videoMode);
  videoPanel.hidden = !videoMode;
  audioPanel.hidden = videoMode;
}

videoTab.addEventListener('click', () => selectMode('video'));
audioTab.addEventListener('click', () => selectMode('audio'));

function getVideoId(value) {
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('/')[0];
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || url.pathname.split('/').pop();
  } catch (error) {
    return null;
  }
  return null;
}

function loadVideo() {
  const id = getVideoId(urlInput.value.trim());
  if (!id) {
    fieldNote.textContent = 'That link doesn’t look like a YouTube video. Try the full URL or a youtu.be link.';
    fieldNote.classList.add('error');
    urlInput.focus();
    return;
  }
  fieldNote.textContent = 'Video loaded. Set your range below.';
  fieldNote.classList.remove('error');
  document.querySelector('#video-thumbnail').src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  document.querySelector('#video-title').textContent = `YouTube video · ${id}`;
  document.querySelector('#video-source').textContent = `youtube.com/watch?v=${id}`;
  loadedVideoId = id;
  loadedVideoUrl = urlInput.value.trim();
  document.querySelector('#process-video-row').hidden = false;
  document.querySelector('#timeline-wrap').hidden = true;
  document.querySelector('#export-row').hidden = true;
  document.querySelector('#clips-list').replaceChildren();
  emptyState.hidden = true;
  editor.hidden = false;
  editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.querySelector('#load-button').addEventListener('click', loadVideo);
urlInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadVideo(); });
document.querySelector('#clear-button').addEventListener('click', () => { editor.hidden = true; emptyState.hidden = false; urlInput.value = ''; urlInput.focus(); });

function updateClipLength() {
  const start = document.querySelector('#start-time').value;
  const end = document.querySelector('#end-time').value;
  const toSeconds = (time) => time.split(':').reduce((total, value) => total * 60 + Number(value || 0), 0);
  const difference = Math.max(0, toSeconds(end) - toSeconds(start));
  document.querySelector('#clip-length').textContent = `${difference} sec clip`;
}
document.querySelectorAll('.time-fields input').forEach((input) => input.addEventListener('input', updateClipLength));

document.querySelector('#process-video').addEventListener('click', () => {
  const button = document.querySelector('#process-video');
  button.disabled = true;
  button.textContent = 'Processing video…';
  const preview = document.querySelector('#media-preview');
  preview.innerHTML = `<iframe title="YouTube video preview" src="https://www.youtube.com/embed/${loadedVideoId}?rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  document.querySelector('#process-video-row').hidden = true;
  document.querySelector('#timeline-wrap').hidden = false;
  document.querySelector('#export-row').hidden = false;
  button.disabled = false;
  button.innerHTML = 'Process video <span aria-hidden="true">→</span>';
  showToast('Video processed. Choose your range.');
  fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(loadedVideoUrl)}&format=json`)
    .then((response) => response.ok ? response.json() : null)
    .then((metadata) => { if (metadata?.title) document.querySelector('#video-title').textContent = metadata.title; })
    .catch(() => null);
});

function createClip() {
  const start = document.querySelector('#start-time').value;
  const end = document.querySelector('#end-time').value;
  const toSeconds = (time) => time.split(':').reduce((total, value) => total * 60 + Number(value || 0), 0);
  if (!/^\d{2}:\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}:\d{2}$/.test(end) || toSeconds(end) <= toSeconds(start)) {
    showToast('Choose a valid end time after the start time');
    return false;
  }
  const row = document.createElement('div');
  row.className = 'saved-clip';
  row.innerHTML = `<span>CLIP ${document.querySelectorAll('.saved-clip').length + 1}</span><strong>${start} → ${end}</strong><span>video / ${document.querySelector('#quality').value}</span><button class="clip-download" type="button">Download clip <span aria-hidden="true">↓</span></button><button class="clip-remove" type="button" aria-label="Remove clip">×</button>`;
  row.querySelector('.clip-remove').addEventListener('click', () => row.remove());
  row.querySelector('.clip-download').addEventListener('click', () => showToast('Browser-only mode cannot download YouTube media. Connect a permitted processor to export this clip.'));
  document.querySelector('#clips-list').appendChild(row);
  return true;
}

document.querySelector('#process-clip').addEventListener('click', () => {
  const button = document.querySelector('#process-clip');
  button.disabled = true;
  button.textContent = 'Processing clip…';
  setTimeout(() => {
    button.disabled = false;
    button.innerHTML = 'Process clip <span aria-hidden="true">→</span>';
    if (createClip()) showToast('Clip processed. Download it below.');
  }, 650);
});
document.querySelector('#download-audio').addEventListener('click', () => showToast('Preparing your MP3…'));
document.querySelectorAll('.audio-option').forEach((option) => option.addEventListener('click', () => { document.querySelectorAll('.audio-option').forEach((item) => item.classList.remove('selected')); option.classList.add('selected'); }));