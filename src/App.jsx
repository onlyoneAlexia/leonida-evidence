import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import { CASES, W, H, ensureFonts, renderCase } from './scenes.js';
import { analyse } from './forensics.js';
import { buildRapSheet, rankFor } from './rapsheet.js';
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

// Stars earned since `prev` pop in one after another.
function Stars({ count, prev = count }) {
  return (
    <span className="stars" aria-label={`${count} of ${MAX_STARS} wanted stars`}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span
          key={i}
          className={`${i < count ? 'on' : ''} ${i >= prev && i < count ? 'new' : ''}`}
          style={{ animationDelay: `${1.9 + (i - prev) * 0.25}s` }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function Title({ onStart, cover, alias, setAlias }) {
  return (
    <div className="screen title" style={{ backgroundImage: cover ? `url(${cover})` : undefined }}>
      <div className="title-inner">
        <p className="kicker">A Leonida story · 5 jobs · 1 image editor</p>
        <h1 className="logo">
          <span>LEONIDA</span>
          <span className="logo-sub">EVIDENCE ROOM</span>
        </h1>
        <p className="lede">
          Lucia and Jason pulled five jobs across Leonida. The VCPD has the tapes. You have a
          photo lab, the React Image Editor, and a clock. Scrub every face, plate and bag of cash
          before forensics runs — and don't touch the timestamp.
        </p>
        <label className="alias">
          <span>Your fixer alias</span>
          <input value={alias} maxLength={18} onChange={(e) => setAlias(e.target.value)} placeholder="The Cleaner" />
        </label>
        <button className="btn primary" onClick={onStart} disabled={!cover}>
          {cover ? 'Open the evidence locker' : 'Loading tapes…'}
        </button>
        <ul className="how">
          <li><b>Hide</b> the marked evidence: draw over it, drop a shape or sticker, blur it, or crop it out.</li>
          <li><b>Keep</b> the timestamp (and anything framing Rico) intact. Tampering adds wanted stars.</li>
          <li><b>5 stars</b> and you're busted. Leftover seconds and a clean edit earn extra cash.</li>
        </ul>
      </div>
    </div>
  );
}

function Briefing({ index, c, scene, stars, cash, onGo }) {
  return (
    <div className="screen briefing">
      <div className="brief-card">
        <div className="brief-head">
          <span className="case-no">CASE {index + 1} / {CASES.length}</span>
          <Stars count={stars} />
          <span className="cash">{money(cash)}</span>
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
          <span>{t.kind === 'hide' ? 'HIDE' : 'KEEP'}</span>
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
  const [editorH, setEditorH] = useState(600);
  const wrapRef = useRef(null);
  const done = useRef(false);

  // The editor sizes itself from minHeight, so feed it the space the layout leaves.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setEditorH(Math.max(420, Math.floor(e.contentRect.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const submit = useCallback(
    (dataUrl, reason) => {
      if (done.current) return;
      done.current = true;
      const img = dataUrl ?? editorRef.current?.editor?.getImage() ?? scene.dataUrl;
      onSubmit(img, left, reason);
    },
    [left, onSubmit, scene.dataUrl],
  );

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ready]);

  useEffect(() => {
    if (left === 0) submit(null, 'timeout');
  }, [left, submit]);

  const hurry = left <= 10;
  return (
    <div className={`screen lab ${hurry ? 'hurry' : ''}`}>
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
      <div className="lab-body">
        <aside className="lab-side">
          <h3>Orders</h3>
          <ObjectiveList targets={scene.targets} />
          <div className="mini">
            <img src={scene.dataUrl} alt="" />
            <TargetBoxes targets={scene.targets} />
          </div>
          <h3>Fixer tips</h3>
          <ul className="tips">
            <li><b>Draw</b> or <b>Shapes</b>: paint over a face or plate.</li>
            <li><b>Stickers</b>: slap something on it. Style points.</li>
            <li><b>Crop</b>: cut evidence out, but the timestamp must survive.</li>
            <li><b>Filter → blur</b> hits the whole frame. Forensics will notice.</li>
          </ul>
        </aside>
        <div className="editor-wrap" ref={wrapRef}>
          <ImageEditor
            ref={editorRef}
            image={scene.dataUrl}
            options={EDITOR_OPTIONS}
            minHeight={editorH}
            onLoad={() => setReady(true)}
            onSave={({ dataUrl }) => submit(dataUrl, 'save')}
            onCancel={() => editorRef.current?.editor?.reset(scene.dataUrl)}
            onError={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  );
}

function Verdict({ index, scene, entry, stars, cash, onNext }) {
  const [scanning, setScanning] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setScanning(false), 1600);
    return () => clearTimeout(t);
  }, []);
  const { analysis } = entry;
  const allHidden = analysis.results.filter((r) => r.kind === 'hide').every((r) => r.pass);
  const clean = analysis.results.every((r) => r.pass);
  const busted = stars >= MAX_STARS;
  const headline = busted
    ? 'BUSTED'
    : clean
      ? 'CASE DISMISSED'
      : allHidden
        ? 'TAMPERING SUSPECTED'
        : 'EVIDENCE LEAKED';

  return (
    <div className="screen verdict">
      <div className="verdict-card">
        <div className="brief-head">
          <span className="case-no">VCPD FORENSICS · CASE {index + 1}</span>
          <Stars count={stars} prev={Math.max(0, stars - entry.heat)} />
          <span className="cash"><CountUp from={cash - entry.total} to={cash} delay={1700} /></span>
        </div>
        <div className="verdict-body">
          <div className={`evidence-photo doctored ${scanning ? 'scanning' : ''}`}>
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
            {!scanning && <TargetBoxes targets={scene.targets} results={analysis.results} />}
            {scanning && <div className="scanline" />}
          </div>
          <div className="brief-side">
            {scanning ? (
              <p className="stamp-text">Running forensics…</p>
            ) : (
              <>
                <p className={`stamp-text slam ${clean ? 'good' : 'bad'}`}>{headline}</p>
                {entry.reason === 'timeout' && <p className="note">Time ran out. The tape went in as-is.</p>}
                {analysis.unrecognisable && (
                  <p className="note">That still no longer matches the tape. The detectives are asking questions.</p>
                )}
                <ObjectiveList targets={scene.targets} results={analysis.results} />
                <dl className="ledger">
                  <dt>Job payout</dt><dd>{money(entry.base)}</dd>
                  <dt>Time bonus ({entry.left}s left)</dt><dd>{money(entry.timeBonus)}</dd>
                  <dt>Clean edit ({Math.round(analysis.subtle * 100)}% untouched)</dt><dd>{money(entry.cleanBonus)}</dd>
                  <dt>Heat gained</dt><dd>+{entry.heat} ★</dd>
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
  const busted = stars >= MAX_STARS;
  const rank = rankFor(stars, busted, history.length);
  useEffect(() => {
    buildRapSheet({ alias, history, stars, cash, busted, rank }).then(setPoster);
  }, [alias, history, stars, cash, busted, rank]);

  const tweet = encodeURIComponent(
    `I doctored ${history.length} VCPD tapes in Leonida Evidence Room: ${money(cash)} earned, ${stars}★ heat. Rank: ${rank.title}. #BuiltWithImageEditor #GTAVI`,
  );
  return (
    <div className="screen rapsheet">
      <div className="rap-inner">
        <p className="kicker">{busted ? 'The VCPD caught up with you' : 'All tapes processed'}</p>
        <h2 className="logo small"><span>{busted ? 'BUSTED' : 'RAP SHEET'}</span></h2>
        <p className="lede">{rank.line}</p>
        {poster ? <img className="poster" src={poster} alt="Your rap sheet poster" /> : <p>Printing…</p>}
        <div className="actions">
          <a className="btn primary" href={poster ?? '#'} download="leonida-rap-sheet.png">Download poster</a>
          <a className="btn" href={`https://twitter.com/intent/tweet?text=${tweet}`} target="_blank" rel="noreferrer">Share on X</a>
          <button className="btn" onClick={onReplay}>Run it back</button>
        </div>
      </div>
    </div>
  );
}

function scoreCase(c, analysis, left) {
  const hides = analysis.results.filter((r) => r.kind === 'hide');
  const hidden = hides.filter((r) => r.pass).length;
  const heat = analysis.results.filter((r) => !r.pass).length;
  const base = (c.payout * hidden) / hides.length;
  const timeBonus = hidden ? left * 40 * (hidden / hides.length) : 0;
  const cleanBonus = heat === 0 ? c.payout * 0.25 * analysis.subtle : 0;
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

  useEffect(() => {
    ensureFonts().then(() => setScenes(CASES.map((c, i) => renderCase(c, i))));
  }, []);

  const c = CASES[index];
  const scene = scenes?.[index];

  const onSubmit = useCallback(
    async (edited, left, reason) => {
      setPhase('analysing');
      const analysis = await analyse(scene.canvas, edited, scene.targets);
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

  const cover = useMemo(() => scenes?.[1]?.dataUrl, [scenes]);
  const name = alias.trim() || 'The Cleaner';

  if (phase === 'title') return <Title onStart={() => setPhase('briefing')} cover={cover} alias={alias} setAlias={setAlias} />;
  if (phase === 'briefing') return <Briefing index={index} c={c} scene={scene} stars={stars} cash={cash} onGo={() => setPhase('lab')} />;
  if (phase === 'lab') return <Lab key={`${attempt}-${index}`} index={index} c={c} scene={scene} stars={stars} cash={cash} onSubmit={onSubmit} />;
  if (phase === 'analysing') return <div className="screen center"><p className="stamp-text">Uploading to VCPD evidence…</p></div>;
  if (phase === 'verdict') return <Verdict key={index} index={index} scene={scene} entry={history[history.length - 1]} stars={stars} cash={cash} onNext={next} />;
  return <RapSheet alias={name} history={history} stars={stars} cash={cash} onReplay={restart} />;
}
