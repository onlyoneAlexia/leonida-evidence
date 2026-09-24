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

// A short two-tone police wail for heat pressure, synthesized so it needs no file.
export function siren(seconds = 1.6) {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  for (let i = 0; i * 0.4 < seconds; i++) osc.frequency.setValueAtTime(i % 2 ? 620 : 830, t0 + i * 0.4);
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.05 * MASTER, t0 + 0.05);
  gain.gain.setValueAtTime(0.05 * MASTER, t0 + seconds - 0.25);
  gain.gain.linearRampToValueAtTime(0, t0 + seconds);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + seconds);
}

// --- Tape cues (scenes.js `cues`), synthesized in code like the siren. ---

let noise = null;
function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

// A gain stage that swells to `peak` and fades out over `seconds`, panned from `pan[0]` to `pan[1]`.
function voice(t0, seconds, peak, { attack = 0.05, release = 0.2, pan = [0, 0] } = {}) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak * MASTER, t0 + attack);
  gain.gain.setValueAtTime(peak * MASTER, t0 + Math.max(attack, seconds - release));
  gain.gain.linearRampToValueAtTime(0, t0 + seconds);
  let out = gain;
  if (ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan[0], t0);
    panner.pan.linearRampToValueAtTime(pan[1], t0 + seconds);
    gain.connect(panner);
    out = panner;
  }
  out.connect(ctx.destination);
  return gain;
}

function hiss(t0, seconds, into, type, frequency, q = 1) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer();
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  source.connect(filter).connect(into);
  source.start(t0);
  source.stop(t0 + seconds);
  return filter;
}

function tone(t0, seconds, into, type, frequency) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  osc.connect(into);
  osc.start(t0);
  osc.stop(t0 + seconds);
  return osc;
}

// Wobbles an oscillator's frequency or a gain by `depth` at `rate` Hz.
function wobble(t0, seconds, param, rate, depth) {
  const lfo = ctx.createOscillator();
  const amount = ctx.createGain();
  lfo.frequency.value = rate;
  amount.gain.value = depth;
  lfo.connect(amount).connect(param);
  lfo.start(t0);
  lfo.stop(t0 + seconds);
}

const CUES = {
  // A cruiser wailing past: rising and falling sweeps that drop in pitch as it goes by, left to right.
  siren(t0) {
    const out = voice(t0, 2.2, 0.06, { attack: 0.5, release: 0.8, pan: [-0.7, 0.7] });
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.connect(out);
    const osc = tone(t0, 2.2, filter, 'sawtooth', 700);
    for (let i = 0; i < 3; i++) {
      const drop = i < 2 ? 1 : 0.88;
      osc.frequency.linearRampToValueAtTime(1350 * drop, t0 + i * 0.72 + 0.36);
      osc.frequency.linearRampToValueAtTime(700 * drop, t0 + i * 0.72 + 0.72);
    }
  },
  // Tyres squealing: a narrow band of noise and a wavering whistle.
  screech(t0) {
    const out = voice(t0, 0.8, 0.09, { attack: 0.03, release: 0.35 });
    hiss(t0, 0.8, out, 'bandpass', 2900, 14);
    const whistle = tone(t0, 0.8, out, 'triangle', 2700);
    whistle.frequency.linearRampToValueAtTime(2200, t0 + 0.8);
    wobble(t0, 0.8, whistle.frequency, 28, 60);
  },
  // A truck's air horn: two blasts of a low, sour chord.
  horn(t0) {
    for (const [start, length] of [[0, 0.28], [0.36, 0.6]]) {
      const out = voice(t0 + start, length, 0.07, { attack: 0.02, release: 0.08 });
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1300;
      filter.connect(out);
      for (const f of [185, 233, 277]) tone(t0 + start, length, filter, 'sawtooth', f);
    }
  },
  // Something heavy passing close: a low roar that swells and fades.
  rumble(t0) {
    const out = voice(t0, 1.8, 0.35, { attack: 0.6, release: 0.9, pan: [-0.5, 0.5] });
    hiss(t0, 1.8, out, 'lowpass', 170, 0.7);
    tone(t0, 1.8, out, 'sine', 46);
  },
  // Helicopter blades: filtered noise chopped by a fast pulse.
  rotor(t0) {
    const out = voice(t0, 3.2, 0.3, { attack: 1, release: 1.2, pan: [0.6, 0.1] });
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    chop.connect(out);
    hiss(t0, 3.2, chop, 'lowpass', 420, 1.2);
    wobble(t0, 3.2, chop.gain, 11, 0.5);
  },
  // An alarm bell ringing on and on.
  alarm(t0) {
    const out = voice(t0, 2.4, 0.045, { attack: 0.02, release: 0.3 });
    const bell = ctx.createGain();
    bell.gain.value = 0.5;
    bell.connect(out);
    tone(t0, 2.4, bell, 'square', 1040);
    tone(t0, 2.4, bell, 'square', 1310);
    wobble(t0, 2.4, bell.gain, 17, 0.5);
  },
  // A camera flash: the capacitor's whine, then the shutter's click.
  flash(t0) {
    const whine = tone(t0, 0.32, voice(t0, 0.32, 0.012, { attack: 0.05, release: 0.05 }), 'sine', 2600);
    whine.frequency.exponentialRampToValueAtTime(5200, t0 + 0.3);
    hiss(t0 + 0.3, 0.04, voice(t0 + 0.3, 0.04, 0.3, { attack: 0.002, release: 0.03 }), 'bandpass', 3200, 0.8);
  },
  // A jet ski buzzing past, pitch rising then falling as it passes.
  jetski(t0) {
    const out = voice(t0, 2.6, 0.05, { attack: 0.8, release: 1, pan: [-0.8, 0.8] });
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(out);
    const engine = tone(t0, 2.6, filter, 'sawtooth', 92);
    engine.frequency.linearRampToValueAtTime(124, t0 + 1.3);
    engine.frequency.linearRampToValueAtTime(84, t0 + 2.6);
    wobble(t0, 2.6, engine.frequency, 7, 6);
  },
};
export const cueNames = Object.keys(CUES);

// Plays a tape's sound cue by name. Silent while muted, before audio is unlocked, or for an unknown name.
export function cue(name) {
  if (muted || !ctx || !CUES[name]) return;
  try { CUES[name](ctx.currentTime + 0.01); } catch { /* a cue that can't play just stays silent */ }
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
