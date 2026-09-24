<p align="center">
  <img src="public/social-card.jpg" alt="Leonida Evidence Room: the illustrated Leonida crew on a pastel waterfront at dusk" width="100%">
</p>

<h1 align="center">Leonida Evidence Room</h1>

<p align="center">
  <strong>They did the crime. You fix the picture.</strong><br>
  A GTA VI-inspired evidence-doctoring game built on Unlayer's React Image Editor.
</p>

<p align="center">
  <a href="https://github.com/unlayer/react-image-editor"><img src="https://img.shields.io/badge/Unlayer-React%20Image%20Editor-FF4FD8" alt="Built on Unlayer's React Image Editor"></a>
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/Node-%E2%89%A5%2022.12-339933?logo=nodedotjs&logoColor=white" alt="Node 22.12 or newer">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-FFD23F" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/%23BuiltWithImageEditor-FF8A3D" alt="#BuiltWithImageEditor">
</p>

<p align="center">
  <a href="https://leonida-evidence.vercel.app"><b>▶ Play it live</b></a> ·
  <a href="#how-to-play">How to play</a> ·
  <a href="#the-five-jobs">The five jobs</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#run-it-locally">Run it locally</a> ·
  <a href="#credits-and-licenses">Credits</a>
</p>

Lucia and Jason pulled five jobs across Leonida, and the VCPD has every one on tape. You're the crew's fixer: you get a photo lab, [Unlayer's image editor](https://unlayer.com/image-editor) and a countdown to doctor each CCTV still before forensics runs. Made for the **Build with React Image Editor Challenge**.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/briefing.webp" alt="Case briefing for the Kwik Mart Stick-Up, with Jason's face marked HIDE and the timestamp marked KEEP"><p align="center"><sub><b>Briefing.</b> Each tape marks what to hide and what to keep.</sub></p></td>
    <td width="50%"><img src="docs/screenshots/photo-lab.webp" alt="The photo lab: Unlayer's editor with the Draw tool open and Jason's face painted over"><p align="center"><sub><b>Photo lab.</b> Doctor the still in Unlayer's editor before time runs out.</sub></p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/verdict.webp" alt="Forensics verdict: CASE DISMISSED, with the face box marked CLEAN and the timestamp INTACT"><p align="center"><sub><b>Forensics.</b> Every evidence box comes back CLEAN, MATCH, INTACT or TAMPERED.</sub></p></td>
    <td width="50%"><img src="docs/screenshots/busted.webp" alt="A greyed-out marina tape with a red BUSTED stamp across it"><p align="center"><sub><b>Busted.</b> Five wanted stars and the VCPD catches up.</sub></p></td>
  </tr>
</table>

## Highlights

- **The editor is the game.** Draw, shapes, stickers, text, crop, filters and, where the Unlayer project allows it, the AI Assistant are all tools for making evidence disappear.
- **Five live CCTV tapes.** Each job plays as a short animated clip in an illustrated Leonida location. Freeze the moment you want to doctor: evidence behind a passing truck, bus or pillar needs no edit, but the clock is already running.
- **Faces, plates, a tattoo and a bag of cash to hide**, a timestamp you must not touch, Rico to frame and a tourist to leave alone.
- **Pixel forensics** that line up crops, forgive colour grades and catch whatever is still visible.
- **Heat pressure and surprises.** Wanted stars bring sirens, camera shake and jammed tools on the next tape, and detectives spot new evidence while you edit.
- **Payouts, ranks and a global leaderboard**, ending in a rap-sheet poster you can download and share. Finished runs post their cash and time; most cash wins and faster hands break ties.
- **Sound, motion and responsive layouts** from phone to widescreen, with a mute button and reduced-motion support.

## How to play

1. **Roll the tape.** Each job's CCTV clip plays live and marks the evidence you have to **HIDE** (faces, plates, a tattoo, a bag of cash) and what you must **KEEP** (the timestamp, Rico when you're framing him, an innocent tourist). The job clock starts when the tape rolls.
2. **Freeze the frame** with the button or <kbd>Space</kbd>. Evidence that's out of sight at that moment needs no edit, but a KEEP that has to be in the shot, like Rico, must be.
3. **Doctor the still.** Draw over faces, drop shapes or stickers, add text, or crop the evidence out. Filters are allowed, but a global blur also wipes out the timestamp. A few seconds in, detectives may **ENHANCE** and spot something new to hide, with a little extra time.
4. **Send it to evidence** before the clock runs out. At zero, whatever is on the canvas goes in as it is.
5. **Face forensics.** Every piece of evidence left visible, every tampered KEEP and every must-show KEEP missing from the shot adds a wanted star. Heat carries into the next tape: one star brings sirens, two add camera shake, three jam the stickers and four the shapes. Five stars and you're **BUSTED**. After the scan, drag across the tape to compare the original with your edit.
6. **Collect your rap sheet.** Finish all five jobs, get caught, or walk away with **Quit**, for a poster of your doctored stills, heat and cash. Runs that finish all five jobs can be posted to the leaderboard.

> [!TIP]
> Need more room to paint? Choose your brush, then **Hide tool settings**: drawing stays active. **Hide orders** frees the sidebar, and **Full screen** expands the workspace without losing your edits. The clock keeps running while you rearrange.

## The five jobs

| # | Job | Location | Clock | Max payout | Hide | Keep |
|:-:|---|---|:-:|--:|---|---|
| 1 | Kwik Mart Stick-Up | Vice Beach | 90 s | $12,000 | Jason's face, getaway car plate | CCTV timestamp |
| 2 | Causeway Getaway | Leonida Causeway | 80 s | $18,000 | License plate, Lucia's face | CCTV timestamp |
| 3 | Bank of Leonida | Downtown Vice City | 75 s | $30,000 | Jason's face, Lucia's L+J tattoo | Rico's face (must be in the shot), CCTV timestamp |
| 4 | Keys Marina Drop | Leonida Keys | 70 s | $42,000 | Duffel bag of cash, boat registration | Rico's boat name (must be in the shot), drone timestamp |
| 5 | Diamond Mile | Vice City Strip | 65 s | $75,000 | Jason's face, Lucia's face, license plate | Rico's face (must be in the shot), the tourist's face, CCTV timestamp |

The clocks shrink as the jobs get bigger, and the tape's running time counts against them. Each tape also hides one piece of evidence that detectives spot mid-edit, such as Jason on the store's security monitor or his dropped ID card.

### Scoring

| Ledger line | How it's earned |
|---|---|
| **Job payout** | The job's payout, times the share of HIDE targets you scrubbed |
| **Time bonus** | $40 for every second left on the clock, times the same share |
| **Clean edit** | 25% of the payout, times how much of the rest of the frame you left untouched. Only paid with zero heat |
| **Heat** | One wanted star for each piece of visible evidence, tampered KEEP region or must-show KEEP missing from the shot |

Evidence that's out of sight at the frozen moment isn't judged, and a frame with nothing left to hide pays the full job payout.

Your rank on the rap sheet: **Ghost of Leonida** (no stars), **Vice City Fixer** (one or two), **Sloppy Accomplice** (three or four), **Guest of the State** (busted) or **Walked Away** (quit).

<p align="center">
  <img src="docs/screenshots/rap-sheet.webp" alt="The rap sheet screen: Guest of the State, with a BUSTED poster of four doctored tapes and $18,460" width="720">
</p>

## How it works

```mermaid
flowchart LR
  start([Title and alias]) --> brief[Live tape<br/>roll + freeze]
  brief --> lab[Photo lab<br/>editor + countdown]
  lab -->|Send to evidence<br/>or time up| scan[Forensics scan]
  scan --> verdict{Verdict}
  verdict -->|next job| brief
  verdict -->|five stars| busted[BUSTED]
  verdict -->|all five jobs done| sheet[Rap sheet poster]
  busted --> sheet
  brief -.->|Quit| sheet
  sheet -->|Run it back| brief

  classDef step fill:#22143a,stroke:#8e75d7,color:#f6ecff
  classDef editor fill:#22143a,stroke:#ff4fd8,stroke-width:2px,color:#f6ecff
  classDef check fill:#22143a,stroke:#29e7ff,stroke-width:2px,color:#f6ecff
  classDef bad fill:#ff3b5c,stroke:#ff3b5c,color:#ffffff
  classDef win fill:#ffd23f,stroke:#ff8a3d,color:#1a0830
  class start,brief step
  class lab editor
  class scan,verdict check
  class busted bad
  class sheet win
```

### The image editor

The editor is the core mechanic, not decoration:

| Editor API | What the game does with it |
|---|---|
| `<ImageEditor image>` | Loads the frame you froze from the live tape as a data URL. |
| `options.features.imageEditor.tools` | Turns off Resize and Frame, so exports stay comparable with the original tape. Under heat pressure it also jams Stickers (three stars) and Shapes (four). |
| `options.projectId` and `features.ai` | Enables Unlayer's AI Assistant for projects entitled to it. |
| `editor.getImage()` | Exports the doctored still when you send it to evidence or the clock hits zero. Any open tool panel is closed first, because filter and crop changes only commit when their panel closes. |
| `onSave` and `onCancel` | The editor's own Save and Cancel buttons are hidden during a case, so **Send to evidence** is the only way to hand in a tape. Both callbacks stay wired as a fallback: Save submits, and Cancel resets the tape through `editor.reset()`. |

### Forensics engine

[`src/forensics.js`](src/forensics.js) scores the doctored still against the original tape in three steps:

1. **Alignment.** A coarse-to-fine search finds where a cropped export sits inside the original frame.
2. **Colour fit.** A robust least-squares colour transform means brightness, contrast or sepia filters alone don't count as tampering.
3. **Cell inspection.** Each evidence box is split into 8×8 cells. A cell counts as hidden if it was painted over, covered, cropped away, or lost more than half of its detail to blur. Only cells that carry detail are judged.

The verdict screen then replays the check box by box, and a scrubbed face comes back **CLEAN** while a visible one is a **MATCH**.

### Scenes and art

Each tape is a 12-second animated clip drawn by [`src/scenes.js`](src/scenes.js). Jason walks out of the Kwik Mart past a canopy pillar, a box truck blots out the causeway, Rico walks into the bank late while a guard crosses the lobby, his yacht cruises into the marina as a jet ski passes our hull, and the crew run for the car on the Diamond Mile as a bus sweeps the street in the rain. Every frame returns exact evidence bounds and what was drawn in front of them, so the game can tell which evidence is in the shot at the moment you freeze.

The backgrounds, vehicles, props and bystanders were generated for this project with OpenAI's image generation through Codex, using the crew illustrations as the style reference ([prompts](artwork/CODEX-SCENES.md)). `node scripts/import-art.mjs` crops, keys and trims them into `public/art/scenes/` and measures the placeholder on each car and boat where the game paints plates and lettering. The crew illustrations come from [`artwork/`](artwork/ARTWORK.md) through `node scripts/optimize-art.mjs`, and [`src/avatars.js`](src/avatars.js) maps each face and Lucia's tattoo into scene coordinates. The homepage's "Powered by Unlayer" badge and footer credit use Unlayer's official white wordmark, resized to `public/brand/unlayer-logo-white.webp`.

### Leaderboard

[`api/leaderboard.js`](api/leaderboard.js) is a Vercel function backed by an Upstash Redis database linked to the Vercel project. It accepts only runs that finished all five jobs and checks every job against its clock and payout limits, so impossible scores are refused. A score is stored as one number in a sorted set: cash first, then seconds saved, and the earlier run wins a tie. Each address can post 20 runs every ten minutes, and the top ten are cached at the edge for ten seconds. The rules live in [`api/_leaderboard.js`](api/_leaderboard.js); `npm run dev` and `npm run preview` answer the same API from memory, so the board works locally with no database.

### Sound

[`src/sound.js`](src/sound.js) plays seven effects from Kenney's CC0 packs:

- a shutter when a tape goes to evidence
- a tick through the last ten seconds
- a blip for each evidence box as forensics checks it
- a stamp, or a jail-door clang, when the verdict lands
- coins on the payout

The files are WAV because Safari can't decode OGG. Under heat pressure a police siren, synthesized in code, wails as the lab opens. The **Sound** button on the tape, lab and verdict screens mutes everything and remembers the choice.

### Project structure

```text
src/
├── App.jsx        Screen flow, live tape, photo lab, verdict, rap sheet and scoring
├── Home.jsx       Animated landing page, leaderboard and alias form
├── scenes.js      The five animated CCTV tapes and their evidence targets
├── art-manifest.js      Sprite sizes and placeholders, written by import-art.mjs
├── leaderboard.js       Leaderboard client; LeaderboardTable.jsx draws the table
├── avatars.js     Sprite atlas mapping for faces and the tattoo
├── forensics.js   Compares the doctored still with the original tape
├── rapsheet.js    Draws the shareable end-of-run poster
└── sound.js       Sound effects and the mute setting
api/               Leaderboard function, its rules and the in-memory stand-in
public/            Art, fonts, sounds, icons, social card and credits
artwork/           Source illustrations and their generation prompts
docs/screenshots/  Images used in this README
scripts/           Playwright test suites and asset scripts
```

## Run it locally

You need Node 24 LTS (22.12 or newer) and an internet connection, because the image editor loads from Unlayer's CDN.

```sh
npm ci
npm run dev
```

## Deploy

This is a static Vite app plus one Vercel function for the leaderboard. Run `npm ci`, then `npm run check`; Vercel builds `dist/` and deploys `api/` alongside it. Connect an Upstash Redis database to the Vercel project (Storage, or `vercel integration add upstash/upstash-kv`), which sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, then redeploy. Without it the game still works and the board says it isn't set up. `netlify.toml` still serves the game on Netlify, without the leaderboard. Both configs cache the fingerprinted files in `/assets/` for a year, and every build writes `third-party-licenses.txt` with the license of each bundled library.

> [!IMPORTANT]
> The public Unlayer project ID is set in `src/App.jsx`. Check the project's domain restrictions and AI entitlement in your Unlayer account for the final hostname. Drawing, crop, shapes, text and scoring work without AI, and no API secret belongs in the browser bundle.

Link previews show `public/social-card.jpg` and need its absolute URL. Netlify and Vercel builds pick up the production address automatically. On any other host, set `SITE_URL` when building, for example `SITE_URL=https://example.com npm run build`. After changing the favicon or the hero, start the dev server and run `node scripts/brand-assets.mjs` to regenerate the social card and `public/apple-touch-icon.png`.

## Tests

Run `npm run check` (lint and build), then start `npm run preview -- --host 127.0.0.1 --port 5201` for the production suites. For the last three suites, start `npm run dev -- --host 127.0.0.1 --port 5200` instead.

| Command | Server | What it covers |
|---|---|---|
| `npm run test:release` | Preview, port 5201 | The production build with a deterministic editor double: five clean jobs, poster download, a leaderboard post, replay, recovery from loading, export and analysis failures, mobile layout, out-of-sight evidence, the mid-edit surprise, quitting, the board offline, countdown expiry, heat carrying over, sound files and the mute setting |
| `npm run test:leaderboard` | None | Leaderboard rules and handler: impossible runs refused, ranking, names, rate limit and error responses |
| `node scripts/release-live.mjs` | Preview, port 5201 | The real hosted editor: three jobs to a bust, the BUSTED stamp, poster download and the mobile editor. Needs network access |
| `npm run test:workspace` | Preview, port 5201 | The live editor at three widths: collapsed tool settings, drawing, full screen, tall panels and filters that are still open when you submit |
| `npm run test:home` | Dev, port 5200 | The landing page at four widths and with reduced motion, plus the `/#play` deep link |
| `npm run test:responsive` | Dev, port 5200 | Every screen, played through to a bust, on phones in both orientations, a tablet and a desktop: no sideways overflow, no covered controls, 44px touch targets, no text under 9px, and the hero's call to action on the first screen |
| `npm run test:avatars` | Dev, port 5200 | Scene art and forensic scoring for all five jobs, plus the live tape's out-of-sight and must-show rules |

Set `HOME_TEST_URL` to point a suite at another server, and `BROWSER_CHANNEL=chrome` to test in Chrome instead of Microsoft Edge.

> [!NOTE]
> Before sharing a deployed link, run the live suite with `HOME_TEST_URL` set to that link, then check the first edit, submission, poster download and, if enabled, the AI tools on that domain. `lab.html`, the source PNGs, test screenshots and reference videos are not part of the build.

## Credits and licenses

The game's source code is released under the [MIT License](LICENSE). Third-party work keeps its own license; [CREDITS.md](CREDITS.md) lists every library, font and sound, and the deployed site serves the same list at `/credits.txt`.

| Asset | By | License |
|---|---|---|
| Image editor and React wrapper | [Unlayer](https://unlayer.com) | Unlayer's terms; wrapper under MIT |
| React and React DOM | Meta | MIT |
| Slackey | Sideshow | Apache 2.0 |
| Anton, IBM Plex Mono and Montserrat | Vernon Adams; IBM; Julieta Ulanovsky and contributors | SIL Open Font License 1.1 |
| Sound effects | [Kenney](https://kenney.nl) | CC0 1.0 |

> [!NOTE]
> Leonida Evidence Room is an unofficial fan project. Grand Theft Auto and Rockstar Games are trademarks of Take-Two Interactive Software, Inc., and this project is not affiliated with or endorsed by Rockstar Games or Take-Two. The Unlayer name and logo belong to Unlayer and appear only to credit the editor.

<p align="center"><sub>Made by timidanx for the Build with React Image Editor Challenge · #BuiltWithImageEditor</sub></p>
