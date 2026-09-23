// Sound effects from Kenney's CC0 packs (see public/audio/CREDITS.txt), played through Web Audio.
// Files are WAV because Safari can't decode OGG; the gains even out their loudness.
const GAIN = {
  shutter: 0.8,
  tick: 0.45,
  clear: 0.45,
  alert: 0.5,
  stamp: 0.9,
  busted: 0.7,
  cash: 1,
};
const MASTER = 0.8;
const MUTED_KEY = 'ler-muted';

let ctx = null;
const buffers = {};
const listeners = new Set();
let muted = false;
try { muted = localStorage.getItem(MUTED_KEY) === '1'; } catch { /* storage blocked: start with sound on */ }

// Browsers only start audio from a user gesture, so call this from click handlers.
export function unlockAudio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    for (const name of Object.keys(GAIN)) {
      fetch(`/audio/${name}.wav`)
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => { buffers[name] = buffer; })
        .catch(() => {}); // A sound that fails to load just stays silent.
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function play(name) {
  const buffer = buffers[name];
  if (muted || !ctx || !buffer) return;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = GAIN[name] * MASTER;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(MUTED_KEY, value ? '1' : '0'); } catch { /* the choice lasts this visit only */ }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
