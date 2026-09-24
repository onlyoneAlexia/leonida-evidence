import { useEffect, useRef, useState } from 'react';
import { CASES } from './scenes.js';
import LeaderboardTable from './LeaderboardTable.jsx';
import { boardRows, useLeaderboard } from './leaderboard.js';
import './Home.css';

const ART = '/art/leonida-crew-v2.webp';
const UNLAYER = 'https://unlayer.com/';
const clamp = (n) => Math.max(0, Math.min(1, n));
const pad = (n) => String(n + 1).padStart(2, '0');

function Arrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

function UnlayerLogo() {
  return <img className="ler-unlayer-logo" src="/brand/unlayer-logo-white.webp" width="333" height="96" alt="Unlayer" />;
}

export default function Home({ ready, alias, setAlias, onStart, scenes }) {
  const film = useRef(null);
  const stage = useRef(null);
  const [insideMonitor, setInsideMonitor] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selected, setSelected] = useState(0);
  const [wipe, setWipe] = useState(55);
  const [redacted, setRedacted] = useState(true);
  const mission = CASES[selected];
  const scene = scenes?.[selected];
  const [{ board, error: boardError }] = useLeaderboard();

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 40);
      if (!film.current || !stage.current) return;
      const rect = film.current.getBoundingClientRect();
      const distance = Math.max(1, rect.height - stage.current.clientHeight);
      const progress = motion.matches ? 0 : clamp(-rect.top / distance);
      stage.current.style.setProperty('--zoom', progress.toFixed(4));
      setInsideMonitor(progress > 0.12);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    motion.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      motion.removeEventListener('change', schedule);
    };
  }, []);

  // React renders these sections after the browser's own anchor jump, so honour links like /#play here.
  useEffect(() => {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);

  return (
    <main className="ler-home" id="top">
      <nav className={`ler-nav ${scrolled ? 'is-scrolled' : ''}`} aria-label="Main navigation">
        <a href="#how">HOW IT WORKS</a><a href="#evidence">THE EVIDENCE</a>
        <a className="ler-mark" href="#top" aria-label="Leonida Evidence Room home">L<span>★</span></a>
        <a href="#cases">CASE FILES</a><a href="#play">PLAY NOW <span aria-hidden="true">↗</span></a>
      </nav>

      <section className="ler-film" ref={film} aria-label="Welcome to Leonida">
        <div className="ler-stage" ref={stage}>
          <div className="ler-studio" aria-hidden="true" />
          <div className="ler-studio-copy">
            <p className="ler-kicker">WELCOME TO YOUR NEW DAY JOB</p>
            <h2 className="ler-heading">MAKE IT<br />DISAPPEAR.</h2>
            <p>The crew makes a mess. You make it history.</p>
          </div>
          <div className="ler-screen" inert={insideMonitor}>
            <div className="ler-bezel" aria-hidden="true"><span>LEONIDA ELECTRONICS <b>●</b></span></div>
            <div className="ler-screen-content">
              <img className="ler-hero-art" src={ART} fetchPriority="high" alt="The illustrated Leonida crew in burgundy, teal, coral, and orange streetwear on a pastel waterfront" />
              <div className="ler-hero-tint" />
              <span className="ler-spark ler-spark-one" aria-hidden="true">✧</span><span className="ler-spark ler-spark-two" aria-hidden="true">✦</span>
              <div className="ler-hero-copy">
                <p className="ler-kicker">FIVE JOBS. NO WITNESSES.</p>
                <h1 className="ler-title"><span>LEONIDA</span><small>EVIDENCE ROOM</small></h1>
                <p className="ler-hero-tagline">THEY DID THE CRIME.<br />YOU FIX THE PICTURE.</p>
                <a className="ler-button ler-button-pink" href="#play">LET’S GET TO WORK <Arrow /></a>
                <a className="ler-powered" href={UNLAYER} target="_blank" rel="noopener noreferrer"><span>POWERED BY</span><UnlayerLogo /></a>
              </div>
              <div className="ler-hud"><span>HEAT LEVEL</span><b aria-label="Zero of five wanted stars">☆☆☆☆☆</b><i /><small>KEEP IT CLEAN.</small></div>
              <div className="ler-location"><span>25°46′ N / 80°11′ W</span><b>LEONIDA, AFTER HOURS.</b></div>
              <a href="#how" className="ler-scroll">SCROLL TO GO UNDERGROUND <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="ler-monitor-base" aria-hidden="true" />
          <span className="ler-studio-caption">YOUR DESK. YOUR ALIBI.</span>
        </div>
      </section>

      <section id="how" className="ler-how ler-grid-bg" aria-labelledby="how-title">
        <div className="ler-section-top"><span>01 / THE BRIEFING</span><span>STRICTLY OFF THE RECORD</span></div>
        <h2 id="how-title" className="ler-heading">HOW IT WORKS<span className="ler-index">01</span></h2>
        <p className="ler-subheading">A little creativity. A lot of plausible deniability.</p>
        <ol className="ler-steps">
          <li><span className="ler-step-icon" aria-hidden="true">⌖</span><b>01 / FREEZE IT</b><h3>Pick your moment.</h3><p>The tape rolls live. Freeze the frame where the least evidence shows, but the clock is already running. Keep the timestamp intact.</p></li>
          <li><span className="ler-step-icon" aria-hidden="true">✎</span><b>02 / FIX IT</b><h3>Change the story.</h3><p>Paint, crop, cover, or drop a sticker. Use Unlayer’s image editor to clean up the crew’s mistakes before time runs out.</p></li>
          <li><span className="ler-step-icon" aria-hidden="true">☆</span><b>03 / GET AWAY</b><h3>Lose the heat.</h3><p>Forensics checks what’s left. Missed evidence adds wanted stars. Five stars and the whole operation is busted.</p></li>
        </ol>
        <a className="ler-button" href="#evidence">TAKE A CLOSER LOOK <Arrow /></a>
      </section>

      <section id="evidence" className="ler-evidence" aria-labelledby="evidence-title">
        <div className="ler-demo ler-grid-bg">
          <div className="ler-demo-header"><span><i /> VCPD / LIVE EVIDENCE</span><span>TAPE {pad(selected)}</span></div>
          <div className="ler-demo-monitor">
            <div className="ler-demo-picture">
              {scene ? <>
                <img src={scene.dataUrl} alt={`Original CCTV evidence: ${mission.title}`} />
                {redacted && <div className="ler-redaction-layer" style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }} aria-hidden="true">
                  {scene.targets.filter(t => t.kind === 'hide').map(t => <span key={t.key} className="ler-redaction" style={{ left: `${t.rect.x / scene.canvas.width * 100}%`, top: `${t.rect.y / scene.canvas.height * 100}%`, width: `${t.rect.w / scene.canvas.width * 100}%`, height: `${t.rect.h / scene.canvas.height * 100}%` }}>REDACTED</span>)}
                </div>}
                <div className="ler-wipe-line" style={{ left: `${wipe}%` }} aria-hidden="true"><span>↔</span></div>
              </> : <span className="ler-loading">LOADING TAPE…</span>}
            </div>
            <div className="ler-monitor-controls"><span>LER — EDIT SUITE 01</span><span className="ler-led" /></div>
          </div>
          <div className="ler-demo-control"><label htmlFor="evidence-wipe">{redacted ? 'EDITED' : 'ORIGINAL'}<span>DRAG TO INSPECT</span>ORIGINAL</label><input id="evidence-wipe" type="range" min="0" max="100" value={wipe} onChange={e => setWipe(Number(e.target.value))} aria-label="Reveal edited evidence preview" disabled={!scene} /></div>
          <p className="ler-demo-note">Interactive preview. Your actual edits happen in the game.</p>
        </div>
        <div className="ler-evidence-copy">
          <p className="ler-kicker">02 / THE ART OF GETTING AWAY</p>
          <h2 id="evidence-title" className="ler-heading">NO FACE.<br />NO CASE.<span className="ler-index">02</span></h2>
          <p className="ler-subheading">The most dangerous thing<br />in Leonida? A clear picture.</p>
          <div className="ler-dots" aria-hidden="true">▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪</div>
          <p>Lucia and Jason pulled five jobs. The VCPD has every one on tape. You’re the fixer with an image editor and a very short window to make the evidence go away.</p>
          <p>Hide the crew. Protect the timestamp. And if Rico’s in the shot? Let him take the fall.</p>
          <div className="ler-action-row"><button className="ler-button" onClick={() => setRedacted(v => !v)} aria-pressed={redacted}>{redacted ? 'SHOW ORIGINAL' : 'SHOW THE COVER-UP'}</button><a className="ler-button ler-button-pink" href="#play">I’M IN <Arrow /></a></div>
        </div>
      </section>

      <section id="cases" className="ler-cases ler-grid-bg" aria-labelledby="cases-title">
        <div className="ler-section-top"><span>03 / THE EVIDENCE LOCKER</span><span>HANDLE WITH EXTREME CREATIVITY</span></div>
        <h2 id="cases-title" className="ler-heading">FIVE DIRTY JOBS.<span className="ler-index">03</span></h2>
        <p className="ler-subheading">A whole city of bad decisions. All caught on camera.</p>
        <div className="ler-tapes">{CASES.map((c, i) => <button key={c.id} className={`ler-tape ${selected === i ? 'is-selected' : ''}`} onClick={() => { setSelected(i); setWipe(55); }} aria-pressed={selected === i} aria-label={`Preview ${c.title}`}>
          <div className="ler-tape-image">{scenes?.[i] && <img src={scenes[i].dataUrl} alt="" loading="lazy" />}<span>{pad(i)}</span></div>
          <div className="ler-tape-label"><small>VCPD / TAPE {pad(i)}</small><h3>{c.title}</h3><span>{c.seconds} SEC <b>↗</b></span></div>
        </button>)}</div>
        <div className="ler-case-info" aria-live="polite" aria-atomic="true"><div><span>FILE {pad(selected)} / {mission.place}</span><p>{mission.brief}</p></div><div className="ler-case-payout"><span>MAX PAYOUT</span><b>${mission.payout.toLocaleString('en-US')}</b></div><a href="#evidence" className="ler-button">INSPECT TAPE <Arrow /></a></div>
      </section>

      <section id="leaders" className="ler-leaders ler-grid-bg" aria-labelledby="leaders-title">
        <div className="ler-section-top"><span>04 / MOST WANTED</span><span>CLEAN RUNS ONLY</span></div>
        <h2 id="leaders-title" className="ler-heading">TOP FIXERS.<span className="ler-index">04</span></h2>
        <p className="ler-subheading">Most cash wins. Faster hands break ties.</p>
        {board?.top.length ? <LeaderboardTable className="ler-board" rows={boardRows(board)} />
          : <p className="ler-board-note" role="status">{board ? 'No clean runs yet. Finish all five jobs to take the top spot.' : boardError || 'Pulling the file…'}</p>}
        <p className="ler-board-note">Only runs that finish all five jobs count. Time is the clock you used across the jobs.</p>
      </section>

      <section id="play" className="ler-play" aria-labelledby="play-title">
        <div className="ler-play-art" role="img" aria-label="The crew waiting in the illustrated evidence studio" />
        <div className="ler-play-copy">
          <p className="ler-kicker">05 / CLOCK IN, CLEAN UP</p>
          <h2 id="play-title" className="ler-heading">YOU WERE<br />NEVER HERE.<span className="ler-index">05</span></h2>
          <p className="ler-subheading">New name. Clean slate. Dirty work.</p>
          <form onSubmit={e => { e.preventDefault(); if (ready) onStart(); }}>
            <label htmlFor="fixer-alias">WHAT DO WE CALL YOU? <span>(OPTIONAL)</span></label>
            <input id="fixer-alias" placeholder="Your fixer alias" maxLength={18} value={alias} onChange={e => setAlias(e.target.value)} autoComplete="nickname" />
            <button type="submit" className="ler-button ler-button-pink" disabled={!ready}>{ready ? 'START THE FIRST JOB' : 'LOADING THE TAPES…'}<Arrow /></button>
          </form>
          <p className="ler-play-note">5 JOBS · SINGLE PLAYER · YOUR REPUTATION ON THE LINE</p>
        </div>
      </section>
      <footer className="ler-footer"><a href="#top">LEONIDA / EVIDENCE ROOM <span>↑</span></a><p>Built with <a className="ler-footer-unlayer" href={UNLAYER} target="_blank" rel="noopener noreferrer"><UnlayerLogo /></a> React Image Editor · #BuiltWithImageEditor</p><small>A GTA-inspired fan project. Not affiliated with Rockstar Games. <a href="/credits.txt">Credits and licenses</a></small></footer>
    </main>
  );
}
