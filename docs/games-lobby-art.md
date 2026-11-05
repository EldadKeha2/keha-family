# Grandpa Shlomo’s dancing invitation

The game selection page ends with an animated invitation instead of the old general quiz-rule summary. Real HTML supplies “בואו נשחק!” / “Let’s play!” and the localized pause/resume button. The speech bubble stays on the left in both languages.

`public/assets/games/shlomo-dance.webp` is an original transparent 1254 × 1254, four-pose sprite sheet in an exact 2 × 2 grid. The built-in image tool restyled the previous portrait-based Shlomo illustration into a clear 2D cartoon, preserving his oval face, brows, eyes, nose, wavy hair, olive brown complexion and clean-shaven smile. Every pose includes his burgundy fez, white shirt, charcoal suit and shoes.

`public/assets/games/yemeni-courtyard.webp` is a separate 1536 × 1024 background generated from the same previous illustration, removing the entire man and filling the scene with Sana’a tower houses, white gypsum tracery and a stone courtyard. Both original PNGs were encoded as WebP without cropping or recolouring.

The four frames use side, close, backward-cross and return positions, with distinct feet, knees and hands. CSS runs a 2.4-second loop, with a small continuous torso sway. The pause button pauses both animations in place and resumes from the same point. Reduced motion uses a still pose. The eager background avoids an empty courtyard while the animated character is already visible. No runtime image generation, live profile lookups or database writes are needed.

Generation prompts: (1) a transparent square with four equally spaced complete head-to-toe poses of the same recognizable Shlomo in a red fez and suit, clean 2D cartoon outlines and cel shading, dancing a gentle Yemeni step, no labels or background; (2) remove the complete man from the previous image, preserve the warm architecture, create an empty Yemeni courtyard and pale sky at the upper left, no people or text.
