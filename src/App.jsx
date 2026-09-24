import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import { CASES, W, H, drawLive, ensureFonts, renderCase } from './scenes.js';
import { analyse } from './forensics.js';
import { buildRapSheet, rankFor } from './rapsheet.js';
import { isMuted, play, setMuted, siren, subscribe, unlockAudio } from './sound.js';
// Scene sound cues are optional, so they're looked up on the module rather than imported by name.
import * as sound from './sound.js';
import { boardRows, postRun, useLeaderboard } from './leaderboard.js';
import Home from './Home.jsx';
import LeaderboardTable from './LeaderboardTable.jsx';
import './App.css';

const MAX_STARS = 5;

// Resize and frame change the output size/framing; everything else is fair game.
// The Unlayer project id unlocks the AI Assistant ("the AI fixer").
const EDITOR_OPTIONS = {
  theme: 'dark',
  projectId: 289605,
  aiAssistantOpenState: 'open',
  features: {
    ai: { enabled: true, assistant: true },
    imageEditor: { tools: { resize: false, frame: false } },
  },
};

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Filter and crop changes only reach the exported image once their panel closes,
// so close any open tool panel (even one hidden by "Hide tool settings") first.
async function commitToolPanel(wrap) {
  const close = wrap?.querySelector('[data-testid="native-tool-options-close"]');
  if (!close) return;
  close.click();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// Rolls a cash figure up from a previous value, slot-machine style.
function CountUp({ from = 0, to, delay = 0 }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf;
    const start = performance.now() + delay;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1100));
      setV(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay]);
  return money(v);
}

// Stars earned since `prev` pop in one after another, starting `delay` seconds in.
function Stars({ count, prev = count, delay = 1.9 }) {
  return (
    <span className="stars" aria-label={`${count} of ${MAX_STARS} wanted stars`}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span
          key={i}
          className={`${i < count ? 'on' : ''} ${i >= prev && i < count ? 'new' : ''}`}
          style={{ animationDelay: `${delay + (i - prev) * 0.25}s` }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function SoundToggle() {
  const muted = useSyncExternalStore(subscribe, isMuted);
  return (
    <button type="button" className="btn sound-toggle" aria-label="Sound" aria-pressed={!muted} title={muted ? 'Sound is off' : 'Sound is on'} onClick={() => { unlockAudio(); setMuted(!muted); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" />}
      </svg>
      <span className="sound-label">Sound</span>
    </button>
  );
}

// Home is one tap away on every screen. Mid-run it asks first, and once a job is finished it also offers
// that job's rap sheet (walking away). `over` means the run has ended anyway: busted or all five jobs done.
function HomeButton({ onHome, confirm, finished = 0, over, onRapSheet }) {
  const dialog = useRef(null);
  return (
    <>
      <button type="button" className="btn home-toggle" onClick={() => (confirm ? dialog.current.showModal() : onHome())}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5 12 4.5l8.5 7M6.5 9.5V19.5h4v-5h3v5h4V9.5" /></svg>
        <span>Home</span>
      </button>
      {confirm && <dialog ref={dialog} className="home-dialog" aria-labelledby="home-title">
        <h3 id="home-title">Head home?</h3>
        <p>{!finished ? "Nothing's finished yet, so there's no rap sheet to keep. Going home ends this run."
          : over ? 'This run is over. Pick up your rap sheet, or head home without it.'
            : `You've finished ${finished} job${finished === 1 ? '' : 's'}. Take the rap sheet, or head home and start over. Runs you walk away from don't make the leaderboard.`}</p>
        <form method="dialog" className="actions">
          <button className="btn" autoFocus>Keep playing</button>
          {finished > 0 && <button className="btn" onClick={onRapSheet}>See my rap sheet</button>}
          <button className="btn primary" onClick={onHome}>Go to the homepage</button>
        </form>
      </dialog>}
    </>
  );
}

// VCPD radio chatter under the tape and the lab: this job's calls, led by heat lines that get more urgent with every star.
const RADIO = {
  kwik: ['211 reported at Kwik Mart #117, Ocean Drive', 'Clerk says one male suspect walked out calm as you like', 'Pump camera 04 footage requested for the morning file', 'Getaway car last seen heading north on Ocean'],
  causeway: ['Toll plaza 5A: vehicle stopped on the eastbound shoulder', 'Female passenger out of the car, watching the sunset', 'Box truck in lane two, traffic backing up to the bridge', 'Plate check requested from the toll camera'],
  bank: ['Silent alarm, Bank of Leonida, Downtown Vice City', 'Lobby cam 11 still recording', 'Teller reports an L+J tattoo on the female suspect', 'Detectives already like Rico for this one'],
  marina: ['Harbor patrol drone 2 is up over the Keys', 'Duffel bag left on the dock at slip 14', "Rico's yacht inbound, eyes on the boat name", 'Jet ski in the no-wake zone, again'],
  jewelry: ['459 at the Diamond Mile, alarm still ringing', 'Two suspects on foot, running for a car', 'Tourist on the sidewalk filming everything', 'Bus route 22 blocking the street cam'],
};
const HEAT_RADIO = [
  ['No suspects identified. Forensics queue is normal'],
  ['BOLO out on a man and a woman from the last scene', 'Units running code 3 through the district'],
  ['Air unit up, spotlight sweeping the grid', 'Detectives pulling every camera in Leonida'],
  ['PRIORITY: partial facial match on file', 'Roadblocks going up on the causeway'],
  ['ALL UNITS: one more tape and it is a warrant', 'SWAT staging two blocks out'],
];

function Dispatch({ c, stars, alert, hot }) {
  const level = Math.min(stars, HEAT_RADIO.length - 1);
  const lines = [
    ...(alert ? [{ text: alert, hot: true }] : []),
    ...HEAT_RADIO[level].map(text => ({ text, hot: stars > 0 })),
    ...(RADIO[c.id] ?? []).map(text => ({ text })),
  ];
  const [n, setN] = useState(0);
  const [still] = useState(calm);
  // With reduced motion the chatter changes line by line instead of scrolling.
  useEffect(() => {
    if (!still) return;
    const id = setInterval(() => setN(k => k + 1), 5000);
    return () => clearInterval(id);
  }, [still]);
  const urgent = hot || stars >= 3;
  const line = ({ text, hot: flagged }, i) => <span key={i} className={flagged ? 'hot' : undefined}>{text}</span>;
  const chars = lines.reduce((sum, l) => sum + l.text.length, 0);
  return (
    <div className={`dispatch ${urgent ? 'urgent' : ''}`} role="marquee" aria-label="VCPD dispatch radio">
      <b className="dispatch-tag"><i aria-hidden="true" />{urgent ? 'VCPD PRIORITY' : 'VCPD RADIO'}</b>
      <div className="dispatch-window">
        {still ? <p className="dispatch-line">{line(lines[n % lines.length], 0)}</p>
          // Restart from the top when a new alert lands, so it scrolls in first.
          : <p key={lines.length} className="dispatch-track" style={{ '--ticker': `${Math.round(chars * (stars >= 3 ? 0.1 : 0.14))}s` }}>
            <span>{lines.map(line)}</span><span aria-hidden="true">{lines.map(line)}</span>
          </p>}
      </div>
    </div>
  );
}

// What forensics reports on each evidence box: hidden evidence comes back CLEAN, visible evidence a MATCH.
const forensicLabel = (r) => (r.kind === 'hide' ? (r.pass ? 'CLEAN' : 'MATCH') : r.pass ? 'INTACT' : 'TAMPERED');

const clock = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// Heat pressure: every wanted star makes the next tape harder.
const heatEffects = stars => [
  stars >= 1 && 'Sirens',
  stars >= 2 && 'Camera shake',
  stars >= 3 && 'Stickers jammed',
  stars >= 4 && 'Shapes jammed',
].filter(Boolean);

function HeatChips({ stars }) {
  const effects = heatEffects(stars);
  if (!effects.length) return null;
  return <p className="heat-chips" aria-label={`Heat effects: ${effects.join(', ')}`}>{effects.map(e => <span key={e}>{e}</span>)}</p>;
}

const liveStatus = t => (t.inShot ? 'in shot' : t.kind === 'keep' && t.mustShow ? 'not in shot' : 'out of sight');

// The tape plays live and FREEZE picks the frame to doctor. The job clock runs from the moment the tape rolls,
// so waiting for a better frame costs editing time.
function Feed({ index, c, stars, cash, onFreeze, home }) {
  const canvas = useRef(null);
  const photo = useRef(null);
  const flash = useRef(null);
  const tRef = useRef(0);
  const frozen = useRef(false);
  const leave = useRef(0);
  const [done, setDone] = useState(false);
  const [rolling, setRolling] = useState(false);
  // The VCR's on-screen display: a noisy spin-up on PLAY, a flash and a held frame on PAUSE.
  const [osd, setOsd] = useState('');
  const [live, setLive] = useState({ t: 0, all: [] });

  useEffect(() => {
    setLive({ t: 0, all: drawLive(canvas.current.getContext('2d'), c, 0).all });
  }, [c]);
  useEffect(() => () => clearTimeout(leave.current), []);

  const freeze = useCallback(() => {
    if (frozen.current) return;
    frozen.current = true;
    const t = tRef.current;
    setDone(true);
    setRolling(false);
    setOsd('pause');
    play('shutter');
    // Hold the paused frame for a beat before cutting to the lab; the job clock already stopped at `t`.
    leave.current = setTimeout(() => onFreeze(t), calm() ? 250 : 650);
  }, [onFreeze]);

  useEffect(() => {
    if (!rolling) return;
    const g = canvas.current.getContext('2d');
    const box = photo.current;
    const glare = flash.current;
    const start = performance.now();
    const still = calm();
    const fired = new Set();
    let raf;
    let frames = 0;
    const loop = now => {
      // A frame's timestamp can predate `start` slightly, so never let the tape run backwards.
      const t = Math.max(0, Math.min(c.clip, (now - start) / 1000));
      tRef.current = t;
      const f = drawLive(g, c, t);
      // Scenes may add camera shake and flashes (fx) and sound cues; tapes without them just play.
      const shake = still ? 0 : Math.min(1, f.fx?.shake ?? 0);
      box.style.transform = shake > 0.01 ? `translate(${(Math.sin(t * 53) * shake * 7).toFixed(1)}px, ${(Math.cos(t * 41) * shake * 5).toFixed(1)}px) rotate(${(Math.sin(t * 31) * shake * 0.7).toFixed(2)}deg)` : '';
      glare.style.opacity = still ? 0 : Math.min(1, f.fx?.flash ?? 0);
      c.cues?.forEach((q, i) => { if (!fired.has(i) && t >= q.at) { fired.add(i); sound.cue?.(q.name); } });
      // Boxes follow the crew at 30 fps; the picture itself runs at the display rate.
      if (frames++ % 2 === 0 || t >= c.clip) setLive({ t, all: f.all });
      if (t >= c.clip) freeze();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = event => { if (event.code === 'Space' && !event.target.closest('input, textarea, dialog')) { event.preventDefault(); freeze(); } };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      box.style.transform = '';
      glare.style.opacity = 0;
    };
  }, [rolling, c, freeze]);

  const roll = () => { unlockAudio(); play('tick'); setRolling(true); setOsd('play'); };
  const shown = live.all.filter(t => t.inShot && t.rect);
  return (
    <div className={`screen briefing ${stars >= 1 ? 'heat-sirens' : ''}`}>
      <div className="brief-card">
        <div className="brief-head">
          {home}
          <span className="case-no">CASE {index + 1} / {CASES.length}</span>
          <Stars count={stars} />
          <span className="cash">{money(cash)}</span>
          <SoundToggle />
        </div>
        <h2>{c.title}</h2>
        <p className="place">{c.place}</p>
        <div className="brief-body">
          <div className="feed-col">
            <div ref={photo} className={`evidence-photo feed ${rolling ? 'rolling' : ''} ${osd ? `vhs-${osd}` : ''}`}>
              <canvas ref={canvas} width={W} height={H} data-t={live.t.toFixed(2)} aria-label={`Live CCTV tape: ${c.title}`} role="img" />
              <TargetBoxes targets={shown} />
              <i ref={flash} className="fx-flash" aria-hidden="true" />
              {osd && <div key={osd} className="vhs" aria-hidden="true"><i className="vhs-noise" /><i className="vhs-band" /><span className="vhs-osd">{osd === 'play' ? 'PLAY ▶' : 'PAUSE ▮▮'}</span></div>}
              {!rolling && !done && <button type="button" className="roll-tape" onClick={roll}><span aria-hidden="true">▶</span> Roll tape</button>}
              {rolling && <div className="tape-bar" aria-hidden="true"><i style={{ width: `${(live.t / c.clip) * 100}%` }} /></div>}
            </div>
            <Dispatch c={c} stars={stars} />
          </div>
          <div className="brief-side">
            <p className="brief-text">{c.brief}</p>
            <p className="tape-tip"><b>Timing:</b> {c.tip} Evidence that's out of sight when you freeze needs no edit.</p>
            <ul className="objectives live">
              {live.all.map(t => (
                <li key={t.key} className={`${t.kind} ${t.inShot ? '' : 'away'}`}>
                  <b>{t.kind === 'hide' ? 'HIDE' : 'KEEP'}</b><span>{t.label}</span><em>{liveStatus(t)}</em>
                </li>
              ))}
            </ul>
            <HeatChips stars={stars} />
            <p className="clock">⏱ {clock(c.seconds - Math.floor(live.t))} on the clock · payout up to {money(c.payout)}</p>
            {rolling ? <button className="btn primary freeze" onClick={freeze}>Freeze frame <kbd>Space</kbd></button>
              : <button className="btn primary" onClick={roll} disabled={done}>{done ? 'Frame frozen' : 'Roll tape'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TargetBoxes({ targets, results }) {
  return (
    <div className="boxes">
      {(results ?? targets).filter((t) => t.rect).map((t) => (
        <div
          key={t.key}
          className={`box ${t.kind} ${results ? (t.pass ? 'pass' : 'fail') : ''}`}
          style={{
            left: `${(t.rect.x / W) * 100}%`,
            top: `${(t.rect.y / H) * 100}%`,
            width: `${(t.rect.w / W) * 100}%`,
            height: `${(t.rect.h / H) * 100}%`,
          }}
        >
          <span>{results ? forensicLabel(t) : t.kind === 'hide' ? 'HIDE' : 'KEEP'}</span>
        </div>
      ))}
    </div>
  );
}

function ObjectiveList({ targets, results, gone = [], missing = [], fresh }) {
  const list = results ?? [...targets, ...missing.map((t) => ({ ...t, missing: true }))];
  return (
    <ul className="objectives">
      {list.map((t) => (
        <li key={t.key} className={`${t.kind} ${results ? (t.pass ? 'pass' : 'fail') : ''} ${t.key === fresh ? 'fresh' : ''} ${t.missing && !results ? 'missing' : ''}`}>
          <b>{t.kind === 'hide' ? 'HIDE' : 'KEEP'}</b>
          <span>{t.label}</span>
          {results ? (
            <em>
              {t.missing ? 'not in the shot'
                : t.kind === 'hide'
                  ? t.pass ? `scrubbed ${Math.round(t.changed * 100)}%` : `visible (${Math.round(t.changed * 100)}% hidden)`
                  : t.pass ? 'intact' : `tampered ${Math.round(t.changed * 100)}%`}
            </em>
          ) : t.missing && <em>not in the shot. Forensics will notice.</em>}
        </li>
      ))}
      {!results && gone.map((t) => (
        <li key={t.key} className={`${t.kind} gone`}>
          <b>{t.kind === 'hide' ? 'HIDE' : 'KEEP'}</b>
          <span>{t.label}</span>
          <em>out of sight: no edit needed</em>
        </li>
      ))}
    </ul>
  );
}

// Detectives spot something new this far into the edit, and add a little time to deal with it.
const SURPRISE_AFTER = 6000;
// No more than the lab has used by then, so the bonus never lifts the clock past this tape's budget.
const SURPRISE_BONUS = 5;
const SHAKE_EVERY = 13000;

function Lab({ index, c, still, budget, stars, cash, onSubmit, home }) {
  const editorRef = useRef(null);
  const [left, setLeft] = useState(budget);
  const [revealed, setRevealed] = useState(false);
  const [shaking, setShaking] = useState(false);
  // The frozen frame tears apart as the lab cuts in.
  const [cut, setCut] = useState(() => !calm());
  const options = useMemo(() => ({
    ...EDITOR_OPTIONS,
    features: { ...EDITOR_OPTIONS.features, imageEditor: { tools: { ...EDITOR_OPTIONS.features.imageEditor.tools, ...(stars >= 3 && { stickers: false }), ...(stars >= 4 && { shapes: false }) } } },
  }), [stars]);
  const targets = useMemo(() => (revealed ? [...still.targets, still.surprise] : still.targets), [revealed, still]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [editorAttempt, setEditorAttempt] = useState(0);
  const [mountedEditor, setMountedEditor] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(() => window.innerWidth > 900);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const [hasToolSettings, setHasToolSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const labRef = useRef(null);
  const wrapRef = useRef(null);
  const done = useRef(false);
  const remaining = useRef(budget);
  const deadline = useRef(0);
  const readyAt = useRef(0);
  const revealedRef = useRef(false);

  const failEditor = useCallback(() => {
    setReady(false);
    setMountedEditor(null);
    setError('The image editor could not load. Check your connection and try again. Your timer is paused.');
  }, []);

  useEffect(() => {
    if (ready || error) return;
    const timeout = setTimeout(failEditor, 25000);
    return () => clearTimeout(timeout);
  }, [ready, error, editorAttempt, failEditor]);

  // Unlayer's mount callback can precede image decoding and canvas creation.
  useEffect(() => {
    if (!mountedEditor || ready || error) return;
    const check = () => {
      try { if (mountedEditor.getImage()) setReady(true); }
      catch { failEditor(); }
    };
    check();
    const poll = setInterval(check, 150);
    return () => clearInterval(poll);
  }, [mountedEditor, ready, error, failEditor]);

  const retryEditor = () => {
    done.current = false;
    setError('');
    setReady(false);
    setMountedEditor(null);
    setEditorAttempt(n => n + 1);
  };

  // The SDK has no panel-collapse API. Scope this adapter to its named DOM hooks;
  // hiding the options element preserves the selected tool, brush, and edits.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const sync = () => {
      setHasToolSettings(!!wrap.querySelector('[data-testid="native-tool-options"]'));
      // Send to evidence is the only hand-in: the editor's own Save would submit early
      // and its Cancel would silently wipe the tape. They have no test ids, so match the label.
      for (const button of wrap.querySelectorAll('button:not([data-testid])')) {
        if (/^(Save|Cancel)$/.test(button.textContent.trim())) button.style.display = 'none';
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(wrap, { childList: true, subtree: true });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const lab = labRef.current;
    const onFullscreenChange = () => setExpanded(document.fullscreenElement === lab);
    const onKeyDown = event => {
      if (event.key === 'Escape' && !document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown);
      if (document.fullscreenElement === lab) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleExpanded = async () => {
    if (expanded) {
      setExpanded(false);
      if (document.fullscreenElement === labRef.current) await document.exitFullscreen().catch(() => {});
    } else {
      setExpanded(true);
      setToolsCollapsed(true);
      // Browser fullscreen is optional; the expanded workspace also works without it.
      await labRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const submit = useCallback(
    async (dataUrl, reason) => {
      if (done.current) return;
      done.current = true;
      try {
        if (!dataUrl) await commitToolPanel(wrapRef.current);
        const img = dataUrl ?? editorRef.current?.editor?.getImage();
        if (!img) throw new Error('No image available');
        play('shutter');
        onSubmit(img, left, reason, targets);
      } catch {
        done.current = false;
        setReady(false);
        setError('Your edit could not be exported. Retry the editor to reload this tape. Your timer is paused.');
      }
    },
    [left, onSubmit, targets],
  );

  useEffect(() => {
    if (!ready) return;
    deadline.current = Date.now() + remaining.current * 1000;
    readyAt.current ||= Date.now();
    if (stars >= 1) siren();
    const tick = () => {
      // The surprise lands a few seconds into the edit, with bonus time that never exceeds this tape's budget.
      if (still.surprise && !revealedRef.current && Date.now() - readyAt.current >= SURPRISE_AFTER) {
        revealedRef.current = true;
        setRevealed(true);
        play('alert');
        deadline.current = Math.min(Date.now() + budget * 1000, deadline.current + SURPRISE_BONUS * 1000);
      }
      remaining.current = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(remaining.current);
    };
    const t = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [ready, stars, still.surprise, budget]);

  // Two or more stars: the camera jolts every few seconds.
  useEffect(() => {
    if (!ready || stars < 2) return;
    let off;
    const jolt = setInterval(() => { setShaking(true); off = setTimeout(() => setShaking(false), 450); }, SHAKE_EVERY);
    return () => { clearInterval(jolt); clearTimeout(off); };
  }, [ready, stars]);

  useEffect(() => {
    if (ready && left === 0) submit(null, 'timeout');
  }, [left, ready, submit]);

  // One tick a second through the final countdown.
  useEffect(() => {
    if (ready && left > 0 && left <= 10) play('tick');
  }, [left, ready]);

  const hurry = left <= 10;
  return (
    <div ref={labRef} className={`screen lab ${hurry ? 'hurry' : ''} ${expanded ? 'workspace-expanded' : ''} ${stars >= 1 ? 'heat-sirens' : ''} ${shaking ? 'shake' : ''}`}>
      <div className="hud">
        <div className="hud-left">
          {home}
          <span className="case-no">CASE {index + 1}</span>
          <strong>{c.title}</strong>
          <Stars count={stars} />
          <span className="cash">{money(cash)}</span>
        </div>
        <div className={`timer ${hurry ? 'hurry' : ''}`}>
          {ready ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '…'}
        </div>
        <button className="btn primary" onClick={() => submit(null, 'submit')} disabled={!ready}>
          Send to evidence →
        </button>
      </div>
      <Dispatch c={c} stars={stars} hot={ready && hurry} alert={revealed ? `DETECTIVES: enhance that. ${still.surprise.label} in the shot` : ''} />
      {revealed && <div className="enhance" role="alert"><b>ENHANCE</b> Detectives spotted something new: {still.surprise.label}. Hide it too. <em>+{SURPRISE_BONUS}s</em></div>}
      <div className="workspace-controls" role="group" aria-label="Editing workspace">
        <button className="btn" aria-controls="lab-orders" aria-expanded={ordersOpen && !expanded} disabled={expanded} onClick={() => setOrdersOpen(open => !open)}>{ordersOpen && !expanded ? 'Hide orders' : 'Show orders'}</button>
        <button className="btn" disabled={!ready || !hasToolSettings} aria-expanded={hasToolSettings && !toolsCollapsed} onClick={() => setToolsCollapsed(collapsed => !collapsed)}>{toolsCollapsed ? 'Show tool settings' : 'Hide tool settings'}</button>
        <button className="btn" aria-pressed={expanded} onClick={toggleExpanded}>{expanded ? 'Exit full screen' : 'Full screen'}</button>
        <SoundToggle />
        <span>Set your brush, hide its settings, then paint. Use + to zoom in.</span>
      </div>
      <div className={`lab-body ${!ordersOpen || expanded ? 'orders-hidden' : ''}`}>
        <aside id="lab-orders" className="lab-side" hidden={!ordersOpen || expanded}>
          <h3>Orders</h3>
          <ObjectiveList targets={targets} gone={still.gone} missing={still.missing} fresh={revealed ? still.surprise.key : null} />
          <HeatChips stars={stars} />
          <div className="mini">
            <img src={still.dataUrl} alt="" />
            <TargetBoxes targets={targets} />
          </div>
          <h3>Fixer tips</h3>
          <ul className="tips">
            <li><b>Draw</b> or <b>Shapes</b>: paint over a face or plate.</li>
            <li><b>Stickers</b>: slap something on it. Covered is covered.</li>
            <li><b>Crop</b>: cut evidence out, but the timestamp must survive.</li>
            <li><b>Filter → blur</b> hits the whole frame. Forensics will notice.</li>
          </ul>
        </aside>
        <div className={`editor-wrap ${toolsCollapsed ? 'tools-collapsed' : ''}`} ref={wrapRef} onClickCapture={event => {
          // Clicking a tool reopens its settings without recreating the editor.
          if (event.target.closest('[data-testid="native-tool-nav"] button')) setToolsCollapsed(false);
        }}>
          {!ready && <div className="editor-status" role={error ? 'alert' : 'status'}>
            <p>{error || 'Loading your photo lab. The clock starts when the editor is ready.'}</p>
            {error && <button className="btn primary" onClick={retryEditor}>Retry editor (resets tape)</button>}
          </div>}
          {!error && <ImageEditor
            key={editorAttempt}
            ref={editorRef}
            image={still.dataUrl}
            options={options}
            minHeight={0}
            onLoad={setMountedEditor}
            onSave={({ dataUrl }) => submit(dataUrl, 'save')}
            onCancel={async () => {
              const editor = editorRef.current?.editor;
              setReady(false);
              setMountedEditor(null);
              try { await editor?.reset(still.dataUrl); setMountedEditor(editor); }
              catch { failEditor(); }
            }}
            onError={failEditor}
            onLoadError={failEditor}
          />}
        </div>
      </div>
      {cut && <div className="lab-cut" aria-hidden="true" style={{ backgroundImage: `url(${still.dataUrl})` }} onAnimationEnd={event => { if (event.target === event.currentTarget) setCut(false); }} />}
    </div>
  );
}

// Forensics checks the evidence boxes one at a time before the verdict lands.
const SCAN_LEAD = 400;
const SCAN_STEP = 420;

function Verdict({ index, entry, stars, cash, onNext, home }) {
  const { analysis } = entry;
  const { results } = analysis;
  const [checked, setChecked] = useState(0);
  const [compare, setCompare] = useState(50);
  const scanning = checked <= results.length;
  const scanMs = SCAN_LEAD + results.length * SCAN_STEP;
  const allHidden = results.filter((r) => r.kind === 'hide').every((r) => r.pass);
  const clean = results.every((r) => r.pass);
  const busted = stars >= MAX_STARS;
  // A bust is stamped across the photo, so the headline can still say what forensics found.
  const headline = clean ? 'CASE DISMISSED' : allHidden ? 'TAMPERING SUSPECTED' : 'EVIDENCE LEAKED';

  useEffect(() => {
    if (!scanning) return;
    const t = setTimeout(() => setChecked((n) => n + 1), checked ? SCAN_STEP : SCAN_LEAD);
    return () => clearTimeout(t);
  }, [checked, scanning]);

  useEffect(() => {
    if (checked >= 1 && checked <= results.length) play(results[checked - 1].pass ? 'clear' : 'alert');
    if (checked !== results.length + 1) return;
    play(busted ? 'busted' : 'stamp');
    if (entry.total <= 0) return;
    const t = setTimeout(() => play('cash'), 200);
    return () => clearTimeout(t);
  }, [checked, results, busted, entry.total]);

  return (
    <div className="screen verdict">
      <div className="verdict-card">
        <div className="brief-head">
          {home}
          <span className="case-no">VCPD FORENSICS · CASE {index + 1}</span>
          <Stars count={stars} prev={Math.max(0, stars - entry.heat)} delay={scanMs / 1000 + 0.3} />
          <span className="cash"><CountUp from={cash - entry.total} to={cash} delay={scanMs + 100} /></span>
          <SoundToggle />
        </div>
        <div className="verdict-body">
          <div className={`evidence-photo doctored ${scanning ? 'scanning' : busted ? 'busted' : ''}`}>
            <img
              src={entry.edited}
              alt="Your doctored still"
              style={{
                left: `${(analysis.offset.ox / W) * 100}%`,
                top: `${(analysis.offset.oy / H) * 100}%`,
                width: `${(analysis.size.w / W) * 100}%`,
                height: `${(analysis.size.h / H) * 100}%`,
              }}
            />
            {!scanning && <>
              <img className="verdict-original" src={entry.still.dataUrl} alt="Original CCTV still" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} />
              <span className="compare-label compare-original" aria-hidden="true">ORIGINAL</span>
              <span className="compare-label compare-edited" aria-hidden="true">YOUR EDIT</span>
              <span className="compare-divider" style={{ left: `${compare}%` }} aria-hidden="true"><span>↔</span></span>
              <input className="compare-range" type="range" min="0" max="100" value={compare} onChange={event => setCompare(Number(event.target.value))} aria-label="Compare original and doctored evidence" />
            </>}
            <TargetBoxes results={results.slice(0, checked)} />
            {scanning && <div className="scanline" />}
            {busted && !scanning && <p className="busted-stamp"><span>BUSTED</span></p>}
          </div>
          <div className="brief-side">
            {scanning ? (
              <>
                <p className="stamp-text">Running forensics…</p>
                <ul className="scan-log">
                  {results.slice(0, checked).map((r) => (
                    <li key={r.key} className={r.pass ? 'pass' : 'fail'}>{r.label}<b>{forensicLabel(r)}</b></li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className={`stamp-text slam ${clean ? 'good' : 'bad'}`}>{headline}</p>
                {entry.reason === 'timeout' && <p className="note">Time ran out. The tape went in as-is.</p>}
                {analysis.unrecognisable && (
                  <p className="note">That still no longer matches the tape. The detectives are asking questions.</p>
                )}
                <ObjectiveList results={results} />
                <dl className="ledger">
                  <dt>Job payout</dt><dd className={entry.base ? undefined : 'bad'}>{money(entry.base)}</dd>
                  <dt>Time bonus ({entry.left}s left)</dt><dd className={entry.timeBonus ? undefined : 'bad'}>{money(entry.timeBonus)}</dd>
                  <dt>Clean edit ({Math.round(analysis.subtle * 100)}% untouched)</dt><dd className={entry.cleanBonus ? undefined : 'bad'}>{money(entry.cleanBonus)}</dd>
                  <dt>Heat gained</dt><dd className={entry.heat ? 'bad' : undefined}>+{entry.heat} ★</dd>
                </dl>
                <button className="btn primary" onClick={onNext}>
                  {busted ? 'Face the music' : index + 1 < CASES.length ? 'Next case →' : 'See your rap sheet'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RapSheet({ alias, history, stars, cash, walked, onReplay, home }) {
  const [poster, setPoster] = useState(null);
  const [posterError, setPosterError] = useState(false);
  const [printAttempt, setPrintAttempt] = useState(0);
  const busted = stars >= MAX_STARS;
  const rank = useMemo(() => rankFor(stars, busted, history.length, walked), [stars, busted, history.length, walked]);
  useEffect(() => {
    let active = true;
    let url;
    buildRapSheet({ alias, history, stars, cash, busted, rank })
      .then(blob => {
        url = URL.createObjectURL(blob);
        if (active) setPoster(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => { if (active) setPosterError(true); });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [alias, history, stars, cash, busted, rank, printAttempt]);

  const tweet = encodeURIComponent(
    `I doctored ${history.length} VCPD tapes in Leonida Evidence Room: ${money(cash)} earned, ${stars}★ heat. Rank: ${rank.title}. #BuiltWithImageEditor #GTAVI`,
  );
  return (
    <div className="screen rapsheet">
      <div className="rap-inner">
        <div className="screen-bar">{home}</div>
        <p className="kicker">{busted ? 'The VCPD caught up with you' : walked ? 'You walked away' : 'All tapes processed'}</p>
        <h2 className="logo small"><span>{rank.title}</span></h2>
        <p className="lede">{rank.line}</p>
        <div className="poster-slot">
          {poster ? <img className="poster" src={poster} alt="Your rap sheet poster" /> : posterError ? <p role="alert">The poster could not be created. Retry below.</p> : <p>Printing…</p>}
        </div>
        <div className="actions">
          {poster ? <a className="btn primary" href={poster} download="leonida-rap-sheet.png">Download poster</a>
            : posterError ? <button className="btn primary" onClick={() => { setPosterError(false); setPrintAttempt(n => n + 1); }}>Retry poster</button>
              : <button className="btn primary" disabled>Preparing poster…</button>}
          <a className="btn" href={`https://twitter.com/intent/tweet?text=${tweet}`} target="_blank" rel="noreferrer">Share on X</a>
          <button className="btn" onClick={onReplay}>Run it back</button>
        </div>
        <Leaderboard alias={alias} history={history} eligible={!busted && !walked && history.length === CASES.length} walked={walked} />
      </div>
    </div>
  );
}

// Finished runs can be posted once; busted runs only see the board.
function Leaderboard({ alias, history, eligible, walked }) {
  const [{ board, error }, setBoard] = useLeaderboard();
  const [fixer, setFixer] = useState(alias);
  const [post, setPost] = useState({ sending: false, entry: null, error: '' });
  const send = async (event) => {
    event.preventDefault();
    setPost({ sending: true, entry: null, error: '' });
    try {
      const { entry, ...latest } = await postRun(fixer, history);
      setBoard(latest);
      setPost({ sending: false, entry, error: '' });
    } catch (e) {
      setPost({ sending: false, entry: null, error: e.message });
    }
  };
  const total = board?.total ?? 0;
  return (
    <section className="board-panel" aria-labelledby="board-title">
      <h3 id="board-title">Top fixers</h3>
      {!eligible ? <p className="board-note">{walked ? 'Runs you walk away from' : "Busted runs"} don't make the board. Finish all five jobs to post your cash and time.</p>
        : post.entry ? <p className="board-note" role="status">Posted. <b>{post.entry.name}</b> is <b>#{post.entry.rank}</b> of {total}.</p>
          : (
            <form className="board-post" onSubmit={send}>
              <label>Name on the board<input value={fixer} maxLength={18} onChange={e => setFixer(e.target.value)} autoComplete="nickname" /></label>
              <button className="btn primary" disabled={post.sending}>{post.sending ? 'Posting…' : 'Post to leaderboard'}</button>
            </form>
          )}
      {post.error && <p className="board-note bad" role="alert">{post.error}</p>}
      {board?.top.length ? <LeaderboardTable className="board" rows={boardRows(board, post.entry)} highlight={post.entry?.id} />
        : <p className="board-note">{board ? 'No clean runs yet. Yours could be the first.' : error || 'Loading the board…'}</p>}
    </section>
  );
}

// Each line is rounded once so the ledger rows always add up to the cash shown.
function scoreCase(c, analysis, left) {
  const hides = analysis.results.filter((r) => r.kind === 'hide');
  const hidden = hides.filter((r) => r.pass).length;
  const heat = analysis.results.filter((r) => !r.pass).length;
  const share = hides.length ? hidden / hides.length : 1;
  const base = Math.round(c.payout * share);
  const timeBonus = share ? Math.round(left * 40 * share) : 0;
  const cleanBonus = heat === 0 ? Math.round(c.payout * 0.25 * analysis.subtle) : 0;
  return { base, timeBonus, cleanBonus, heat, total: base + timeBonus + cleanBonus };
}

export default function App() {
  const [scenes, setScenes] = useState(null);
  const [phase, setPhase] = useState('title');
  const [index, setIndex] = useState(0);
  const [stars, setStars] = useState(0);
  const [cash, setCash] = useState(0);
  const [history, setHistory] = useState([]);
  const [alias, setAlias] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [gameError, setGameError] = useState('');
  const [walked, setWalked] = useState(false);
  const [still, setStill] = useState(null);
  const submission = useRef(null);
  // Bumped whenever a run is left, so forensics still running for it can't pull the player back in.
  const run = useRef(0);

  useEffect(() => {
    let active = true;
    ensureFonts()
      .then(() => { if (active) setScenes(CASES.map((c, i) => renderCase(c, i))); })
      .catch(() => { if (active) setGameError('The evidence tapes could not load. Please reload and try again.'); });
    return () => { active = false; };
  }, []);

  const c = CASES[index];

  // The frozen frame becomes this tape's still; the tape's running time is already off the clock.
  const onFreeze = useCallback((t) => {
    setStill({ ...renderCase(c, index, t), used: Math.min(c.seconds, Math.ceil(t)) });
    setPhase('lab');
  }, [c, index]);

  const onSubmit = useCallback(
    async (edited, left, reason, targets) => {
      submission.current = { edited, left, reason, targets };
      const token = run.current;
      setPhase('analysing');
      let analysis;
      try { analysis = await analyse(still.canvas, edited, targets); }
      catch { if (token === run.current) setPhase('analysis-error'); return; }
      if (token !== run.current) return;
      // A KEEP that had to be in the shot but wasn't counts against you.
      const missing = still.missing.map((t) => ({ ...t, missing: true, pass: false, changed: 0, cells: [] }));
      analysis = { ...analysis, results: [...analysis.results, ...missing] };
      const s = scoreCase(c, analysis, left);
      setStars((x) => Math.min(MAX_STARS, x + s.heat));
      setCash((x) => x + s.total);
      setHistory((h) => [...h, { id: c.id, title: c.title, edited, still, analysis, left, reason, ...s }]);
      setPhase('verdict');
    },
    [c, still],
  );

  const next = () => {
    if (stars >= MAX_STARS || index + 1 >= CASES.length) setPhase('end');
    else {
      setIndex(index + 1);
      setPhase('briefing');
    }
  };

  const reset = () => {
    setIndex(0);
    setStars(0);
    setCash(0);
    setHistory([]);
    setWalked(false);
    setAttempt((a) => a + 1);
  };
  const restart = () => {
    reset();
    setPhase('briefing');
  };
  // Home resets the run and opens the landing page at the top: the #play anchor from the start button would
  // otherwise scroll it straight back down to the start form.
  const goHome = () => {
    run.current++;
    reset();
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
    setPhase('title');
  };
  // Walking away keeps a rap sheet of the finished jobs. A run that ended anyway (busted, or all five done) keeps its real ending.
  const over = stars >= MAX_STARS || history.length >= CASES.length;
  const walkAway = () => {
    run.current++;
    setWalked(!over);
    setPhase('end');
  };

  const name = alias.trim() || 'The Cleaner';
  const home = <HomeButton onHome={goHome} />;
  const runHome = <HomeButton confirm finished={history.length} over={over} onHome={goHome} onRapSheet={walkAway} />;

  // A tape that failed to load stays failed until the page reloads, so Home reloads the landing page.
  if (gameError) return <div className="screen center"><div className="screen-bar"><HomeButton onHome={() => window.location.assign('/')} /></div><div role="alert"><p>{gameError}</p><button className="btn primary" onClick={() => window.location.reload()}>Reload game</button></div></div>;
  if (phase === 'analysis-error') return <div className="screen center"><div className="screen-bar">{home}</div><div role="alert"><p>Forensics could not read the submitted image. Your score has not changed.</p><div className="actions"><button className="btn primary" onClick={() => { const last = submission.current; onSubmit(last.edited, last.left, last.reason, last.targets); }}>Retry forensics</button><button className="btn" onClick={() => { setAttempt(n => n + 1); setPhase('briefing'); }}>Redo this tape</button></div></div></div>;

  if (phase === 'title') return <Home ready={!!scenes} scenes={scenes} alias={alias} setAlias={setAlias} onStart={() => { unlockAudio(); window.scrollTo(0, 0); setPhase('briefing'); }} />;
  if (phase === 'briefing') return <Feed key={`${attempt}-${index}`} index={index} c={c} stars={stars} cash={cash} onFreeze={onFreeze} home={runHome} />;
  if (phase === 'lab') return <Lab key={`${attempt}-${index}`} index={index} c={c} still={still} budget={c.seconds - still.used} stars={stars} cash={cash} onSubmit={onSubmit} home={runHome} />;
  if (phase === 'analysing') return <div className="screen center"><div className="screen-bar">{runHome}</div><p className="stamp-text">Uploading to VCPD evidence…</p></div>;
  if (phase === 'verdict') return <Verdict key={index} index={index} entry={history[history.length - 1]} stars={stars} cash={cash} onNext={next} home={runHome} />;
  return <RapSheet alias={name} history={history} stars={stars} cash={cash} walked={walked} onReplay={restart} home={home} />;
}
