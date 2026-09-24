import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ImageEditor from '@unlayer/react-image-editor';
import './PosterStudio.css';

// The poster isn't evidence, so every tool is on, resize and frame included.
// The AI Assistant isn't entitled for this project, so it stays off here.
const STUDIO_OPTIONS = {
  theme: 'dark',
  aiAssistantOpenState: 'closed',
  features: {
    ai: false,
    imageEditor: { tools: { crop: true, resize: true, filter: true, draw: true, text: true, shapes: true, stickers: true, frame: true } },
  },
};

const FILE_NAME = 'leonida-rap-sheet.png';

const readDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// The editor saves a JPEG; the rap sheet downloads and shares a PNG, so re-encode to match the file name.
async function toPng(blob) {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(png => (png ? resolve(png) : reject(new Error('Poster could not be encoded'))), 'image/png'));
}

function download(src) {
  const link = Object.assign(document.createElement('a'), { href: src, download: FILE_NAME });
  document.body.append(link);
  link.click();
  link.remove();
}

// Shares the poster file itself where the browser can (phones, mostly) and downloads it everywhere else.
// The file is ready before the tap: share() needs the tap's user activation, and awaiting a fetch can spend it.
export function SharePoster({ src, text }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    let active = true;
    fetch(src).then(r => r.blob()).then(blob => { if (active) setFile({ src, file: new File([blob], FILE_NAME, { type: 'image/png' }) }); }).catch(() => {});
    return () => { active = false; };
  }, [src]);
  const share = async () => {
    const ready = file?.src === src ? file.file : null;
    if (ready && navigator.canShare?.({ files: [ready] })) {
      try {
        await navigator.share({ files: [ready], text });
        setNote('');
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    download(src);
    setNote("This browser can't share files, so the poster downloaded instead. Post it from your photos.");
  };
  return (
    <>
      <button type="button" className="btn" onClick={share}>Share poster</button>
      {note && <p className="share-note" role="status">{note}</p>}
    </>
  );
}

// A full-screen second editor for the rap sheet poster. The editor's Save hands back the edited PNG;
// its Cancel, Close and Escape leave the poster as it was. The page behind is inert while it's open.
export default function PosterStudio({ src, projectId, onSave, onClose }) {
  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const [image, setImage] = useState(null);
  const [mounted, setMounted] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const options = useMemo(() => ({ ...STUDIO_OPTIONS, projectId }), [projectId]);

  const fail = useCallback(() => {
    setReady(false);
    setMounted(null);
    setError("The poster studio couldn't load. Check your connection and try again. Your poster is safe.");
  }, []);

  // The editor gets a data URL, like the lab's stills, rather than the poster's blob: URL.
  useEffect(() => {
    let active = true;
    fetch(src).then(r => r.blob()).then(readDataUrl).then(url => { if (active) setImage(url); }, () => { if (active) fail(); });
    return () => { active = false; };
  }, [src, attempt, fail]);

  useEffect(() => {
    if (ready || error) return;
    const timeout = setTimeout(fail, 25000);
    return () => clearTimeout(timeout);
  }, [ready, error, attempt, fail]);

  // Unlayer's mount callback can precede image decoding, so wait until the canvas exports.
  useEffect(() => {
    if (!mounted || ready || error) return;
    const check = () => {
      try { if (mounted.getImage()) setReady(true); }
      catch { fail(); }
    };
    check();
    const poll = setInterval(check, 150);
    return () => clearInterval(poll);
  }, [mounted, ready, error, fail]);

  // Focus moves in on open and goes back to whatever opened the studio on close.
  useEffect(() => {
    const back = document.activeElement;
    const root = document.getElementById('root');
    const overflow = document.documentElement.style.overflow;
    if (root) root.inert = true;
    document.documentElement.style.overflow = 'hidden';
    titleRef.current?.focus();
    return () => {
      if (root) root.inert = false;
      document.documentElement.style.overflow = overflow;
      back?.focus?.();
    };
  }, []);

  // Closing asks first once there's something to lose.
  const requestClose = useCallback(() => {
    if (saving) return;
    if (ready && editorRef.current?.editor?.hasChanges()) setConfirm(true);
    else onClose();
  }, [saving, ready, onClose]);
  const keepEditing = useCallback(() => { setConfirm(false); titleRef.current?.focus(); }, []);

  // Escape in a text field belongs to the editor (finishing a caption), and so does one it already handled.
  useEffect(() => {
    const onKey = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      if (confirm) keepEditing();
      else requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm, requestClose, keepEditing]);

  const save = async ({ dataUrl, blob }) => {
    if (saving) return;
    setSaving(true);
    setNotice('');
    try {
      onSave(await toPng(blob ?? await (await fetch(dataUrl)).blob()));
    } catch {
      setSaving(false);
      setNotice("That save didn't take. Try Save again.");
    }
  };

  const retry = () => {
    setError('');
    setReady(false);
    setMounted(null);
    setAttempt(n => n + 1);
  };

  return createPortal(
    <div className="studio" role="dialog" aria-modal="true" aria-labelledby="studio-title" aria-describedby="studio-hint">
      <header className="studio-bar">
        <div className="studio-head">
          <p className="studio-kicker">Poster studio</p>
          <h2 id="studio-title" ref={titleRef} tabIndex={-1}>Make it yours</h2>
          <p id="studio-hint" className="studio-hint">Add a frame, stickers, a caption. This one's for the 'gram. <span>Save pins it to your rap sheet; Cancel leaves it as it was.</span></p>
        </div>
        <button type="button" className="btn studio-close" onClick={requestClose} disabled={saving} aria-label="Close poster studio">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          <span>Close</span>
        </button>
      </header>
      {confirm && <div className="studio-confirm" role="alertdialog" aria-labelledby="studio-confirm-text">
        <p id="studio-confirm-text">Close the studio and lose these edits?</p>
        <div className="studio-confirm-actions">
          <button type="button" className="btn" onClick={keepEditing} autoFocus>Keep editing</button>
          <button type="button" className="btn primary" onClick={onClose}>Discard edits</button>
        </div>
      </div>}
      {notice && <p className="studio-notice" role="alert">{notice}</p>}
      <div className="studio-stage">
        {(!ready || saving) && <div className="studio-status" role={error ? 'alert' : 'status'}>
          <p>{error || (saving ? 'Pinning it to your rap sheet…' : 'Loading the poster studio…')}</p>
          {error && <button type="button" className="btn primary" onClick={retry}>Retry studio</button>}
        </div>}
        {image && !error && <ImageEditor
          key={attempt}
          ref={editorRef}
          image={image}
          options={options}
          minHeight={0}
          onLoad={setMounted}
          onSave={save}
          onCancel={() => { if (!saving) onClose(); }}
          onError={fail}
          onLoadError={fail}
        />}
      </div>
    </div>,
    document.body,
  );
}
