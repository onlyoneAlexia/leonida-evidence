import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import { CASES, W, H, ensureFonts, renderCase } from './scenes.js';
import { analyse } from './forensics.js';
import { buildRapSheet, rankFor } from './rapsheet.js';
import { isMuted, play, setMuted, subscribe, unlockAudio } from './sound.js';
import Home from './Home.jsx';
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

// What forensics reports on each evidence box: hidden evidence comes back CLEAN, visible evidence a MATCH.
const forensicLabel = (r) => (r.kind === 'hide' ? (r.pass ? 'CLEAN' : 'MATCH') : r.pass ? 'INTACT' : 'TAMPERED');

function Briefing({ index, c, scene, stars, cash, onGo }) {
  return (
    <div className="screen briefing">
      <div className="brief-card">
        <div className="brief-head">
          <span className="case-no">CASE {index + 1} / {CASES.length}</span>
          <Stars count={stars} />
          <span className="cash">{money(cash)}</span>
          <SoundToggle />
        </div>
        <h2>{c.title}</h2>
        <p className="place">{c.place}</p>
        <div className="brief-body">
          <div className="evidence-photo">
            <img src={scene.dataUrl} alt={`CCTV still: ${c.title}`} />
            <TargetBoxes targets={scene.targets} />
          </div>
          <div className="brief-side">
            <p className="brief-text">{c.brief}</p>
            <ObjectiveList targets={scene.targets} />
            <p className="clock">⏱ {c.seconds} seconds · payout up to {money(c.payout)}</p>
            <button className="btn primary" onClick={onGo}>Start doctoring</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TargetBoxes({ targets, results }) {
  return (
    <div className="boxes">
      {(results ?? targets).map((t) => (
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

function ObjectiveList({ targets, results }) {
  const list = results ?? targets;
  return (
    <ul className="objectives">
      {list.map((t) => (
        <li key={t.key} className={`${t.kind} ${results ? (t.pass ? 'pass' : 'fail') : ''}`}>
          <b>{t.kind === 'hide' ? 'HIDE' : 'KEEP'}</b>
          <span>{t.label}</span>
          {results && (
            <em>
              {t.kind === 'hide'
                ? t.pass ? `scrubbed ${Math.round(t.changed * 100)}%` : `visible (${Math.round(t.changed * 100)}% hidden)`
                : t.pass ? 'intact' : `tampered ${Math.round(t.changed * 100)}%`}
            </em>
          )}
        </li>
      ))}
    </ul>
  );
}

function Lab({ index, c, scene, stars, cash, onSubmit }) {
  const editorRef = useRef(null);
  const [left, setLeft] = useState(c.seconds);
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
  const remaining = useRef(c.seconds);

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
        onSubmit(img, left, reason);
      } catch {
        done.current = false;
        setReady(false);
        setError('Your edit could not be exported. Retry the editor to reload this tape. Your timer is paused.');
      }
    },
    [left, onSubmit],
  );

  useEffect(() => {
    if (!ready) return;
    const deadline = Date.now() + remaining.current * 1000;
    const tick = () => {
      remaining.current = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining.current);
    };
    const t = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [ready]);

  useEffect(() => {
    if (ready && left === 0) submit(null, 'timeout');
  }, [left, ready, submit]);

  // One tick a second through the final countdown.
  useEffect(() => {
    if (ready && left > 0 && left <= 10) play('tick');
  }, [left, ready]);

  const hurry = left <= 10;
  return (
    <div ref={labRef} className={`screen lab ${hurry ? 'hurry' : ''} ${expanded ? 'workspace-expanded' : ''}`}>
      <div className="hud">
        <div className="hud-left">
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
          <ObjectiveList targets={scene.targets} />
          <div className="mini">
            <img src={scene.dataUrl} alt="" />
            <TargetBoxes targets={scene.targets} />
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
            image={scene.dataUrl}
            options={EDITOR_OPTIONS}
            minHeight={0}
            onLoad={setMountedEditor}
            onSave={({ dataUrl }) => submit(dataUrl, 'save')}
            onCancel={async () => {
              const editor = editorRef.current?.editor;
              setReady(false);
              setMountedEditor(null);
              try { await editor?.reset(scene.dataUrl); setMountedEditor(editor); }
              catch { failEditor(); }
            }}
            onError={failEditor}
            onLoadError={failEditor}
          />}
        </div>
      </div>
    </div>
  );
}

// Forensics checks the evidence boxes one at a time before the verdict lands.
const SCAN_LEAD = 400;
const SCAN_STEP = 420;

function Verdict({ index, scene, entry, stars, cash, onNext }) {
  const { analysis } = entry;
  const { results } = analysis;
  const [checked, setChecked] = useState(0);
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
            <TargetBoxes targets={scene.targets} results={results.slice(0, checked)} />
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
                <ObjectiveList targets={scene.targets} results={results} />
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

function RapSheet({ alias, history, stars, cash, onReplay }) {
  const [poster, setPoster] = useState(null);
  const [posterError, setPosterError] = useState(false);
  const [printAttempt, setPrintAttempt] = useState(0);
  const busted = stars >= MAX_STARS;
  const rank = useMemo(() => rankFor(stars, busted, history.length), [stars, busted, history.length]);
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
        <p className="kicker">{busted ? 'The VCPD caught up with you' : 'All tapes processed'}</p>
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
      </div>
    </div>
  );
}

// Each line is rounded once so the ledger rows always add up to the cash shown.
function scoreCase(c, analysis, left) {
  const hides = analysis.results.filter((r) => r.kind === 'hide');
  const hidden = hides.filter((r) => r.pass).length;
  const heat = analysis.results.filter((r) => !r.pass).length;
  const base = Math.round((c.payout * hidden) / hides.length);
  const timeBonus = hidden ? Math.round(left * 40 * (hidden / hides.length)) : 0;
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
  const submission = useRef(null);

  useEffect(() => {
    let active = true;
    ensureFonts()
      .then(() => { if (active) setScenes(CASES.map((c, i) => renderCase(c, i))); })
      .catch(() => { if (active) setGameError('The evidence tapes could not load. Please reload and try again.'); });
    return () => { active = false; };
  }, []);

  const c = CASES[index];
  const scene = scenes?.[index];

  const onSubmit = useCallback(
    async (edited, left, reason) => {
      submission.current = { edited, left, reason };
      setPhase('analysing');
      let analysis;
      try { analysis = await analyse(scene.canvas, edited, scene.targets); }
      catch { setPhase('analysis-error'); return; }
      const s = scoreCase(c, analysis, left);
      setStars((x) => Math.min(MAX_STARS, x + s.heat));
      setCash((x) => x + s.total);
      setHistory((h) => [...h, { id: c.id, title: c.title, edited, analysis, left, reason, ...s }]);
      setPhase('verdict');
    },
    [c, scene],
  );

  const next = () => {
    if (stars >= MAX_STARS || index + 1 >= CASES.length) setPhase('end');
    else {
      setIndex(index + 1);
      setPhase('briefing');
    }
  };

  const restart = () => {
    setIndex(0);
    setStars(0);
    setCash(0);
    setHistory([]);
    setAttempt((a) => a + 1);
    setPhase('briefing');
  };

  const name = alias.trim() || 'The Cleaner';

  if (gameError) return <div className="screen center"><div role="alert"><p>{gameError}</p><button className="btn primary" onClick={() => window.location.reload()}>Reload game</button></div></div>;
  if (phase === 'analysis-error') return <div className="screen center"><div role="alert"><p>Forensics could not read the submitted image. Your score has not changed.</p><button className="btn primary" onClick={() => { const last = submission.current; onSubmit(last.edited, last.left, last.reason); }}>Retry forensics</button><button className="btn" onClick={() => { setAttempt(n => n + 1); setPhase('briefing'); }}>Redo this tape</button></div></div>;

  if (phase === 'title') return <Home ready={!!scenes} scenes={scenes} alias={alias} setAlias={setAlias} onStart={() => { unlockAudio(); window.scrollTo(0, 0); setPhase('briefing'); }} />;
  if (phase === 'briefing') return <Briefing index={index} c={c} scene={scene} stars={stars} cash={cash} onGo={() => { unlockAudio(); setPhase('lab'); }} />;
  if (phase === 'lab') return <Lab key={`${attempt}-${index}`} index={index} c={c} scene={scene} stars={stars} cash={cash} onSubmit={onSubmit} />;
  if (phase === 'analysing') return <div className="screen center"><p className="stamp-text">Uploading to VCPD evidence…</p></div>;
  if (phase === 'verdict') return <Verdict key={index} index={index} scene={scene} entry={history[history.length - 1]} stars={stars} cash={cash} onNext={next} />;
  return <RapSheet alias={name} history={history} stars={stars} cash={cash} onReplay={restart} />;
}
