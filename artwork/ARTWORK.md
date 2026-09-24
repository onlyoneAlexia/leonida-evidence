# Artwork

The Leonida crew illustrations were generated for this project with an AI image model, working from four character references supplied by the author. This folder keeps the full-resolution sources and the exact prompts behind them, so every image the game ships can be traced and regenerated.

## Files

| File | What it is | Status |
|---|---|---|
| [`source/leonida-crew-v2.png`](source/leonida-crew-v2.png) | Waterfront hero with the v2 outfits | Shipped as `public/art/leonida-crew-v2.webp` |
| [`source/evidence-studio-v2.png`](source/evidence-studio-v2.png) | Evidence studio with the v2 outfits | Shipped as `public/art/evidence-studio-v2.webp` |
| [`source/crew-sprites-v2.png`](source/crew-sprites-v2.png) | Four-character sprite atlas for the CCTV scenes | Shipped as `public/art/crew-sprites-v2.webp` |
| [`archive/leonida-crew.png`](archive/leonida-crew.png) | Original waterfront hero | Archived |
| [`archive/leonida-crew-mobile.png`](archive/leonida-crew-mobile.png) | Portrait version of the original hero | Archived |
| [`archive/evidence-studio.png`](archive/evidence-studio.png) | Original evidence studio | Archived |

The CCTV backgrounds, vehicles, props and bystanders are covered separately in [CODEX-SCENES.md](CODEX-SCENES.md).

`node scripts/optimize-art.mjs` converts the three v2 sources into the WebP files in `public/art/`. [OUTFITS-V2.md](OUTFITS-V2.md) covers the current outfits and their prompts; the prompts for the original illustrations are below.

## Original prompts

### Waterfront hero

`archive/leonida-crew.png`, made from the four character references.

<details>
<summary>Show prompt</summary>

Create a polished illustrated website hero BACKGROUND for LEONIDA EVIDENCE ROOM, a GTA-inspired photo evidence game. Use the four attached images as CHARACTER AND ART STYLE REFERENCES, not as edit targets. Landscape 16:9, high resolution. Reference 1: angular faceted auburn bob-haired adult woman, green eyes, freckles, olive streetwear. Reference 2: confident adult woman with warm brown skin, long straight black hair, grey bandana, hoop earrings, oversized white cropped tee and baggy white pants. Reference 3: curly-haired masked adult with dark tactical streetwear and restrained orange piping. Reference 4: adult with lime beanie, transparent glasses, earrings, neon lime sweater. Translate all four into ONE cohesive high-end stylized 2D/2.5D editorial game illustration with angular painterly shapes, bold contours, oversized expressive faces, deliberate textured brushwork. NOT photorealistic. GTA loading-screen energy plus the colourful illustrative personality of these references. COMPOSITION CRITICAL: create a sprawling Miami/Leonida canal-side getaway at violet dusk, pink and periwinkle sky, mint turquoise water, distant art deco city, palms, vintage coral sports car at lower left, police helicopter small distant upper right, cassette evidence envelopes near foreground. Characters at far left and far right, grouped in pairs, all faces clearly seen, naturally integrated: redhead left foreground and lime beanie person left behind; bandana woman right foreground and masked curly character right behind. Character heads around 30% image height, bodies extending to bottom, clear head margins. Centre 45% of image mostly empty expansive sky down to 65% height for LARGE centered HTML logo and play button; do not put characters, props, or visually busy skyline in this central region. Colourful sunny stylized shapes and saturated lilac pink blue coral mint, no moody black shadows. Full bleed illustration only. No text, no letters, no logos, no watermark, no white border, no UI. Keep the characters' facial and outfit cues recognizably close to the attached references.

</details>

### Evidence studio

`archive/evidence-studio.png`, made with the waterfront hero as its character and colour reference.

<details>
<summary>Show prompt</summary>

Create a companion background illustration for a stylized GTA-inspired photo-evidence game website. Use the attached generated crew image as the exact CHARACTER and COLOUR STYLE reference. Landscape 16:9. A colourful clandestine photo-editing evidence lab in a Miami art-deco apartment at dusk. Angular painterly 2D/2.5D cartoon illustration, vivid periwinkle purple, lilac, dusty pink, mint and cream. LEFT EDGE: the same auburn bob-haired freckled adult woman in olive streetwear, sitting on a stool seen three-quarter view, holding an evidence photo, looking toward centre. RIGHT EDGE: the same brown-skinned adult woman with long black hair, grey bandana, hoop earrings and oversized white tee, seated leaning on workbench, looking toward centre. Upper left shelves CCTV tapes, hanging film strips and photographic contact sheets; upper right arched window showing pink sky, palm trees and faraway skyline, plant on windowsill. BOTTOM: long lavender desk across width, keyboard, graphics tablet, cassette deck, tiny desk lamp. CRITICAL MIDDLE REGION: leave central 55 percent width largely unobstructed lavender wall from top down to 78% height, intentionally subtle grid light on wall, softly lit pink; leave empty desk surface in centre lower area where a real HTML monitor will be overlaid by developer. NO MONITOR anywhere, no screen, no TV, no central people, no text or logos or signatures or UI. Keep characters on extreme left/right in outer 22 percent of composition so they do not interfere with a central monitor. This should feel playful, detailed and richly illustrated like a premium colourful video-game microsite, not realistic, not dark. All characters clearly adults.

</details>

### Mobile waterfront

`archive/leonida-crew-mobile.png`, a portrait adaptation of the waterfront hero. The game now uses the landscape hero on every device.

<details>
<summary>Show prompt</summary>

Create a PORTRAIT 9:16 mobile website background adapting the attached landscape illustration. Preserve exactly the same four recognizable stylized adult streetwear characters and consistent angular painterly 2D/2.5D illustration style, not realism. Same lilac/periwinkle/pink sky, turquoise Miami canal, pastel Art Deco buildings, palms, coral sports car, small distant helicopter. CRITICAL MOBILE COMPOSITION: Upper 48% mostly open periwinkle sunset sky with palms at very extreme top corners, intended for a large HTML title and button. Lower half has four waist-up characters arranged in a compact balanced group: auburn bob-haired freckled woman in olive top at left front, brown-skinned woman in grey bandana white tee at right front, lime-beanie clear-glasses character behind left, curly-haired masked black-and-orange character behind right. All four faces fully visible between 52% and 72% of image height. Faces must not overlap one another, must fit inside frame, and must not extend into upper 45% reserved title area. Car partially visible at very bottom. This is a responsive companion illustration for the same website. Full bleed. No text, logo, watermark, border, or UI. Make the character faces recognizably consistent with supplied image.

</details>
