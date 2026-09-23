# Crew outfits, v2

Version 2 dresses all four characters in new streetwear while keeping their faces, so the homepage crew and the CCTV sprites match. It was generated with the same AI image model, using the original illustrated crew as the identity reference. The originals are kept in [`archive/`](archive).

| File | Contents | Used for |
|---|---|---|
| [`source/crew-sprites-v2.png`](source/crew-sprites-v2.png) | Transparent four-column atlas. Left to right: the fixer (redhead), Jason (lime beanie), Lucia (bandana) and Rico (curly hair). Every face is uncovered so face evidence stays playable. | Jason, Lucia and Rico in the CCTV scenes |
| [`source/leonida-crew-v2.png`](source/leonida-crew-v2.png) | The original waterfront framing with the new outfits | Homepage hero, on every device |
| [`source/evidence-studio-v2.png`](source/evidence-studio-v2.png) | The original studio composition with the new outfits | Homepage monitor transition and play section |

[`src/avatars.js`](../src/avatars.js) maps each face and Lucia's tattoo from the atlas into scene coordinates; the forensics algorithm is unchanged. The game loads same-name WebP files from `public/art/`, made by `scripts/optimize-art.mjs`.

## Prompts

### Sprite atlas

<details>
<summary>Show prompt</summary>

Create a production GAME CHARACTER SPRITE ATLAS on a genuinely TRANSPARENT alpha background. Use the attached Leonida crew artwork as the FACE IDENTITY and angular painterly cartoon illustration reference. Four clearly ADULT characters, FULL BODY head to shoes, front-facing or near-front, looking at camera, relaxed standing, arms loosely down and slightly away from torso so hands and forearms visible. All same scale and equal height, all shoes on same baseline. Layout EXACTLY FOUR EQUAL WIDTH COLUMNS side-by-side left to right, one figure centered within each column, ample transparent gutters, no overlap. Wide landscape 2:1 canvas, ideally 2048x1024 or larger. Body height ~90% of canvas, head top ~5%, feet bottom95%. Every character remains inside its own column with generous side margins. Maintain oversized expressive eyes, sculpted angular face planes, brushwork, coherent clean 2D/2.5D GTA-inspired game character design. Preserve faces recognizable from reference but CHANGE OUTFITS:

COLUMN 1: adult auburn bob-haired green-eyed freckled woman, same face, wearing a cropped burgundy racer jacket over charcoal tee, olive cargo pants and cream high-top sneakers. Arms at sides.

COLUMN 2: adult man with lime beanie, clear glasses, lip ring, same face as lime-clothed character; outfit changed to boxy unzipped teal short-sleeved overshirt over cream graphic-free tee, black baggy cargo pants, lime-and-cream sneakers, silver chain. Keep lime beanie and clear glasses. Visible whole face.

COLUMN 3: adult brown-skinned woman with grey bandana, long straight black hair, hoop earrings, same expressive face; outfit changed to sleeveless coral cropped sports jersey, loose dark indigo cargo jeans, white sneakers, silver belt chain. Both forearms uncovered, image-right forearm especially clearly visible, unmarked skin there so an evidence tattoo can be overlaid in game. Hands relaxed at sides, not on hips. NO gloves or jacket sleeves. Whole face fully visible.

COLUMN 4: adult curly-haired green-eyed freckled man from masked reference, same eyes/hair/skin; REMOVE face mask entirely so his entire face is visible as required by face-identification gameplay. Outfit changed to charcoal sleeveless utility vest over burnt-orange short-sleeved tee, slate grey cargos, dark trainers. Simple plain black headband, no symbol. No weapon.

No background colour, no scenery, NO ground plane or cast shadow, no labels, no text, no watermark, no logo, no frame. Actual transparent empty pixels around each figure. Clean alpha silhouette for direct overlay onto CCTV game scenes. Four separate non-touching fullbody figures in precisely ordered equal-width columns.

</details>

### Waterfront edit

Edits the original waterfront hero, with the sprite atlas as the outfit reference.

<details>
<summary>Show prompt</summary>

EDIT image 1 (the Leonida waterfront homepage illustration). Image 2 is SUPPORTING OUTFIT REFERENCE, a four-character sprite atlas. Preserve image 1's exact landscape composition, framing, four original faces and hairstyles, character locations and poses, canal, car, city, palm trees, sky colours and empty central space. Change ONLY the four outfits to closely match image 2: redhead left foreground wears burgundy cropped racer jacket, charcoal tee, olive cargos; lime-beanie adult behind left wears teal short-sleeve unbuttoned overshirt over cream tee, black cargos, silver necklace, retain beanie and clear glasses; bandana woman right foreground wears coral sleeveless crop jersey and loose dark indigo cargo jeans with silver waist chain, retain grey bandana black hair earrings; curly-haired character behind right wears charcoal utility vest over burnt-orange tee, plain black headband, remove face mask so the face matches the visible face in image 2. Keep original painterly angular stylized 2D/2.5D illustration. Do not add characters, reposition anything, alter background, change lighting, add text or logos, or add UI. This is an outfit-only continuity update to the existing website hero artwork. Same wide aspect ratio as image 1.

</details>

### Studio edit

Edits the original evidence studio, with the sprite atlas as the outfit reference.

<details>
<summary>Show prompt</summary>

Edit image 1, the existing illustrated evidence studio. Image 2 is supporting outfit reference only. Keep image 1's exact composition, room, furniture, lighting, empty centre for the HTML monitor, original faces, hair, poses and framing. Change ONLY clothes: redhead at left now wears the burgundy cropped racer jacket with cream stripes, charcoal tee and olive cargo pants from image 2; woman at right with grey bandana and black hair now wears the coral sleeveless jersey and dark indigo cargo jeans with silver chain from image 2. Preserve the original angular painterly cartoon look and pastel purple-pink palette. Do not move any characters or objects. Do not add monitor, text, logos or other elements. Same landscape aspect ratio. The outfits should match the new game sprites.

</details>
