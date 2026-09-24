# Credits and licenses

Leonida Evidence Room's source code is released under the [MIT License](LICENSE). The libraries, fonts, sounds and trademarks below belong to their owners and keep their own licenses. The deployed game serves the same list at `/credits.txt`, with the full license texts beside it.

## Image editor and libraries

| Component | Author | License | In the game |
|---|---|---|---|
| [Unlayer Image Editor](https://unlayer.com/image-editor) | Unlayer | Unlayer's terms of service | Loaded at runtime from Unlayer's CDN; not bundled or redistributed |
| [@unlayer/react-image-editor](https://github.com/unlayer/react-image-editor) 1.0.2 | Unlayer | MIT | Bundled |
| [React](https://react.dev) and React DOM 19.3.0 | Meta Platforms, Inc. and affiliates | MIT | Bundled |
| Scheduler 0.28.0, a React dependency | Meta Platforms, Inc. and affiliates | MIT | Bundled |

Every build writes the full license text of each bundled library to `dist/third-party-licenses.txt` through Vite's `build.license` option, so the notices stay current when dependencies change.

Development tools don't ship with the game: Vite, @vitejs/plugin-react and oxlint are MIT-licensed, and Playwright is Apache 2.0.

## Fonts

| Font | Designer | License | Use |
|---|---|---|---|
| [Slackey](https://fonts.google.com/specimen/Slackey) | Sideshow (Font Diner, Inc.) | Apache 2.0 | Landing-page title. Self-hosted, with its license in [`public/fonts/Slackey-LICENSE.txt`](public/fonts/Slackey-LICENSE.txt) |
| [Anton](https://fonts.google.com/specimen/Anton) | Vernon Adams | SIL Open Font License 1.1 | Headings, timer and poster. Served by Google Fonts |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | IBM | SIL Open Font License 1.1 | CCTV overlays, labels and ledgers. Served by Google Fonts |
| [Montserrat](https://fonts.google.com/specimen/Montserrat) | Julieta Ulanovsky and contributors | SIL Open Font License 1.1 | Body text. Served by Google Fonts |
| [Jersey 10](https://fonts.google.com/specimen/Jersey+10) | The Soft Type Project Authors | SIL Open Font License 1.1 | Shipped in `public/fonts/` with [its license](public/fonts/Jersey10-OFL.txt), but not currently used |

## Sound effects

All seven sounds are by [Kenney](https://kenney.nl), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Credit isn't required, but it's given gladly. Each was converted from the original OGG to a trimmed mono WAV, because Safari can't decode OGG.

| File | When it plays | Kenney pack | Original file |
|---|---|---|---|
| `shutter.wav` | A tape goes to evidence | RPG Audio | `metalLatch.ogg` |
| `tick.wav` | Each of the last ten seconds | Interface Sounds | `tick_002.ogg` |
| `clear.wav` | Forensics clears an evidence box | Interface Sounds | `select_003.ogg` |
| `alert.wav` | Forensics finds a match or tampering | Interface Sounds | `error_004.ogg` |
| `stamp.wav` | The verdict lands | Impact Sounds | `impactWood_heavy_000.ogg` |
| `busted.wav` | The VCPD catches up | Impact Sounds and Digital Audio | `impactMetal_heavy_001.ogg` mixed with `lowDown.ogg` |
| `cash.wav` | A case pays out | RPG Audio | `handleCoins.ogg` |

The police siren under heat pressure is synthesized in code by `siren()` in [`src/sound.js`](src/sound.js), so it has no file.

## Artwork

- **Illustrations.** The crew hero, the evidence studio and the character sprite atlas were generated for this project with an AI image model, from character references supplied by the author. Sources and prompts are in [`artwork/`](artwork/ARTWORK.md).
- **CCTV scenes.** The five backgrounds, the vehicles, the duffel bag, the boats, the bystanders and the foreground props were generated for this project with OpenAI's image generation, run through Codex, using the crew illustrations as the style reference. Originals and prompts are in [`artwork/CODEX-SCENES.md`](artwork/CODEX-SCENES.md). [`src/scenes.js`](src/scenes.js) animates them and draws the plates, hull lettering, signs and small evidence in code.
- **Icons and link preview.** The favicon and home-screen icon were drawn for this project. The link-preview card is a render of the hero, made by [`scripts/brand-assets.mjs`](scripts/brand-assets.mjs).

## Trademarks

- The Unlayer name and logo are trademarks of Unlayer. The white wordmark in [`public/brand/`](public/brand) appears only to credit the editor the game is built on.
- Grand Theft Auto, Rockstar Games and related names and marks are the property of Take-Two Interactive Software, Inc. Leonida Evidence Room is an unofficial fan project and is not affiliated with or endorsed by Rockstar Games or Take-Two.
