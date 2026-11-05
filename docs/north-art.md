# Northbound with Roei — original game art

`public/assets/games/north/roi-profile.webp` preserves the actual family profile photograph for `roi`, retrieved once from `/api/people/roi` on 5 November 2026. At that time the profile was `/media/dc4a00a9bb424a0787e1d6041ec12e5a` (251 × 358). This local snapshot avoids repeated database reads and keeps the game’s tribute portrait stable.

`cruze-roi.webp` is a 512 × 768 transparent overhead sprite, derived from an original 1024 × 1536 generation. The silver-blue Chevrolet Cruze points straight north. The smiling driver was illustrated from Roei’s actual profile reference: short curly salt-and-pepper hair, warm complexion, broad smile and blue plaid shirt. The generated transparency and soft contact shadow are preserved. No background was composited into the asset.

`family-clapping.webp` is an original transparent two-frame sprite strip, 1536 × 512; each frame is 768 × 512. The left half has hands apart and the right half hands together. Both frames show the same fifteen friendly, varied caricatures standing in two rows, including grandparents, adults and children. These are celebratory family-inspired characters rather than asserted individual portrait likenesses. CSS may toggle the two frames for applause; reduced-motion users should see a still frame.

Both illustrations were made using the built-in image generation tool, visually checked over a cream background, and encoded as WebP without recolouring. The full prompts followed these briefs:

1. **Cruze:** one complete silver-blue Chevrolet Cruze, overhead and facing exactly north, gold Chevrolet bowtie, clean comic outlines and warm cel shading; Roei’s reference face clearly visible behind the windshield with hands on the steering wheel; actual transparent background, no road, typography or other cars.
2. **Family applause:** exactly two equal frames side by side; the same fifteen smiling multigenerational Mediterranean/Yemenite Israeli family-inspired caricatures in the same positions and clothes, with hands apart in the first frame and hands together in the second; full figures, warm hand-drawn comic style, actual transparent background, no text, banners, road or vehicle.

The actual photo remains available separately, so the game does not depend on a generated likeness to identify Roei.
