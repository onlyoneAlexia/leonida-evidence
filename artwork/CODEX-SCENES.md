# Codex scene art

The five CCTV backgrounds, the vehicles, the duffel bag, the boats, the bystanders and the foreground props were generated for this project with OpenAI's image generation, run through Codex (`codex exec`, image generation feature). The crew illustrations in [`source/`](source/) were attached as the style reference, and the sprite atlas as the reference for the bystanders. The originals are in [`source/codex/`](source/codex/).

`node scripts/import-art.mjs` turns them into the game files: backgrounds cropped to the middle 16:9 band at 1280x720, green-screen sprites keyed, every sprite trimmed and sized, and the flat magenta placeholder on each car and boat measured. It writes `public/art/scenes/*.webp` and `src/art-manifest.js`, and the game paints plates, hull lettering, signs and small evidence into those spaces in code, so forensics always knows exactly where they are.

## Prompts

Every job started with the shared instructions, followed by its own brief.

### Shared instructions

```text
You are generating game art for "Leonida Evidence Room", a GTA VI-inspired browser game. Use your built-in image generation tool.

STYLE (match the attached style-reference.png exactly): painterly, angular 2D/2.5D cartoon illustration like modern GTA loading-screen art; saturated Vice City palette (sunset pinks, purples, teals, oranges); clean confident brushwork; readable silhouettes. No photorealism, no 3D render look. Absolutely NO real brand logos, NO Rockstar/GTA logos, NO watermarks, NO signatures, and NO text anywhere unless a prompt below explicitly asks for it.

RULES FOR THIS JOB
- Only generate images and save them into the current working directory with the exact file names given. Do not edit, create or delete any other files, and do not write code.
- After each image is generated, copy it from where your image tool saved it into the current working directory under the exact name (PNG).
- If an image comes out wrong (text appears, people appear where none are wanted, wrong framing, placeholder missing), regenerate it once with a corrected prompt.
- When finished, reply with a short list: file name, pixel size, and whether the background is truly transparent.
```

### Backgrounds

```text
JOB: five empty CCTV location backgrounds. Landscape 1536x1024 each. The game crops the middle 16:9 band (drop roughly the top and bottom 80 px), so keep everything important between 8% and 92% of the height.
All five: a fixed security-camera viewpoint (slightly high, looking down a little), NO people, NO vehicles, NO animals, and NO text or numbers of any kind. Any sign or banner must be a clean blank panel (the game paints its own lettering). Keep the bottom-left corner (left 35%, bottom 12%) calm and dark-ish, because the game burns a timestamp box there, and the top-left corner calm for a camera label.

1) bg-kwik.png - Night gas station on Ocean Drive, Vice Beach. Left half: a gas-station canopy (white with a red stripe) on thin posts over two pumps. Right half: a convenience store facade with a big glass window showing colourful snack shelves and a BLANK rectangular sign band across the top of the store where neon lettering will go. Palm trees and a purple-pink night sky with city lights behind. Asphalt forecourt with parking lines filling the lower 36% of the frame, left open for a parked car at centre-left and a person walking across.

2) bg-causeway.png - Toll camera on the Leonida Causeway at sunset. A multi-lane road runs across the lower 30% of the frame (seen slightly from above, lanes running left to right), a concrete barrier/railing behind it, then shimmering bay water and a pink-orange sunset with the Vice City skyline in the distance. Top-left: a big BLANK green highway sign on a pole. Leave the near lane open for a car and a truck.

3) bg-bank.png - Bank of Leonida lobby, daytime. Cream marble walls with fluted columns, a long polished wooden teller counter crossing the frame at mid-height (about 53%-68% of the height) with glass teller windows above it, a BLANK dark-green banner panel high up at the centre where lettering goes, and a black-and-white checkered marble floor in the lower third. Leave floor space in front of the counter for three people standing.

4) bg-marina.png - Harbor patrol drone photo over the Leonida Keys marina, midday. Bright sky with a few clouds in the top 40%, turquoise water in the middle, a wooden dock running along the bottom 18% of the frame, palm trees at the right edge. Leave open water at left-centre for a speedboat and at right-centre for a yacht, and open dock planks at centre-right for a bag.

5) bg-jewelry.png - Street camera on the Diamond Mile, Vice City Strip, 4 a.m. A luxury jewelry storefront across the left 60% with a SMASHED display window (shattered glass, empty velvet displays, a few glittering gems) and a BLANK sign band above it where neon lettering goes. Magenta-purple night sky and towers above, a sidewalk and a wet street in the lower 25% reflecting neon. Leave the street open for a car at the right and people running across.
```

### Props

```text
JOB: six cut-out prop sprites. Each on a TRUE TRANSPARENT background (PNG alpha). If you cannot produce transparency, use a perfectly flat pure #00FF00 green background with no shadow or gradient on it. Object centred, whole object in frame with generous margin, no people, no text, no numbers.

PLACEHOLDERS: some props need a flat, solid, pure magenta #FF00FF rectangle (no gradient, no texture, no text, crisp edges) exactly where the game will paint a plate or name. Nothing else in the image may be magenta.

1) car-purple-rear.png - 1536x1024. Purple 1980s-style sports car seen from directly behind, slightly from above (security camera angle). Glowing red tail lights. On the rear panel, centred: the license plate area as a solid #FF00FF rectangle with a 2:1 width:height ratio.
2) car-orange-rear.png - 1536x1024. Orange muscle car, same rear view and angle, same centred #FF00FF 2:1 plate rectangle.
3) car-red-rear.png - 1536x1024. Red modern supercar, same rear view and angle, same centred #FF00FF 2:1 plate rectangle.
4) duffel-cash.png - 1024x1024. A black nylon duffel bag, unzipped and overflowing with bundles of green $100-style banknotes (no readable text), three-quarter view from above, resting on the ground.
5) speedboat.png - 1536x1024. White speedboat with a hot-pink stripe, side view seen slightly from above (drone angle), bow pointing right, sitting on water (no water in the image, just the boat). On the hull side, where a registration number goes: a solid #FF00FF rectangle about 5:1 width:height.
6) yacht-rival.png - 1536x1024. A sleek white-and-red motor yacht, side view seen slightly from above, bow pointing left. On the hull side where the boat's name goes: a solid #FF00FF rectangle about 6:1 width:height.
```

### Foreground sprites

```text
JOB: five foreground sprites that pass in front of the scene and can block the camera's view. Each on a TRUE TRANSPARENT background (PNG alpha). If you cannot produce transparency, use a perfectly flat pure #00FF00 green background with no shadow or gradient on it. Whole object in frame, no text, no numbers, no logos.

1) pillar-canopy.png - 1024x1536 (tall). A chunky white-and-red gas-station canopy support pillar with a small blank lit advertising panel, seen from close up so it is tall and wide. Straight vertical, full height from floor to the top edge.
2) truck-box.png - 1536x1024. A white box truck (delivery lorry) in pure side view, facing LEFT, slightly from above, with a plain blank white cargo box (no lettering).
3) column-marble.png - 1024x1536 (tall). A single fluted cream marble column with a base and capital, seen close up, straight vertical, filling the full height.
4) jetski.png - 1536x1024. A jet ski in side view facing RIGHT, seen slightly from above, with an adult rider in a life vest and sunglasses (generic person, not a celebrity), spray behind it.
5) bus-city.png - 1536x1024. A Vice City transit bus in pure side view facing RIGHT, slightly from above, pink-and-teal livery with no lettering, lit windows at night.
```

### Bystanders

```text
JOB: two full-body character sprites that must look like they belong in the attached crew sprite atlas (crew-reference.png): same illustration style, same line weight, same lighting, same proportions and head size, front-facing, standing relaxed, arms loosely at the sides, looking toward the camera, face fully visible, whole body from head to shoes with a small margin. Clearly ADULT characters. They are NOT any of the crew in the reference; they are new generic background people. No text, no logos.
Each on a TRUE TRANSPARENT background (PNG alpha). If you cannot produce transparency, use a perfectly flat pure #00FF00 green background with no shadow.

1) bystander-tourist.png - 1024x1536 (portrait). A sunburnt middle-aged tourist in a loud floral shirt, cargo shorts, socks with sandals, a camera on a strap around the neck, bucket hat.
2) guard-bank.png - 1024x1536 (portrait). A bank security guard in a navy uniform with a peaked cap, radio on the shoulder, clipboard in one hand.
```
