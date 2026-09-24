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

### Animation sheets and police vehicles

A second batch added walk, run and gesture cycles for the moving characters, plus the VCPD cruiser and helicopter. These jobs used the same shared instructions, then these sheet rules, then their own brief. The crew atlas ([`source/crew-sprites-v2.png`](source/crew-sprites-v2.png)) was attached as `crew-reference.png`, and `guard-bank.png` and `bystander-tourist.png` as `guard-reference.png` and `tourist-reference.png`; those two single sprites are no longer used in the game. Some sheets came back truly transparent instead of green; `node scripts/import-art.mjs` accepts either, splits each sheet into its figures, tracks the head from frame to frame and redraws the frames as one even strip with the head centred and the feet on one baseline.

```text
SPRITE SHEET RULES (apply to every sheet below unless it says otherwise)
- Canvas 1536x1024 split into an invisible grid of 2 rows x 4 columns: 8 equal cells of 384x512. Frames read left-to-right, top row first, and form ONE seamless looping cycle (frame 8 flows back into frame 1).
- The character is in pure SIDE VIEW facing RIGHT, full body from head to shoes, the SAME size in every cell, feet on the same baseline about 20 px above the bottom of each cell, head about 20 px below the top. Keep the whole figure inside its own cell; nothing crosses into a neighbouring cell.
- The character must look exactly like the reference: same face, hair, outfit, colours, proportions and illustration style. Clearly an adult.
- Flat pure #00FF00 green background everywhere (no shadow, no floor, no gradient, no grid lines, no borders, no text, no frame numbers).
```

```text
JOB: three WALK-cycle sprite sheets matching the attached crew-reference.png (a 4-column atlas: fixer, Jason, Lucia, Rico, left to right).
A natural walk: alternating legs with a clear contact, passing and lift pose, opposite arms swinging, a slight up-and-down head bob.
1) jason-walk.png - Jason (second figure: lime beanie, clear glasses, teal short-sleeved overshirt, cream tee, black cargo pants, lime-and-cream sneakers, silver chain). A tense, hurried walk.
2) lucia-walk.png - Lucia (third figure: grey bandana, long straight black hair, hoop earrings, coral sleeveless jersey, dark indigo cargo jeans, white sneakers). A relaxed, confident walk.
3) rico-walk.png - Rico (fourth figure: curly hair, his exact outfit from the reference). A swaggering, unhurried walk.
```

```text
JOB: three sprite sheets matching the attached crew-reference.png (a 4-column atlas: fixer, Jason, Lucia, Rico, left to right).
1) jason-run.png - Jason (second figure: lime beanie, clear glasses, teal overshirt, cream tee, black cargo pants, lime-and-cream sneakers). A full-speed RUN cycle: forward lean, long strides with both feet off the ground in the flight frames, arms pumping.
2) lucia-run.png - Lucia (third figure: grey bandana, long black hair, hoop earrings, coral sleeveless jersey, indigo cargo jeans, white sneakers). The same full-speed RUN cycle, hair flowing back.
3) lucia-stretch.png - Lucia again, but this sheet is DIFFERENT: FRONT view facing the camera (like the reference), 1 row x 4 columns of cells 384x1024 on the 1536x1024 canvas. Four frames of a stretch: (1) standing relaxed, arms at sides; (2) arms rising; (3) both arms stretched overhead, up on her toes; (4) arms coming back down. Same size and baseline in every cell. Both forearms visible and unmarked.
```

```text
JOB: two sprite sheets and two vehicle sprites.
1) guard-walk.png - the bank security guard from the attached guard-reference.png (navy uniform, peaked cap, radio on the shoulder, clipboard). A steady patrolling WALK cycle, following the sheet rules.
2) tourist-photo.png - the tourist from the attached tourist-reference.png (floral shirt, bucket hat, camera on a strap). This sheet is DIFFERENT: FRONT view facing the camera, 1 row x 4 columns of cells 384x1024 on the 1536x1024 canvas. Four frames: (1) camera held at chest; (2) raising the camera; (3) camera at the eye with a bright white flash burst from it; (4) lowering the camera, grinning. Same size and baseline in every cell.
3) police-cruiser.png - 1536x1024, NOT a sheet: one police cruiser in pure side view facing RIGHT, slightly from above, classic black-and-white livery with a roof light bar (lights drawn unlit), no text, no numbers, no badges, no real-world police markings. Flat pure #00FF00 background, no shadow.
4) helicopter-police.png - 1536x1024, NOT a sheet: one dark blue-and-white police helicopter in side view facing RIGHT with a belly searchlight, rotor blades as a light motion blur, no text, no numbers, no markings. Flat pure #00FF00 background.
```
