# Leonida Evidence Room

A GTA VI-inspired game built on [Unlayer's React Image Editor](https://github.com/unlayer/react-image-editor), made for the **Build with React Image Editor Challenge**. #BuiltWithImageEditor

Lucia and Jason pulled five jobs across Leonida, and the VCPD has the tapes. You're the crew's fixer. You get a photo lab, the image editor, and a countdown to doctor each CCTV still before forensics runs.

## How to play

1. **Read the briefing.** Every still marks the evidence you have to **HIDE** (faces, plates, a tattoo, a bag of cash) and what you must **KEEP** (the CCTV timestamp, and Rico's face when you're framing him).
2. **Doctor the still in the editor.** Draw over faces, drop shapes or stickers, add text, or crop the evidence out. Filters are allowed, but a global blur also wipes out the timestamp.
3. **Send it to evidence.** If the timer hits zero, whatever is on the canvas goes in as-is.
4. **Forensics runs.** Each piece of evidence that's still visible, and each tampered "keep" region, adds a wanted star. Five stars and you're **BUSTED**.
5. **Rap sheet.** At the end you get a poster of your doctored stills, heat and cash, which you can download or share.

## How the editor is used

The editor is the core mechanic, not decoration:

- `<ImageEditor>` loads each generated CCTV still (`image` prop, a data URL).
- `editor.getImage()` grabs the edited canvas when the player submits or when the timer runs out, and `onSave` submits too.
- `onCancel` resets the tape through `editor.reset()`.
- Resize and frame are disabled via `options.features.imageEditor.tools` so the output stays comparable with the original tape.

## Forensics engine (`src/forensics.js`)

The edited still is scored against the original in three steps:

1. **Alignment.** Coarse-to-fine search that finds where a cropped export sits inside the original frame.
2. **Colour fit.** A robust least-squares colour transform, so brightness, contrast or sepia filters alone don't count as tampering.
3. **Cell inspection.** Each evidence box is split into 8×8 cells. A cell counts as hidden if it was painted over, covered, cropped away, or lost more than half of its detail (blur). Only cells that carry detail are judged.

## Scenes (`src/scenes.js`)

All five stills are drawn procedurally on canvas (Vice Beach gas station, Leonida Causeway, Bank of Leonida, Keys marina, Diamond Mile), with a CCTV grain, scanline and timestamp overlay. No third-party game assets are used.

## Run locally

```sh
npm install
npm run dev
```

## Deploy

It's a static Vite app: `npm run build` outputs `dist/`. On Vercel or Netlify, import the repo and use the defaults (build `npm run build`, output `dist`).

Fan project, not affiliated with Rockstar Games.
