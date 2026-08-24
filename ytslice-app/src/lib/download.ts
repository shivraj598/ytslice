/**
 * Save a blob to the user's computer.
 *
 * Prefers the File System Access API (`showSaveFilePicker`) so the user can
 * choose the destination folder + filename, per the product spec. Falls back
 * to a synthetic <a download> click on browsers that don't support it
 * (Firefox, Safari) or when the picker is unavailable (non-secure context).
 */

type PickerAcceptType = { description?: string; accept: Record<string, string[]> };

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: PickerAcceptType[];
}

interface FileSystemWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritable>;
}

type WindowWithPicker = Window & {
  showSaveFilePicker?: (opts?: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;
};

export function supportsFolderPicker(): boolean {
  return typeof (window as WindowWithPicker).showSaveFilePicker === 'function';
}

const ACCEPT: Record<string, PickerAcceptType> = {
  mp4: { description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } },
  webm: { description: 'WebM video', accept: { 'video/webm': ['.webm'] } },
  mp3: { description: 'MP3 audio', accept: { 'audio/mpeg': ['.mp3'] } },
  m4a: { description: 'M4A audio', accept: { 'audio/mp4': ['.m4a'] } },
};

export type SaveResult = 'saved' | 'downloaded' | 'canceled';

/**
 * @returns 'saved' when written via the folder picker, 'downloaded' when the
 * fallback download was triggered, 'canceled' when the user dismissed the picker.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4';
  const win = window as WindowWithPicker;

  if (win.showSaveFilePicker) {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: ACCEPT[ext] ? [ACCEPT[ext]] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      // AbortError => user hit cancel. Anything else => fall through to <a>.
      if (err instanceof DOMException && err.name === 'AbortError') return 'canceled';
    }
  }

  triggerAnchorDownload(blob, filename);
  return 'downloaded';
}

function triggerAnchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
