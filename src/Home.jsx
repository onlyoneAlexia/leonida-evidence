import { useEffect, useMemo, useState } from 'react';
import { CASES, renderCharacter } from './scenes.js';
import './Home.css';

const CAST = [
  {
    key: 'jason',
    name: 'Jason',
    role: 'The Muscle',
    bio: 'Hawaiian shirts, bad decisions, and a real talent for staring straight into security cameras.',
  },
  {
    key: 'lucia',
    name: 'Lucia',
    role: 'The Brains',
    bio: 'Fresh out of Leonida Penitentiary, with an L+J tattoo the VCPD would love to photograph.',
  },
  {
    key: 'rico',
    name: 'Rico',
    role: 'The Fall Guy',
    bio: "Runs the same jobs across Vice City. Keep his face in the shot and he takes the heat for you.",
  },
];

const TOOL_ICONS = {
  Draw: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  Crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  Shapes: 'M12 3l4 7H8l4-7zM4 14h7v7H4zM17.5 14a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  Stickers: 'M12 21a9 9 0 1 1 9-9M8.5 14.5s1.3 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9h.01M15 9h.01',
  Text: 'M4 7V4h16v3M9 20h6M12 4v16',
  Filter: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
};

// Deterministic skyline silhouette for the hero backdrop.
function skylinePath() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let d = 'M0 200 ';
  let x = 0;
  while (x < 1200) {
    const w = 30 + rand() * 60;
    const h = 40 + rand() * 130;
    d += `L${x} ${200 - h} L${x + w} ${200 - h} `;
    x += w + 2;
  }
  return d + 'L1200 200 Z';
}

function Palm({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 320" aria-hidden="true">
      <path d="M100 320 C 104 240, 96 170, 108 110" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round" />
      <g className="fronds" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        <path d="M108 110 Q 60 70 10 100" />
        <path d="M108 110 Q 70 50 40 40" />
        <path d="M108 110 Q 120 40 100 10" />
        <path d="M108 110 Q 160 50 190 60" />
        <path d="M108 110 Q 160 100 195 140" />
        <path d="M108 110 Q 60 110 30 160" />
      </g>
    </svg>
  );
}

export default function Home({ ready, alias, setAlias, onStart, scenes }) {
  const [spot, setSpot] = useState(1);
  // Drawn once fonts are in (ready), so the tattoo lettering renders correctly.
  const art = useMemo(
    () =>
      ready
        ? Object.fromEntries(
            CAST.map((c) => [c.key, { open: renderCharacter(c.key), shut: renderCharacter(c.key, { blink: true }) }]),
          )
        : null,
    [ready],
  );
  const skyline = useMemo(() => skylinePath(), []);

  useEffect(() => {
    const t = setInterval(() => setSpot((s) => (s + 1) % CAST.length), 5000);
    return () => clearInterval(t);
  }, [spot]);

  const featured = CAST[spot];
  const initial = (alias.trim() || 'C')[0].toUpperCase();

  return (
    <div className="home">
      <div className="embers" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i * 0.7) % 9}s`, animationDuration: `${8 + (i % 5) * 2}s` }} />
        ))}
      </div>

      <section className="hero-card">
        <div className="hero-sky" aria-hidden="true">
          <div className="sun" />
          <svg className="skyline" viewBox="0 0 1200 200" preserveAspectRatio="none">
            <path d={skyline} />
          </svg>
          <Palm className="palm palm-a" />
          <Palm className="palm palm-b" />
        </div>

        <nav className="hero-nav">
          <div className="brand">
            <span className="dots-grid" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
            </span>
            <span>Leonida<b>ER</b></span>
          </div>
          <ul>
            <li><button className="active" onClick={onStart} disabled={!ready}>Play</button></li>
            <li><a href="#how">How to play</a></li>
            <li><a href="#cases">Case files</a></li>
          </ul>
          <div className="avatar" title={alias.trim() || 'Your fixer'}>{initial}</div>
        </nav>

        <div className="hero-copy">
          <p className="trend">#1 Most Wanted · Vice City</p>
          <p className="studio">A GTA VI-inspired photo heist</p>
          <h1 className="hero-title">
            <span>LEONIDA</span>
            <span className="sub">EVIDENCE ROOM</span>
          </h1>
          <p className="hero-desc">
            Five jobs. Five CCTV tapes. One image editor and a ticking clock. Scrub the crew out of
            every frame before VCPD forensics runs, and let Rico take the fall.
          </p>
          <div className="hero-actions">
            <input
              aria-label="Your fixer alias"
              value={alias}
              maxLength={18}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Your fixer alias"
            />
            <button className="pill solid" onClick={onStart} disabled={!ready}>
              {ready ? 'Play now' : 'Loading tapes…'}
            </button>
            <a className="pill ghost" href="#how">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              How to play
            </a>
          </div>
          <div className="tools-row">
            <span className="tools-label">Powered by React Image Editor</span>
            {Object.entries(TOOL_ICONS).map(([name, d]) => (
              <svg key={name} viewBox="0 0 24 24" aria-label={name} role="img">
                <title>{name}</title>
                <path d={d} />
              </svg>
            ))}
          </div>
          <div className="carousel-dots" role="tablist" aria-label="Featured character">
            {CAST.map((c, i) => (
              <button
                key={c.key}
                role="tab"
                aria-selected={i === spot}
                aria-label={c.name}
                className={i === spot ? 'on' : ''}
                onClick={() => setSpot(i)}
              />
            ))}
          </div>
        </div>

        <div className="cast">
          {art && CAST.map((c, i) => (
            <button
              key={c.key}
              className={`figure ${c.key} ${i === spot ? 'spot' : ''}`}
              style={{ '--d': `${0.15 + i * 0.18}s` }}
              onClick={() => setSpot(i)}
              aria-label={`Feature ${c.name}`}
            >
              <span className="bob">
                <img src={art[c.key].open} alt="" draggable="false" />
                <img className="shut" src={art[c.key].shut} alt="" draggable="false" />
              </span>
            </button>
          ))}
          <div className="bio" key={featured.key}>
            <span className="bio-role">{featured.role}</span>
            <strong>{featured.name}</strong>
            <p>{featured.bio}</p>
          </div>
        </div>
      </section>

      <section id="how" className="home-how">
        <h2>How a job goes down</h2>
        <ol>
          <li>
            <b>01</b>
            <h3>Read the tape</h3>
            <p>Every CCTV still marks what to <em className="hide">hide</em> (faces, plates, cash) and what to <em className="keep">keep</em> (the timestamp, and Rico).</p>
          </li>
          <li>
            <b>02</b>
            <h3>Doctor it</h3>
            <p>Draw, drop shapes and stickers, add text or crop in the React Image Editor before the clock hits zero.</p>
          </li>
          <li>
            <b>03</b>
            <h3>Beat forensics</h3>
            <p>The VCPD compares your edit with the original tape. Anything left visible adds a wanted star. Five and you're busted.</p>
          </li>
        </ol>
      </section>

      <section id="cases" className="home-cases">
        <h2>Case files</h2>
        <div className="case-strip">
          {CASES.map((c, i) => (
            <figure key={c.id} style={{ '--d': `${i * 0.08}s` }}>
              {scenes?.[i] ? <img src={scenes[i].dataUrl} alt={`${c.title} CCTV still`} /> : <div className="ph" />}
              <figcaption>
                <span>Case {i + 1}</span>
                {c.title}
              </figcaption>
            </figure>
          ))}
        </div>
        <button className="pill solid big" onClick={onStart} disabled={!ready}>Open the evidence locker</button>
      </section>
    </div>
  );
}
